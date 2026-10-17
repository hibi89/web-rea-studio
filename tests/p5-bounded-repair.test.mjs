import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {proposeSafeP4ColorRepair,runBoundedP4ColorRepair} from '../studio/p5-bounded-repair.mjs';

function samplePng(n=255){
 const w=24,h=16;const rows=[];
 for(let y=0;y<h;y++){
  const row=Buffer.alloc(w*3+1);row[0]=0;
  for(let i=1;i<row.length;i++)row[i]=n;
  rows.push(row);
 }
 const chunk=(name,data)=>{
  const header=Buffer.alloc(8);header.writeUInt32BE(data.length);header.write(name,4,4);
  return Buffer.concat([header,data,Buffer.alloc(4)]);
 };
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),
  chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
const reference=()=>({source:'p4-geometry',viewport:{width:1440,height:900},
 document:{height:900},background:'rgb(240, 240, 240)',
 boxes:[{tag:'aside',depth:2,x:20,y:30,w:260,h:500,
  background:'rgb(250, 250, 250)',border_width:'0px',radius:'0px'}],
 titles:[]});
const broken=()=>{const x=reference();x.background='rgb(0, 0, 0)';
 x.boxes[0].background='rgb(0, 0, 0)';return x;};
const synthetic=async html=>({
 screenshot:samplePng(
  html.includes('body{background:rgb(240, 240, 240)')?
   html.includes('background:rgb(250, 250, 250)')?255:120:0),
 geometry:reference()
});

test('repair plan picks one safe grounded style token at a time',()=>{
 const first=proposeSafeP4ColorRepair(reference(),broken());
 assert.equal(first.patch.kind,'page-background');
 assert.equal(first.geometry.background,'rgb(240, 240, 240)');
 assert.equal(first.geometry.boxes[0].background,'rgb(0, 0, 0)');
 const second=proposeSafeP4ColorRepair(reference(),first.geometry);
 assert.equal(second.patch.kind,'painted-region-color');
 assert.equal(second.patch.region_index,0);
 assert.equal(second.geometry.boxes[0].background,'rgb(250, 250, 250)');
 assert.equal(proposeSafeP4ColorRepair(reference(),second.geometry),null);
 assert.equal(broken().boxes[0].background,'rgb(0, 0, 0)');
});

test('bounded repair accepts two independently measured improvements without certifying product',async()=>{
 let calls=0;
 const out=await runBoundedP4ColorRepair({referenceGeometry:reference(),startingGeometry:broken(),
  referencePng:samplePng(),renderCandidate:async html=>{calls++;return synthetic(html);}});
 assert.equal(out.status,'BOUNDED_STATIC_COLOR_IMPROVEMENT');
 assert.equal(out.accepted,2);
 assert.equal(out.attempts,2);
 assert.equal(calls,3);
 assert.equal(out.renderings,3);
 assert.ok(out.history.every(x=>x.accepted&&x.reason==='independently_replayed_improvement'));
 assert.ok(out.baseline.rgb_mae>out.final.rgb_mae);
 assert.equal(out.final.rgb_mae,0);
 assert.equal(out.final.gate,'VISUAL_THRESHOLD_MET_STATIC_ONLY');
 assert.equal(out.product_ready,false);
 assert.equal(out.functional_equivalence_verified,false);
 assert.equal(out.independent_chrome_verified_by_module,false);
 assert.doesNotMatch(out.candidate_html,/<script\b|https?:\/\//i);
});

test('replay with no demonstrated improvement rolls back to original candidate',async()=>{
 const initial=await runBoundedP4ColorRepair({referenceGeometry:reference(),startingGeometry:broken(),
  referencePng:samplePng(),renderCandidate:async()=>({screenshot:samplePng(0),geometry:reference()})});
 assert.equal(initial.status,'STOPPED_NO_IMPROVEMENT');
 assert.equal(initial.accepted,0);
 assert.equal(initial.attempts,1);
 assert.equal(initial.renderings,2);
 assert.ok(initial.history.every(x=>!x.accepted));
 assert.ok(initial.candidate_html.includes('body{background:rgb(0, 0, 0)'));
});

test('bad geometry, invalid options and incomplete replay fail closed',async()=>{
 const wrong=broken();wrong.boxes[0].x+=10;
 assert.throws(()=>proposeSafeP4ColorRepair(reference(),wrong),/P5_REPAIR_LAYOUT_MISMATCH/);
 await assert.rejects(()=>runBoundedP4ColorRepair({referenceGeometry:reference(),startingGeometry:wrong,
  referencePng:samplePng(),renderCandidate:synthetic}),/P5_REPAIR_LAYOUT_MISMATCH/);
 await assert.rejects(()=>runBoundedP4ColorRepair({referenceGeometry:reference(),startingGeometry:broken(),
  referencePng:samplePng(),renderCandidate:synthetic,maxAttempts:3}),/P5_REPAIR_INVALID_OPTIONS/);
 const bad=await runBoundedP4ColorRepair({referenceGeometry:reference(),startingGeometry:broken(),
  referencePng:samplePng(),renderCandidate:async(_,a)=>a.attempt===0?synthetic(_):{screenshot:null,geometry:null}});
 assert.equal(bad.status,'STOPPED_RENDER_FAILURE');
 assert.equal(bad.accepted,0);
 assert.equal(bad.history[0].accepted,false);
 assert.ok(bad.candidate_html.includes('body{background:rgb(0, 0, 0)'));
});

test('no safe color patch yields zero candidate executions',async()=>{
 let calls=0;
 const p=await runBoundedP4ColorRepair({referenceGeometry:reference(),startingGeometry:reference(),
  referencePng:samplePng(),renderCandidate:async html=>{calls++;return synthetic(html);}});
 assert.equal(p.status,'NO_SAFE_COLOR_PATCH');
 assert.equal(p.attempts,0);
 assert.equal(calls,1);
 assert.equal(p.product_ready,false);
});
