import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {proposeGroundedP4GeometryPatch,runBoundedP4GeometryRepair} from '../studio/p5-geometry-repair.mjs';

const box=(tag,x,y,w,h,c,depth=2)=>({tag,depth,x,y,w,h,background:c,
 border_color:'rgb(0, 0, 0)',border_width:'0px',radius:'0px'});
function layout(){
 return {source:'p4-geometry',viewport:{width:1440,height:900},
  document:{width:1440,height:900},background:'rgb(230, 230, 230)',titles:[],
  boxes:[box('body',0,0,1440,900,'rgb(230, 230, 230)',1),
   box('aside',40,50,260,480,'rgb(255, 255, 255)'),
   box('main',400,50,380,480,'rgb(190, 220, 240)')]};
}
const damaged=()=>{const a=layout();a.boxes[1].x=68;a.boxes[1].w=284;return a;};
function png(n=255){
 const w=24,h=16;const rows=Array.from({length:h},()=>{
  const b=Buffer.alloc(1+w*3);b.fill(n,1);return b;
 });
 const chunk=(tag,data)=>{
  const h=Buffer.alloc(8);h.writeUInt32BE(data.length);h.write(tag,4);
  return Buffer.concat([h,data,Buffer.alloc(4)]);
 };
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);
 ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.concat(rows))),
  chunk('IEND',Buffer.alloc(0))]);
}
function modeledRender(html){
 const got=layout();
 const parts=/left:(\d+)px;top:50px;width:(\d+)px;height:480px;background:rgb\(255, 255, 255\)/.exec(html);
 assert.ok(parts,'Bounded standalone output must include measured aside');
 got.boxes[1].x=+parts[1];got.boxes[1].w=+parts[2];
 const pixels=parts[1]==='40'&&parts[2]==='260'?255:parts[1]==='40'?160:0;
 return {screenshot:png(pixels),geometry:got};
}
test('one geometry field at a time, exact bounded P4 evidence, no unexpected mutation',()=>{
 const first=proposeGroundedP4GeometryPatch(layout(),damaged());
 assert.deepEqual(first.patch,{kind:'observed-rectangle-geometry',
  region_index:1,field:'x',delta_px:-28,source:'matched-sanitized-P4-region',
  max_delta_px:64});
 assert.equal(first.geometry.boxes[1].x,40);
 assert.equal(first.geometry.boxes[1].w,284);
 assert.equal(damaged().boxes[1].x,68,'Original remains unchanged');
 const second=proposeGroundedP4GeometryPatch(layout(),first.geometry);
 assert.equal(second.patch.field,'w');
 assert.equal(second.patch.delta_px,-24);
 assert.equal(second.geometry.boxes[1].w,260);
 assert.equal(proposeGroundedP4GeometryPatch(layout(),second.geometry),null);
});
test('refuses unsupported displacement, ambiguous boxes, titles and paint overlaps',()=>{
 const original=layout();
 const distant=damaged();distant.boxes[1].x+=70;
 assert.equal(proposeGroundedP4GeometryPatch(original,distant),null);
 const ambiguous=damaged();ambiguous.boxes[2].x+=14;
 assert.equal(proposeGroundedP4GeometryPatch(original,ambiguous),null);
 const hidden=layout();hidden.boxes[1].background='transparent';
 const hiddenDraft=structuredClone(hidden);hiddenDraft.boxes[1].x+=10;
 assert.equal(proposeGroundedP4GeometryPatch(hidden,hiddenDraft),null);
 const text=layout();text.titles=[{tag:'h1',x:42,y:55,w:80,h:45,text:'Visible header',
  color:'rgb(0, 0, 0)',font_size:'14px',font_weight:'700'}];
 const textDraft=structuredClone(text);textDraft.boxes[1].x+=10;
 assert.equal(proposeGroundedP4GeometryPatch(text,textDraft),null);
 const peer=layout();peer.boxes[2].x=285;
 const peerDraft=structuredClone(peer);peerDraft.boxes[1].x+=10;
 assert.equal(proposeGroundedP4GeometryPatch(peer,peerDraft),null);
 const changed=damaged();changed.boxes[1].background='rgb(1, 1, 1)';
 assert.throws(()=>proposeGroundedP4GeometryPatch(original,changed),
  /P5_GEOMETRY_REPAIR_CONTENT_MISMATCH/);
 assert.throws(()=>proposeGroundedP4GeometryPatch(original,damaged(),{maxDeltaPx:66}),
  /P5_GEOMETRY_REPAIR_BAD_LIMIT/);
});
test('accepts two separately measured coordinate then size improvements',async()=>{
 let calls=0;
 const result=await runBoundedP4GeometryRepair({
  referenceGeometry:layout(),startingGeometry:damaged(),
  referencePng:png(),renderCandidate:async html=>{calls++;return modeledRender(html);}
 });
 assert.equal(result.status,'BOUNDED_STATIC_GEOMETRY_IMPROVEMENT',JSON.stringify(result.history));
 assert.equal(result.accepted,2);
 assert.equal(result.attempts,2);
 assert.equal(result.renderings,3);
 assert.equal(calls,3);
 assert.equal(result.final.rgb_mae,0);
 assert.ok(result.baseline.rgb_mae>result.final.rgb_mae);
 assert.deepEqual(result.history.map(h=>h.patch.field),['x','w']);
 assert.equal(result.product_ready,false);
 assert.equal(result.independent_chrome_verified_by_module,false);
 assert.doesNotMatch(result.candidate_html,/<script\b|https?:\/\//i);
});
test('does not adopt non-improving replay or incomplete secondary evidence',async()=>{
 const rejected=await runBoundedP4GeometryRepair({
  referenceGeometry:layout(),startingGeometry:damaged(),referencePng:png(),
  renderCandidate:async html=>({...modeledRender(html),screenshot:png(0)})
 });
 assert.equal(rejected.status,'STOPPED_NO_IMPROVEMENT');
 assert.equal(rejected.accepted,0);
 assert.match(rejected.candidate_html,/left:68px;top:50px;width:284px/);
 const second={...layout(),viewport:{width:900,height:900},
  document:{width:900,height:900}};
 second.boxes=second.boxes.map(b=>({...b,w:b.tag==='body'?900:b.w}));
 const unverified=await runBoundedP4GeometryRepair({
  referenceGeometry:layout(),startingGeometry:damaged(),referencePng:png(),
  renderCandidate:modeledRender,regressionViews:[{name:'narrow',
   referenceGeometry:second,referencePng:png(),
   renderCandidate:async()=>{throw Error('missing Chrome capture');}}]
 });
 assert.equal(unverified.status,'STOPPED_SECONDARY_BASELINE_UNVERIFIED');
 assert.equal(unverified.accepted,0);
 assert.equal(unverified.product_ready,false);
});
test('secondary regression rejects primary gain while retaining last measured HTML',async()=>{
 const other={...layout(),viewport:{width:900,height:900},
  document:{width:900,height:900}};
 other.boxes=other.boxes.map(b=>({...b,w:b.tag==='body'?900:b.w}));
 let replays=0;
 const res=await runBoundedP4GeometryRepair({
  referenceGeometry:layout(),startingGeometry:damaged(),referencePng:png(),
  renderCandidate:modeledRender,maxAttempts:1,
  regressionViews:[{name:'narrow',referenceGeometry:other,referencePng:png(),
   renderCandidate:async (html)=>{
    replays++;
    return {screenshot:png(html.includes('left:40px;top:50px;')?0:255),geometry:other};
   }}]
 });
 assert.equal(res.status,'STOPPED_VIEWPORT_REGRESSION');
 assert.equal(res.accepted,0);
 assert.equal(replays,2);
 assert.equal(res.history[0].secondary_views[0].status,'regressed');
 assert.ok(res.history[0].after.rgb_mae<res.history[0].before.rgb_mae);
 assert.match(res.candidate_html,/left:68px;top:50px;width:284px/);
});
