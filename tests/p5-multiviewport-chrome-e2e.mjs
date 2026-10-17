// True isolated Chrome proof that desktop visual improvement can be rejected
// when a separately captured narrower viewport becomes worse.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {runBoundedP4ColorRepair} from '../studio/p5-bounded-repair.mjs';

const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('CHROME_BIN required');
const root=await mkdtemp(join(tmpdir(),'rea-multiviewport-'));
const WIDE={width:1440,height:900},NARROW={width:900,height:900};
const fixture='<!doctype html><html><head><meta charset="utf-8"><style>'+
 'html,body{margin:0}body{height:900px;background:rgb(240,240,240)}'+
 'aside{position:absolute;left:40px;top:50px;width:240px;height:460px;background:white}'+
 'main{position:absolute;left:320px;top:50px;width:390px;height:460px;background:rgb(220,230,240)}'+
 '@media(max-width:1100px){aside{background:rgb(0,0,0)}}'+
 '</style></head><body><aside></aside><main></main></body></html>';
let intercepted=0;
async function replay(label,url,html,viewport){
 const dir=join(root,label);await mkdir(dir,{recursive:true});
 const result=await runDynamicAnalysis({target:url,browserPath,dir,
  scriptsDisabled:true,offlineViewport:viewport,
  relay:async request=>{
   intercepted++;
   assert.equal(request,url,'No off-origin or original-site network');
   return {status:200,contentType:'text/html; charset=utf-8',
    body:Buffer.from(html,'utf8')};
  }});
 assert.equal(result.report.verdict,'PASS',JSON.stringify(result.report.failures));
 assert.equal(result.report.screenshot_width,viewport.width);
 assert.equal(result.report.screenshot_height,viewport.height);
 assert.equal(result.inspection.page.reconstruction_blueprint.viewport.width,viewport.width);
 return {screenshot:await readFile(join(dir,'screenshot.png')),
  geometry:result.inspection.page.reconstruction_blueprint};
}
try{
 const wideSource=await replay('source-wide','https://p5-viewport-source.example.org/',
  fixture,WIDE);
 const narrowSource=await replay('source-narrow','https://p5-viewport-source.example.org/',
  fixture,NARROW);
 const wideAside=wideSource.geometry.boxes.find(b=>b.tag==='aside');
 const narrowAside=narrowSource.geometry.boxes.find(b=>b.tag==='aside');
 assert.ok(wideAside&&narrowAside,'Both Chrome views must observe the aside');
 assert.notEqual(wideAside.background,narrowAside.background,'CSS media query must change evidence');
 const broken=structuredClone(wideSource.geometry);
 broken.boxes.find(b=>b.tag==='aside').background=narrowAside.background;
 let wideRenders=0,narrowRenders=0;
 const result=await runBoundedP4ColorRepair({
  referenceGeometry:wideSource.geometry,startingGeometry:broken,
  referencePng:wideSource.screenshot,maxAttempts:1,minMaeImprovement:0.5,
  renderCandidate:async (html,{attempt})=>{
   wideRenders++;
   return replay('generated-wide-'+attempt,'https://p5-viewport-replay.example.org/',html,WIDE);
  },
  regressionViews:[{name:'narrow',referenceGeometry:narrowSource.geometry,
   referencePng:narrowSource.screenshot,renderCandidate:async(html,{attempt})=>{
    narrowRenders++;
    return replay('generated-narrow-'+attempt,'https://p5-viewport-replay.example.org/',html,NARROW);
   }}]
 });
 assert.equal(result.status,'STOPPED_VIEWPORT_REGRESSION',JSON.stringify(result.history));
 assert.equal(result.accepted,0);
 assert.equal(result.attempts,1);
 assert.equal(wideRenders,2,'Chrome desktop baseline and improved proposal captured');
 assert.equal(narrowRenders,2,'Independent narrow baseline and harmful proposal captured');
 assert.equal(result.history[0].reason,'secondary_viewport_regression');
 const audit=result.history[0].secondary_views[0];
 assert.equal(audit.status,'regressed');
 assert.ok(audit.after.rgb_mae>audit.before.rgb_mae,'Narrow RGB MAE gets worse');
 assert.ok(result.history[0].after.rgb_mae<result.history[0].before.rgb_mae,
  'Desktop improvement must be real, not a synthetic assumption');
 assert.equal(result.product_ready,false);
 assert.equal(intercepted,6,'2 original in-memory documents + 4 generated replays only');
 assert.match(result.candidate_html,/background:rgb\(0, 0, 0\)/,
  'Return pre-patch HTML after rejected secondary viewport');
 console.log(JSON.stringify({p5_multiviewport_chrome:'PASS',
  desktop_mae_before:result.history[0].before.rgb_mae,
  desktop_mae_after:result.history[0].after.rgb_mae,
  narrow_mae_before:audit.before.rgb_mae,
  narrow_mae_after:audit.after.rgb_mae,
  decision:result.status,accepted:result.accepted,
  original_source_requests:0,synthetic_html_responses:intercepted,product_ready:false}));
}finally{await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
