// First measured F5 edit -> replay -> improve -> replay, completely offline.
// Deliberately NOT a general website repair proof.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {runBoundedP4ColorRepair} from '../studio/p5-bounded-repair.mjs';
import {reviewSavedP5ColorRepair} from '../studio/p5-stored-review.mjs';
import {makeStore} from '../studio/core.mjs';
import {writeFile} from 'node:fs/promises';

const chrome=process.env.CHROME_BIN;
if(!chrome)throw Error('CHROME_BIN required for actual Chrome repair acceptance');
const fixture='<!doctype html><html><head><meta charset="utf-8"><style>'+
 'html,body{margin:0}body{height:900px;background:rgb(239,241,245)}'+
 'aside{position:absolute;left:20px;top:30px;width:260px;height:500px;background:rgb(255,255,255)}'+
 'main{position:absolute;left:310px;top:30px;width:480px;height:500px;background:rgb(220,230,240);border-radius:12px}'+
 '</style><title>Controlled visual repair</title></head>'+
 '<body><aside></aside><main></main></body></html>';
const target='https://p5-repair-source.example.org/';
const root=await mkdtemp(join(tmpdir(),'webrea-p5-repair-'));
let requests=0;
async function capture(dir,url,html){
 await mkdir(dir,{recursive:true,mode:0o700});
 return runDynamicAnalysis({target:url,browserPath:chrome,dir,scriptsDisabled:true,
  relay:async (requested)=>{
   requests++;
   assert.equal(requested,url,'P5 test must never access a different origin');
   return {status:200,contentType:'text/html; charset=utf-8',
    body:Buffer.from(html,'utf8')};
  }});
}
try{
 const sourceDir=join(root,'source');
 const {report,inspection}=await capture(sourceDir,target,fixture);
 assert.equal(report.verdict,'PASS',JSON.stringify(report.failures));
 const sourcePng=await readFile(join(sourceDir,'screenshot.png'));
 const reference=inspection.page.reconstruction_blueprint;
 assert.ok(reference?.boxes?.length>=2,'Chrome must capture geometric evidence');
 assert.ok(reference.boxes.some(b=>b.tag==='aside'),'Must have separately painted aside');
 const broken=structuredClone(reference);
 broken.background='rgb(0, 0, 0)';
 // P4 also paints a full body region above the CSS body background.
 // Deliberately damage both representations as one semantic paint defect.
 const body=broken.boxes.find(b=>b.tag==='body');
 assert.ok(body,'Source probe must identify the painted body rectangle');
 body.background='rgb(0, 0, 0)';
 const aside=broken.boxes.find(b=>b.tag==='aside');
 aside.background='rgb(0, 0, 0)';
 let replayCount=0;
 const result=await runBoundedP4ColorRepair({
  referenceGeometry:reference,startingGeometry:broken,referencePng:sourcePng,
  maxAttempts:2,minMaeImprovement:0.5,
  renderCandidate:async (html,{attempt})=>{
   replayCount++;
   assert.equal(attempt,replayCount-1,'Every attempt must have a fresh Chrome replay');
   assert.match(html,/script-src &#39;none&#39;/);
   assert.doesNotMatch(html,/<script\b|<iframe\b|https?:\/\//i);
   const dir=join(root,'candidate-'+attempt);
   const url='https://p5-repair-candidate.example.org/';
   const replay=await capture(dir,url,html);
   assert.equal(replay.report.verdict,'PASS',JSON.stringify(replay.report.failures));
   return {
    screenshot:await readFile(join(dir,'screenshot.png')),
    geometry:replay.inspection.page.reconstruction_blueprint
   };
  }
 });
 assert.equal(result.status,'BOUNDED_STATIC_COLOR_IMPROVEMENT',JSON.stringify(result.history));
 assert.equal(result.attempts,2);
 assert.equal(result.accepted,2);
 assert.equal(replayCount,3,'One baseline plus two fresh Chrome captures');
 assert.equal(result.renderings,3);
 assert.ok(result.history[0].before.rgb_mae>result.history[0].after.rgb_mae);
 assert.ok(result.history[1].before.rgb_mae>result.history[1].after.rgb_mae);
 assert.ok(result.final.rgb_mae<result.baseline.rgb_mae);
 assert.equal(result.final.gate,'VISUAL_THRESHOLD_MET_STATIC_ONLY',JSON.stringify(result.final));
 assert.equal(result.product_ready,false);
 assert.equal(result.functional_equivalence_verified,false);
 assert.equal(result.independent_chrome_verified_by_module,false,
  'Module may not claim its injected renderer is always Chrome');
 assert.equal(requests,4,'One original + three local replay requests, zero external APIs');
 console.log(JSON.stringify({p5_bounded_chrome_repair:'PASS',source_capture:1,
  independent_chrome_replays:replayCount,synthetic_html_responses:requests,
  external_http_requests:0,patches:result.history.map(h=>h.patch.kind),
  baseline_mae:result.baseline.rgb_mae,final_mae:result.final.rgb_mae,
  final_static_gate:result.final.gate,product_ready:false}));
 // Separate screenshot-driven test: the saved geometry is deliberately stale,
 // so the old token-to-token comparison has NO candidate. Only screenshot
 // evidence may restore the visibly wrong painted aside after Chrome replay.
 const stale=structuredClone(reference);
 stale.boxes.find(box=>box.tag==='aside').background='rgb(0, 0, 0)';
 const beforeCalls=requests;
 let pixelReplays=0;
 const inferred=await runBoundedP4ColorRepair({
  referenceGeometry:stale,startingGeometry:stale,referencePng:sourcePng,
  enableScreenshotColorInference:true,maxAttempts:2,minMaeImprovement:0.5,
  renderCandidate:async (html,{attempt})=>{
   assert.equal(attempt,pixelReplays);
   pixelReplays++;
   const dir=join(root,'inferred-'+attempt);
   const url='https://p5-pixel-inference.example.org/';
   const rendered=await capture(dir,url,html);
   assert.equal(rendered.report.verdict,'PASS',JSON.stringify(rendered.report.failures));
   return {screenshot:await readFile(join(dir,'screenshot.png')),
    geometry:rendered.inspection.page.reconstruction_blueprint};
  }
 });
 assert.equal(inferred.status,'BOUNDED_STATIC_COLOR_IMPROVEMENT',JSON.stringify(inferred.history));
 assert.equal(inferred.accepted,1);
 assert.equal(inferred.history[0].patch.kind,'screenshot-uniform-region-color');
 assert.ok(inferred.history[0].patch.reference_uniform_pct>=88);
 assert.ok(inferred.final.rgb_mae<inferred.baseline.rgb_mae);
 assert.equal(pixelReplays,2,'Original page was NOT revisited; fresh baseline plus inferred patch');
 assert.equal(requests-beforeCalls,2,'Only synthetic generated HTML replays');
 assert.equal(inferred.product_ready,false);
 console.log(JSON.stringify({p5_screenshot_inferred_chrome:'PASS',
  accepted_patches:inferred.accepted,original_revisited:false,
  synthetic_replays:pixelReplays,external_requests:0,
  initial_mae:inferred.baseline.rgb_mae,final_mae:inferred.final.rgb_mae,
  product_ready:inferred.product_ready}));
 // Final vertical acceptance: saved local run -> opt-in offline reviewer ->
 // fixed synthetic Chrome address -> improved HTML and disk receipt. This
 // copies only synthetic fixture evidence; no owner data is included in CI.
 const savedRoot=join(root,'saved');
 const store=makeStore(savedRoot);await store.init();
 const meta=await store.create({target_url:target,mode:'static-visual'});
 await store.saveReport(meta.id,{verdict:'PASS',screenshot_saved:true,
  reconstruction_available:true});
 await store.saveInspection(meta.id,{mode:'static-visual',
  page:{reconstruction_blueprint:stale}});
 await store.saveComparison(meta.id,{schema_version:2,ignored_notice_area:false});
 await writeFile(join(store.pathFor(meta.id),'screenshot.png'),sourcePng);
 await store.update(meta.id,{status:'completed',verdict:'PASS'});
 const callsBeforeSaved=requests;
 const stored=await reviewSavedP5ColorRepair({store,id:meta.id,browserPath:chrome});
 assert.equal(stored.status,'BOUNDED_STATIC_COLOR_IMPROVEMENT');
 assert.equal(stored.accepted,1);
 assert.equal(stored.renderings,2);
 assert.equal(stored.downloadable_improved_html,true);
 assert.equal(stored.external_requests_issued,0);
 assert.equal(stored.original_capture_reexecuted,false);
 assert.equal(requests,callsBeforeSaved,'Independent saved replay does not hit source relay');
 assert.deepEqual(await readFile(join(store.pathFor(meta.id),'screenshot.png')),sourcePng);
 const receipt=JSON.parse(await readFile(join(store.pathFor(meta.id),'color-repair.json'),'utf8'));
 assert.equal(receipt.status,stored.status);
 const delivered=await readFile(join(store.pathFor(meta.id),'color-repair.html'),'utf8');
 assert.match(delivered,/script-src &#39;none&#39;/);
 assert.doesNotMatch(delivered,/<script\b|https?:\/\//i);
 assert.equal((await store.get(meta.id)).status,'completed');
 console.log(JSON.stringify({p5_saved_screenshot_repair_chrome:'PASS',
  accepted_patch:receipt.history[0].patch.kind,
  replay_count:receipt.renderings,original_site_refetched:false,
  original_files_overwritten:false,product_ready:false}));
}finally{
 await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
