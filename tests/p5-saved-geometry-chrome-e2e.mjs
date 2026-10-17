// End-to-end stored owner-authored P4 draft -> independent actual Chrome capture
// -> unique visible-region correspondence -> 2 bounded x/w edits -> safe HTML.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeStore} from '../studio/core.mjs';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {saveIndependentDraftBundle} from '../studio/independent-draft.mjs';
import {reviewSavedP5GeometryRepair} from '../studio/p5-saved-geometry-repair.mjs';

const browser=process.env.CHROME_BIN;
if(!browser)throw Error('CHROME_BIN required');
const root=await mkdtemp(join(tmpdir(),'rea-f5-saved-geometry-'));
const fixture='<html><head><meta charset="utf-8"><style>'+
 'html,body{margin:0}body{height:900px;background:rgb(231,235,241)}'+
 'aside{position:absolute;left:40px;top:50px;width:260px;height:480px;background:rgb(255,255,255)}'+
 'main{position:absolute;left:420px;top:50px;width:370px;height:480px;background:rgb(186,218,239)}'+
 '</style></head><body><aside></aside><main></main></body></html>';
let syntheticResponses=0,offlineCaptures=0;
async function capture(url,dir,html){
 await mkdir(dir,{recursive:true,mode:0o700});
 const result=await runDynamicAnalysis({target:url,browserPath:browser,dir,scriptsDisabled:true,
  relay:async requested=>{
   assert.equal(requested,url,'Never resolve or request any unapproved origin');
   syntheticResponses++;
   return {status:200,contentType:'text/html; charset=utf-8',
    body:Buffer.from(html,'utf8')};
  }});
 assert.equal(result.report?.verdict,'PASS',JSON.stringify(result.report?.failures));
 return result;
}
try{
 const target='https://synthetic-owner-source.example.org/';
 const originalDir=join(root,'source');
 const sourceCapture=await capture(target,originalDir,fixture);
 const reference=sourceCapture.inspection.page.reconstruction_blueprint;
 assert.ok(reference.boxes.some(b=>b.tag==='aside'));
 const uploaded=structuredClone(reference);
 const aside=uploaded.boxes.find(b=>b.tag==='aside');
 aside.x+=28;aside.w+=54;
 const store=makeStore(join(root,'runs'));
 await store.init();
 const meta=await store.create({target_url:target,mode:'static-visual'});
 await store.saveReport(meta.id,{verdict:'PASS',screenshot_saved:true,reconstruction_available:true});
 await store.saveInspection(meta.id,{mode:'static-visual',
  page:{reconstruction_blueprint:reference}});
 await store.saveComparison(meta.id,{schema_version:2,ignored_notice_area:false});
 const originalPng=await readFile(join(originalDir,'screenshot.png'));
 await writeFile(join(store.pathFor(meta.id),'screenshot.png'),originalPng);
 await store.update(meta.id,{status:'completed'});
 const stored=await saveIndependentDraftBundle({store,id:meta.id,
  originalGeometry:reference,bundle:{confirm:'store-scriptless-p4-draft',geometry:uploaded}});
 assert.equal(stored.status,'STORED_UNVERIFIED');
 const originalInspection=await readFile(join(store.pathFor(meta.id),'inspection.json'));
 const run=await reviewSavedP5GeometryRepair({store,id:meta.id,browserPath:browser,
  replayExecutor:async({target:url,dir,relay,scriptsDisabled})=>{
   offlineCaptures++;
   assert.equal(url,'https://p5-saved-geometry-offline.example.org/');
   assert.equal(scriptsDisabled,true);
   const html=(await relay(url)).body.toString();
   await assert.rejects(()=>relay(target),/P5_GEOMETRY_OFF_SCOPE/);
   assert.match(html,/script-src &#39;none&#39;/);
   assert.doesNotMatch(html,/<script\b|https?:\/\//i);
   // A true CDP run, not a fake geometry result.
   return capture(url,dir,html);
  }});
 assert.equal(run.status,'BOUNDED_STATIC_GEOMETRY_IMPROVEMENT',
  JSON.stringify(run.history));
 assert.equal(run.accepted,2);
 assert.equal(run.downloadable_improved_html,true);
 assert.equal(run.canonical_draft_preflight_verified,true);
 assert.equal(run.alignment?.status,'MATCHED_ONE_OBSERVED_DEFECT');
 assert.deepEqual(run.history.map(h=>h.patch.field),['x','w']);
 assert.ok(run.final.rgb_mae<run.baseline.rgb_mae);
 assert.equal(offlineCaptures,5,
  'One stored independent draft + canonical comparison + three patch engine Chrome replays');
 assert.equal(syntheticResponses,6,'Only source fixture plus five offline independent documents');
 assert.equal(run.original_site_refetched,false);
 assert.equal(run.product_ready,false);
 const resultHtml=await readFile(join(store.pathFor(meta.id),'geometry-repair.html'),'utf8');
 assert.match(resultHtml,/script-src &#39;none&#39;/);
 assert.doesNotMatch(resultHtml,/<script\b|https?:\/\//i);
 assert.deepEqual(await readFile(join(store.pathFor(meta.id),'screenshot.png')),originalPng);
 assert.deepEqual(await readFile(join(store.pathFor(meta.id),'inspection.json')),originalInspection);
 assert.equal((await store.get(meta.id)).status,'completed');
 const persisted=JSON.parse(await readFile(join(store.pathFor(meta.id),'geometry-repair.json'),'utf8'));
 assert.equal(persisted.accepted,2);
 assert.equal(persisted.stored_draft_sha256,stored.html_sha256);
 console.log(JSON.stringify({p5_saved_geometry_chrome:'PASS',
  accepted:run.accepted,fields:run.history.map(h=>h.patch.field),
  mae_before:run.baseline.rgb_mae,mae_after:run.final.rgb_mae,
  independent_replays:offlineCaptures,synthetic_responses:syntheticResponses,
  source_site_refetched:false,real_external_requests:0,product_ready:false}));
}finally{
 await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});
}
