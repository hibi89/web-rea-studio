// Real headless Chrome acceptance gate for P4. In-memory fixture only.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis,screenshotPngDimensions} from '../studio/dynamic-browser.mjs';
import {generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('CHROME_BIN required: real-browser check cannot be skipped');
const target='https://p4-fixture.example.org/';
const fixture="<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\"><title>P4 controlled layout</title><style>*{box-sizing:border-box}html,body{margin:0}body{font-family:Arial;background:rgb(244,245,253)}aside{position:absolute;left:0;top:0;width:198px;height:1550px;background:rgb(255,255,255)}main{position:absolute;left:198px;top:0;width:1030px;min-height:1550px;padding:28px;background:rgb(239,241,253)}header{height:85px;background:rgb(239,241,253)}h1{margin:0;color:rgb(31,32,58);font-size:30px}article{display:inline-block;vertical-align:top;width:435px;height:490px;margin:10px;background:rgb(255,255,255);border-radius:12px}section{margin-top:12px}</style><script>document.body.dataset.executed=\"YES\";document.title=\"JAVASCRIPT RAN\";</script></head><body><aside></aside><main><header><h1>대시보드</h1></header><section><article></article><article></article></section><section><article></article><article></article></section></main></body></html>";
const dir=await mkdtemp(join(tmpdir(),'webrea-p4-ci-'));
let relayCalls=0;
try{
 const {report,inspection}=await runDynamicAnalysis({
  target,browserPath,dir,scriptsDisabled:true,
  relay:async requestUrl=>{
   relayCalls++;
   assert.equal(requestUrl,target,'Unexpected outbound resource');
   return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(fixture,'utf8')};
  }
 });
 assert.equal(report.verdict,'PASS',JSON.stringify(report.failures));
 assert.equal(report.analysis_mode,'static-visual');
 assert.equal(report.scripts_executed,false);
 assert.equal(report.application_render_status,'not-executed');
 assert.equal(inspection.page.title,'P4 controlled layout');
 assert.equal(relayCalls,1);
 assert.ok(report.screenshot_saved);
 assert.ok(report.screenshot_width>=1400);
 assert.ok(report.screenshot_height>=1500,'Full-page capture should include lower cards');
 assert.ok(report.screenshot_height<=4000);
 assert.equal(report.screenshot_truncated,false);
 const png=await readFile(join(dir,'screenshot.png'));
 assert.deepEqual(screenshotPngDimensions(png),{width:report.screenshot_width,height:report.screenshot_height});
 const geom=inspection.page.reconstruction_blueprint;
 assert.ok(geom,'Real browser P4 geometry must be captured');
 assert.ok(geom.boxes.length>=5,JSON.stringify(geom.boxes));
 assert.ok(geom.titles.some(t=>t.text==='대시보드'));
 const reconstructed=generateP4Reconstruction(geom);
 assert.match(reconstructed,/대시보드/);
 assert.match(reconstructed,/script-src &#39;none&#39;/);
 assert.doesNotMatch(reconstructed,/<script\b|<iframe\b|https?:\/\//);
 assert.ok(!reconstructed.includes('JAVASCRIPT RAN'));
 console.log(JSON.stringify({chrome_e2e:'PASS',screenshot_px:[report.screenshot_width,report.screenshot_height],
  geometry_regions:geom.boxes.length,titles:geom.titles.length,external_network_requests:0,
  independent_html_bytes:Buffer.byteLength(reconstructed)}));
}finally{await rm(dir,{recursive:true,force:true});}
