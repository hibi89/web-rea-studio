// Isolated, scriptless Chrome renders same anonymous 3x3 geometric bins at 2 sizes.
// This confirms responsive behavior of *generated* HTML, not source mobile parity.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis,screenshotPngDimensions} from '../studio/dynamic-browser.mjs';
import {buildAnonymousGeometryPreview} from '../studio/f3-q1-geometry-preview.mjs';
const browser=process.env.CHROME_BIN;
if(!browser)throw Error('F3_Q1_COARSE_GEOMETRY_REQUIRES_CHROME');
const root=await mkdtemp(join(tmpdir(),'rea-geometry-two-views-'));
const inspection={mode:'dynamic-passive',
 page:{frontend_blueprint:{source:'computed-dom',viewport:{w:1440,h:900}},
  interaction_inventory:{source:'passive-controls',verification:'presence-only',
   actions_executed:0,counts:{total:3},controls:[
    {kind:'button',rect:{x:50,y:70,width:180,height:34}},
    {kind:'link',rect:{x:1030,y:180,width:210,height:34}},
    {kind:'input',rect:{x:420,y:610,width:220,height:34}}
   ]}},
 screen_capture:{width:1440,height:900},
 network:[
  {kind:'fetch-attempt',scope:'other-origin',host:'api.source.example.org'},
  {kind:'fetch-rejected',scope:'other-origin',host:'api.source.example.org'}
 ]};
const report={verdict:'FAIL',analysis_mode:'dynamic-passive',
 fetch_attempts:1,fetch_rejections:1,screenshot_width:1440,screenshot_height:900};
const {status,html,receipt}=buildAnonymousGeometryPreview({
 mode:'dynamic-passive',inspection,report,
 diagnosis:{diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED'}});
assert.equal(status,'OFFLINE_COARSE_GEOMETRY_PREVIEW');
let memoryResponses=0;
try{
 for(const vp of [{width:1440,height:900},{width:390,height:844}]){
  const dir=join(root,String(vp.width));await mkdir(dir);
  const target='https://isolated-wireframe-fixture.example.org/';
  const result=await runDynamicAnalysis({
   target,browserPath:browser,dir,scriptsDisabled:true,offlineViewport:vp,
   relay:async url=>{
    assert.equal(url,target,'Unapproved resource requested');
    memoryResponses++;
    return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(html)};
   }
  });
  assert.equal(result.report.verdict,'PASS',JSON.stringify(result.report.failures));
  assert.equal(result.report.scripts_executed,false);
  assert.equal(result.inspection.page.interaction_inventory.controls.length,0);
  assert.equal(result.inspection.page.title,'REA Coarse Presence Zones — NOT A REPLICA');
  assert.equal(result.inspection.exploration.dependencies.causal_links_verified,0);
  const size=screenshotPngDimensions(await readFile(join(dir,'screenshot.png')));
  assert.equal(size.width,vp.width);
  assert.ok(size.height>=vp.height);
  assert.equal(memoryResponses,vp.width===1440?1:2);
  console.log(JSON.stringify({f3_q1_geometry_chrome:'PASS',view:vp,
   screenshot_px:[size.width,size.height],native_controls:0,
   external_requests:0,source_mobile_layout_verified:false}));
 }
 assert.equal(memoryResponses,2);
 console.log(JSON.stringify({f3_q1_geometry_two_viewports:'PASS',
  rendered_views:2,source_site_requests:0,source_parity:false,
  receipt_sha256:receipt.sha256}));
}finally{await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});}
