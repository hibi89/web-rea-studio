import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {alignObservedP4Regions,validateObservedGeometryInput,
 runObservedP4GeometryRepair} from '../studio/p5-observed-alignment.mjs';

const rect=(tag,x,y,w,h,color)=>({tag,depth:tag==='body'?1:2,
 x,y,w,h,background:color,border_color:'rgb(0, 0, 0)',
 border_width:'0px',radius:'0px'});
const src=()=>({source:'p4-geometry',viewport:{width:1440,height:900},
 document:{width:1440,height:900},body_color:'rgb(230, 230, 230)',boxes:[
 rect('body',0,0,1440,900,'rgb(230, 230, 230)'),
 rect('aside',40,50,250,460,'rgb(255, 255, 255)'),
 rect('main',400,50,350,460,'rgb(180, 215, 240)')],titles:[]});
const replica=()=>({source:'p4-geometry',viewport:{width:1440,height:900},
 document:{width:1440,height:900},body_color:'rgb(230, 230, 230)',boxes:[
 rect('body',0,0,1440,900,'rgb(230, 230, 230)'),
 rect('main',0,0,1440,900,'transparent'),
 rect('div',400,50,350,460,'rgb(180, 215, 240)'),
 rect('div',68,50,304,460,'rgb(255, 255, 255)'),
 rect('div',1100,858,250,31,'rgb(19, 27, 43)')],titles:[]});
function png(n=250){
 const w=32,h=16;
 const rows=Array.from({length:h},()=>{const b=Buffer.alloc(w*3+1);b.fill(n,1);return b;});
 function part(tag,bytes){
  const h=Buffer.alloc(8);h.writeUInt32BE(bytes.length);h.write(tag,4);
  return Buffer.concat([h,bytes,Buffer.alloc(4)]);
 }
 const hdr=Buffer.alloc(13);hdr.writeUInt32BE(w);hdr.writeUInt32BE(h,4);hdr[8]=8;hdr[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),
  part('IHDR',hdr),part('IDAT',deflateSync(Buffer.concat(rows))),part('IEND',Buffer.alloc(0))]);
}
test('independently observed divs map to unique differently tagged source regions',()=>{
 const x=alignObservedP4Regions({referenceGeometry:src(),draftGeometry:replica()});
 assert.equal(x.status,'MATCHED_ONE_OBSERVED_DEFECT',JSON.stringify(x));
 assert.equal(x.reference_regions,2);
 assert.equal(x.draft_regions,2);
 assert.deepEqual(x.defect.fields,['x','w']);
 assert.equal(x.defect.reference_index,1);
 assert.equal(x.defect.draft_index,3);
 assert.equal(x.projected_starting_geometry.boxes[1].x,68);
 assert.equal(x.projected_starting_geometry.boxes[1].w,304);
 assert.equal(x.projected_starting_geometry.boxes[2].x,400);
 assert.equal(x.original_dom_identity_verified,false);
 assert.equal(x.product_ready,false);
 assert.doesNotMatch(JSON.stringify(x),/token=|password|https:/i);
});
test('alignment fails closed on duplicate cards, simultaneous changes and unsupported paint',()=>{
 const base=src(),one=replica();
 const noDefect=structuredClone(one);
 noDefect.boxes[3].x=40;noDefect.boxes[3].w=250;
 assert.equal(alignObservedP4Regions({referenceGeometry:base,draftGeometry:noDefect}).reason,
  'no_independent_geometry_defect');
 const several=structuredClone(one);several.boxes[2].x+=25;
 assert.equal(alignObservedP4Regions({referenceGeometry:base,draftGeometry:several}).reason,
  'multiple_independent_geometry_defects');
 const swapped=structuredClone(one);swapped.boxes[3].background='rgb(180, 215, 240)';
 assert.equal(alignObservedP4Regions({referenceGeometry:base,draftGeometry:swapped}).status,
  'REJECTED');
 const duplicate=structuredClone(base);duplicate.boxes[2]={...duplicate.boxes[1],x:75};
 const duplicatedDraft=structuredClone(one);
 duplicatedDraft.boxes[2]={...duplicatedDraft.boxes[3],x:74};
 assert.equal(alignObservedP4Regions({
  referenceGeometry:duplicate,draftGeometry:duplicatedDraft}).reason,'ambiguous_or_unmatched_region');
 const wrongFrame=structuredClone(one);wrongFrame.viewport.width=900;
 assert.equal(alignObservedP4Regions({referenceGeometry:base,draftGeometry:wrongFrame}).reason,
  'viewport_or_evidence_mismatch');
 const colors=structuredClone(one);colors.body_color='rgb(1, 1, 1)';
 assert.equal(alignObservedP4Regions({referenceGeometry:base,draftGeometry:colors}).reason,
  'page_paint_mismatch');
 const unrelated=structuredClone(one);unrelated.boxes[3].x=400;
 assert.equal(alignObservedP4Regions({referenceGeometry:base,draftGeometry:unrelated}).status,
  'REJECTED');
 assert.throws(()=>alignObservedP4Regions({referenceGeometry:base,draftGeometry:one,
  maxDeltaPx:65}),/P5_ALIGNMENT_LIMIT_INVALID/);
});
test('visual source-draft contract blocks a projected HTML that does not render alike',async()=>{
 const bad=await validateObservedGeometryInput({
  referenceGeometry:src(),draftGeometry:replica(),
  draftPng:png(0),
  renderCandidate:async()=>({screenshot:png(255)})
 });
 assert.equal(bad.status,'REJECTED');
 assert.equal(bad.reason,'canonical_draft_not_visually_equivalent');
 assert.equal(bad.canonical_draft_verified,false);
 const pass=await validateObservedGeometryInput({
  referenceGeometry:src(),draftGeometry:replica(),draftPng:png(255),
  renderCandidate:async()=>({screenshot:png(255)})
 });
 assert.equal(pass.canonical_draft_verified,true);
 assert.equal(pass.status,'MATCHED_ONE_OBSERVED_DEFECT');
 assert.ok(pass.draft_pixel_match_pct>=95);
 const error=await validateObservedGeometryInput({
  referenceGeometry:src(),draftGeometry:replica(),draftPng:png(255),
  renderCandidate:async()=>{throw Error('Chrome unavailable');}
 });
 assert.equal(error.status,'REJECTED');
 assert.equal(error.reason,'canonical_replay_failed');
});
test('no independently observed difference means no invented repair or browser replay',async()=>{
 let calls=0;
 const same=replica();same.boxes[3].x=40;same.boxes[3].w=250;
 const result=await runObservedP4GeometryRepair({
  referenceGeometry:src(),draftGeometry:same,
  draftPng:png(),referencePng:png(),renderCandidate:async()=>{
   calls++;throw Error('Must not render when no real change');
  }
 });
 assert.equal(result.status,'STOPPED_ALIGNMENT_UNVERIFIED');
 assert.equal(result.reason,'no_independent_geometry_defect');
 assert.equal(calls,0);
 assert.equal(result.product_ready,false);
});
