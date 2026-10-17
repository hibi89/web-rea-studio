// Real isolated Chrome renders anonymized saved-F3-Q1 HTML, not the source site.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {runDynamicAnalysis,screenshotPngDimensions} from '../studio/dynamic-browser.mjs';
import {buildPassiveWireframe} from '../studio/f3-q1-wireframe.mjs';
const browser=process.env.CHROME_BIN;
if(!browser)throw Error('F3_Q1_WIREFRAME_REAL_CHROME_REQUIRED');
const root=await mkdtemp(join(tmpdir(),'rea-f3-q1-wireframe-chrome-'));
const inspection={mode:'dynamic-passive',page:{interaction_inventory:{
 source:'passive-controls',controls:[
  {kind:'button',label:'private',rect:{x:4,y:6,width:100,height:40}},
  {kind:'link',label:'private-link',rect:{x:4,y:55,width:100,height:40}},
  {kind:'input',type:'password',rect:{x:4,y:106,width:100,height:40}}
]}},network:[
 {kind:'fetch-attempt',scope:'other-origin',host:'api.owner.example.org'},
 {kind:'fetch-rejected',scope:'other-origin',host:'api.owner.example.org'}]};
const report={analysis_mode:'dynamic-passive',verdict:'FAIL',
 fetch_attempts:1,fetch_rejections:1,resource_requests:0,
 application_fetch_error_visible:true};
const {status,html,receipt}=buildPassiveWireframe({
 mode:'dynamic-passive',inspection,report,
 diagnosis:{diagnosis:'PASSIVE_EXTERNAL_FETCH_REJECTED'}});
assert.equal(status,'OFFLINE_NONINTERACTIVE_PREVIEW');
assert.equal(receipt.sha256,createHash('sha256').update(html).digest('hex'));
const target='https://anonymous-local-fixture.example.org/';
let localHtmlRequests=0;
try{
 const {report:render,inspection:rendered}=await runDynamicAnalysis({
  target,browserPath:browser,dir:root,scriptsDisabled:true,
  relay:async request=>{
   assert.equal(request,target,'No network resources are permitted');
   localHtmlRequests++;
   return {status:200,contentType:'text/html; charset=utf-8',
    body:Buffer.from(html,'utf8')};
  }
 });
 assert.equal(render.verdict,'PASS',JSON.stringify(render.failures));
 assert.equal(render.scripts_executed,false);
 assert.equal(localHtmlRequests,1);
 assert.equal(rendered.page.interaction_inventory.controls.length,0,
  'Wireframe must contain no native controls or links');
 assert.equal(rendered.exploration.dependencies.causal_links_verified,0);
 assert.equal(rendered.page.title,'REA Offline Presence Outline — NOT A REPLICA');
 const screenshot=await readFile(join(root,'screenshot.png'));
 const size=screenshotPngDimensions(screenshot);
 assert.ok(size.width>=1000&&size.height>=350,JSON.stringify(size));
 assert.equal(receipt.original_site_look_and_feel_verified,false);
 assert.equal(receipt.chrome_render_verified_by_this_receipt,false);
 console.log(JSON.stringify({f3_q1_anonymous_wireframe_chrome:'PASS',
  observed_categories:receipt.categories.map(x=>x.category),
  rendered_native_controls:0,local_document_replies:localHtmlRequests,
  external_requests:0,screenshot_px:[size.width,size.height],
  html_sha256:receipt.sha256,original_site_parity:false}));
}finally{await rm(root,{recursive:true,force:true,maxRetries:3,retryDelay:120});}
