import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
import {compareChromeScreenshots,evaluateStaticVisualGate} from '../studio/p5-visual-diff.mjs';
import {auditSavedStaticPipeline} from '../studio/static-pipeline-audit.mjs';

const sourceGeometry={
 source:'p4-geometry',viewport:{width:320,height:240},
 document:{width:320,height:240},body_color:'rgb(239, 241, 250)',
 boxes:[{tag:'main',depth:1,x:0,y:0,w:320,h:240,
  background:'rgb(239, 241, 250)',border_width:'0px',
  border_color:'transparent',radius:'0px'}],titles:[]
};
function fixturePng(color=[200,200,200]){
 const width=32,height=24,rows=[];
 for(let y=0;y<height;y++){
  const row=Buffer.alloc(1+width*3);row[0]=0;
  for(let x=0;x<width;x++)color.forEach((channel,c)=>row[1+x*3+c]=channel);
  rows.push(row);
 }
 const chunk=(name,bytes)=>{
  const head=Buffer.alloc(8);head.writeUInt32BE(bytes.length,0);head.write(name,4,'ascii');
  return Buffer.concat([head,bytes,Buffer.alloc(4)]);
 };
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
 ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.concat(rows))),
  chunk('IEND',Buffer.alloc(0))]);
}
function valid({otherColor=[200,200,200]}={}){
 const sourcePng=fixturePng(),replayPng=fixturePng(otherColor);
 const comparison=compareChromeScreenshots(sourcePng,replayPng);
 comparison.geometry={status:'measured-not-certified',region_match_pct:100};
 comparison.quality_gate=evaluateStaticVisualGate(comparison);
 return {
  meta:{mode:'static-visual',status:'completed',target_url:'https://SECRET-SOURCE.example.org/private?q=SENSITIVE'},
  report:{verdict:'PASS',screenshot_saved:true,
   reconstruction_available:true,visual_comparison_available:true},
  inspection:{mode:'static-visual',page:{reconstruction_blueprint:sourceGeometry},
   private_page_text:'REDACTED_SENSITIVE'},
  comparison,html:generateP4Reconstruction(sourceGeometry),
  sourcePng,replayPng
 };
}
test('existing local static capture, generated HTML and stored image metrics pass coherence, not product certification',()=>{
 const result=auditSavedStaticPipeline(valid());
 assert.equal(result.status,'OFFLINE_ARTIFACTS_VERIFIED');
 assert.equal(result.stages.source_capture.status,'VERIFIED');
 assert.equal(result.stages.layout_evidence.status,'VERIFIED');
 assert.equal(result.stages.independent_html.status,'VERIFIED');
 assert.equal(result.stages.screenshot_comparison.status,'VERIFIED');
 assert.equal(result.stages.static_visual_gate.status,'THRESHOLD_MET');
 assert.equal(result.observed.box_count,1);
 assert.equal(result.metrics.rgb_mae,0);
 assert.equal(result.network_requests_issued,0);
 assert.equal(result.browser_actions_executed,0);
 assert.equal(result.product_ready,false);
 assert.equal(result.functional_equivalence_verified,false);
 assert.doesNotMatch(JSON.stringify(result),/SECRET-SOURCE|SENSITIVE|private|<main|data:image|base64/);
});
test('consistent poor screenshot stays coherently audited while visual threshold is blocked',()=>{
 const result=auditSavedStaticPipeline(valid({otherColor:[0,0,0]}));
 assert.equal(result.status,'OFFLINE_ARTIFACTS_VERIFIED');
 assert.equal(result.stages.static_visual_gate.status,'BLOCKED');
 assert.equal(result.metrics.pixel_match_pct,0);
 assert.equal(result.product_ready,false);
});
test('incomplete saved pipeline never causes Chrome replay or claims a complete application',()=>{
 const v=valid();
 v.comparison=null;v.replayPng=null;v.report.visual_comparison_available=false;
 const result=auditSavedStaticPipeline(v);
 assert.equal(result.status,'INCOMPLETE');
 assert.equal(result.stages.independent_html.status,'VERIFIED');
 assert.equal(result.stages.screenshot_comparison.status,'MISSING');
 assert.equal(result.product_ready,false);
 assert.equal(result.original_site_refetched,false);
});
test('tampered independent HTML, forged RGB metric or stored gate fails closed',()=>{
 const a=valid();a.html=a.html.replace('Web REA Studio','ALTERED_SITE');
 const b=valid();b.comparison.rgb_mae=4.2;
 const c=valid();c.comparison.quality_gate.status='VISUAL_GATE_BLOCKED';
 const d=valid();d.replayPng=Buffer.from('broken');
 const e=valid();e.report.reconstruction_available=false;
 for(const v of [a,b,c,d,e]){
  const result=auditSavedStaticPipeline(v);
  assert.equal(result.status,'EVIDENCE_CONFLICT');
  assert.equal(result.product_ready,false);
  assert.equal(result.network_requests_issued,0);
  assert.ok(Object.values(result.stages).some(x=>x.status==='CONFLICT'));
 }
});
test('run mode and completion policy never infers successful offline audit from another run',()=>{
 for(const props of [{mode:'dynamic-passive',status:'completed'},
  {mode:'static-visual',status:'failed'},
  {mode:'static-visual',status:'running'}]){
  const x=valid();Object.assign(x.meta,props);
  assert.equal(auditSavedStaticPipeline(x).status,'INCOMPLETE');
 }
});
