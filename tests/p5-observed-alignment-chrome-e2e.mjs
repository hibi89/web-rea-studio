// Independent Chrome source + generated draft geometry correspondence proof.
// This fixture deliberately damages the generated HTML, then independently
// observes the draft DOM; matching never reads the synthetic source element ID.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
import {alignObservedP4Regions,runObservedP4GeometryRepair} from '../studio/p5-observed-alignment.mjs';

const browser=process.env.CHROME_BIN;
if(!browser)throw Error('Real Chrome is required');
const root=await mkdtemp(join(tmpdir(),'rea-f5-observed-alignment-'));
const fixture='<html><head><meta charset="utf-8"><style>'+
 'html,body{margin:0}body{height:900px;background:rgb(231,235,241)}'+
 'aside{position:absolute;left:40px;top:50px;width:260px;height:480px;background:rgb(255,255,255)}'+
 'main{position:absolute;left:420px;top:50px;width:370px;height:480px;background:rgb(186,218,239)}'+
 '</style></head><body><aside></aside><main></main></body></html>';
let localResponses=0,actualRenders=0;
async function chromeCapture(label,html,url){
 const dir=join(root,label);
 await mkdir(dir,{recursive:true,mode:0o700});
 const result=await runDynamicAnalysis({target:url,browserPath:browser,dir,
  scriptsDisabled:true,relay:async request=>{
   assert.equal(request,url,'Only in-memory scriptless HTML is allowed');
   localResponses++;
   return {status:200,contentType:'text/html; charset=utf-8',
    body:Buffer.from(html,'utf8')};
  }});
 assert.equal(result.report.verdict,'PASS',JSON.stringify(result.report.failures));
 return {screenshot:await readFile(join(dir,'screenshot.png')),
  geometry:result.inspection.page.reconstruction_blueprint};
}
try{
 const reference=await chromeCapture('original',fixture,'https://f5-alignment-source.example.org/');
 assert.ok(reference.geometry.boxes.some(x=>x.tag==='aside'));
 const generatedDefect=structuredClone(reference.geometry);
 const changed=generatedDefect.boxes.find(x=>x.tag==='aside');
 changed.x+=28;changed.w+=54;
 const flawedHtml=generateP4Reconstruction(generatedDefect);
 const draft=await chromeCapture('independent-draft',flawedHtml,'https://f5-alignment-generated.example.org/');
 assert.ok(!draft.geometry.boxes.some(b=>b.tag==='aside'),
  'Generated DOM must be tag-distinct from source');
 const mapping=alignObservedP4Regions({
  referenceGeometry:reference.geometry,draftGeometry:draft.geometry
 });
 assert.equal(mapping.status,'MATCHED_ONE_OBSERVED_DEFECT',JSON.stringify(mapping));
 assert.deepEqual(mapping.defect.fields,['x','w']);
 assert.notEqual(mapping.defect.reference_index,mapping.defect.draft_index,
  'Different DOM tree ordering proves identity is not an array index shortcut');
 assert.equal(mapping.original_dom_identity_verified,false);
 const repaired=await runObservedP4GeometryRepair({
  referenceGeometry:reference.geometry,draftGeometry:draft.geometry,
  referencePng:reference.screenshot,draftPng:draft.screenshot,
  maxAttempts:2,minMaeImprovement:0.3,
  renderCandidate:async (html,{attempt})=>{
   actualRenders++;
   assert.match(html,/script-src &#39;none&#39;/);
   assert.doesNotMatch(html,/<script\b|https?:\/\//i);
   return chromeCapture('replay-'+actualRenders+'-'+attempt,html,
    'https://f5-alignment-replay.example.org/');
  }
 });
 assert.equal(repaired.alignment?.canonical_draft_verified,true,
  JSON.stringify(repaired.alignment));
 assert.equal(repaired.status,'BOUNDED_STATIC_GEOMETRY_IMPROVEMENT',
  JSON.stringify(repaired.history));
 assert.equal(repaired.accepted,2);
 assert.deepEqual(repaired.history.map(h=>h.patch.field),['x','w']);
 assert.ok(repaired.history.every(h=>h.accepted));
 assert.ok(repaired.final.rgb_mae<repaired.baseline.rgb_mae);
 assert.equal(repaired.alignment_preflight_replays,1);
 assert.equal(actualRenders,4,'One standalone preflight and three measured reparations');
 assert.equal(localResponses,6,'One source + one independently observed draft + four generated replays');
 assert.equal(repaired.product_ready,false);
 assert.equal(repaired.original_site_refetched,false);
 console.log(JSON.stringify({p5_observed_alignment_chrome:'PASS',
  independent_dom_tags:'aside-to-div',aligned_regions:repaired.alignment.reference_regions,
  defect_fields:repaired.alignment.defect.fields,
  accepted_patches:repaired.accepted,
  baseline_rgb_mae:repaired.baseline.rgb_mae,final_rgb_mae:repaired.final.rgb_mae,
  fresh_generated_replays:actualRenders,synthetic_html_responses:localResponses,
  external_requests:0,product_ready:false}));
}finally{await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
