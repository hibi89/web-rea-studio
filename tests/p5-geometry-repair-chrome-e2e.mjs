// Controlled synthetic Chrome: repair one observed rectangle's position and
// width, one coordinate per iteration, without contacting the original site.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {runBoundedP4GeometryRepair} from '../studio/p5-geometry-repair.mjs';

const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('CHROME_BIN required');
const root=await mkdtemp(join(tmpdir(),'rea-f5-geometry-'));
const syntheticUrl='https://f5-synthetic-geometry.example.org/';
const independentUrl='https://f5-independent-geometry.example.org/';
const fixture='<!doctype html><html><head><meta charset="utf-8"><style>'+
 'html,body{margin:0}body{height:900px;background:rgb(231,235,241)}'+
 'aside{position:absolute;left:40px;top:50px;width:260px;height:480px;background:rgb(255,255,255)}'+
 'main{position:absolute;left:420px;top:50px;width:370px;height:480px;background:rgb(186,218,239)}'+
 '</style></head><body><aside></aside><main></main></body></html>';
let localResponses=0;
async function offlineCapture(folder,html,url){
 const dir=join(root,folder);await mkdir(dir,{recursive:true,mode:0o700});
 const data=await runDynamicAnalysis({target:url,browserPath,dir,scriptsDisabled:true,
  relay:async request=>{
   assert.equal(request,url,'No unexpected cross-origin request allowed');
   localResponses++;
   return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(html,'utf8')};
  }});
 assert.equal(data.report.verdict,'PASS',JSON.stringify(data.report.failures));
 return {screenshot:await readFile(join(dir,'screenshot.png')),
  geometry:data.inspection?.page?.reconstruction_blueprint};
}
try{
 const baseline=await offlineCapture('source',fixture,syntheticUrl);
 assert.ok(baseline.geometry?.boxes.some(b=>b.tag==='aside'),'Need Chrome geometry');
 const damaged=structuredClone(baseline.geometry);
 const aside=damaged.boxes.find(b=>b.tag==='aside');
 aside.x+=28;
 aside.w+=54; // clearly measurable while inside the 64px safety budget
 let captured=0;
 const results=await runBoundedP4GeometryRepair({
  referenceGeometry:baseline.geometry,startingGeometry:damaged,
  referencePng:baseline.screenshot,maxAttempts:2,minMaeImprovement:0.3,
  renderCandidate:async(html,{attempt})=>{
   captured++;
   assert.equal(attempt,captured-1);
   assert.match(html,/script-src &#39;none&#39;/);
   assert.doesNotMatch(html,/<script\b|https?:\/\//i);
   return offlineCapture('replay-'+attempt,html,independentUrl);
  }
 });
 assert.equal(results.status,'BOUNDED_STATIC_GEOMETRY_IMPROVEMENT',JSON.stringify(results.history));
 assert.equal(results.accepted,2);
 assert.equal(results.attempts,2);
 assert.equal(results.renderings,3);
 assert.deepEqual(results.history.map(h=>h.patch.field),['x','w']);
 assert.ok(results.history.every(h=>h.accepted&&
  h.after.rgb_mae<h.before.rgb_mae));
 assert.ok(results.final.rgb_mae<results.baseline.rgb_mae);
 assert.equal(results.product_ready,false);
 assert.equal(results.functional_equivalence_verified,false);
 assert.equal(localResponses,4,'Exactly one in-memory reference and three new generated renders');
 console.log(JSON.stringify({p5_geometry_chrome:'PASS',
  accepted_patches:results.accepted,fields:results.history.map(h=>h.patch.field),
  baseline_rgb_mae:results.baseline.rgb_mae,final_rgb_mae:results.final.rgb_mae,
  independent_replays:captured,original_site_refetched:false,
  external_network_requests:0,product_ready:false}));
}finally{
 await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
