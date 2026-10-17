// Verify captured CSS-only linear gradient background improves independent
// scriptless HTML in real Chrome, with all HTML provided in memory.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
import {compareChromeScreenshots} from '../studio/p5-visual-diff.mjs';

const chrome=process.env.CHROME_BIN;
if(!chrome)throw Error('REAL_CHROME_REQUIRED');
const root=await mkdtemp(join(tmpdir(),'p4-gradient-ci-'));
const originalHtml='<!doctype html><html><head><meta charset="utf-8"><style>'+
 'html,body{margin:0;padding:0}body{background:rgb(247,250,253);height:900px}'+
 'main{position:relative;width:1440px;height:900px;background:rgb(247,250,253)}'+
 'section{position:absolute;left:160px;top:140px;width:700px;height:390px;'+
 'background-image:linear-gradient(90deg, rgb(16, 50, 120) 0%, rgb(60, 145, 218) 100%)}'+
 '</style></head><body><main><section></section></main></body></html>';
let served=0;
async function capture(name,html){
 const dir=join(root,name);await mkdir(dir,{mode:0o700});
 const target='https://synthetic-p4-gradient-'+name+'.example.org/';
 const res=await runDynamicAnalysis({target,browserPath:chrome,dir,scriptsDisabled:true,
  relay:async requested=>{
   assert.equal(requested,target);
   served++;
   return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(html)};
  }});
 assert.equal(res.report.verdict,'PASS',JSON.stringify(res.report.failures));
 assert.equal(res.report.scripts_executed,false);
 return {image:await readFile(join(dir,'screenshot.png')),
  geometry:res.inspection?.page?.reconstruction_blueprint};
}
try{
 const src=await capture('source',originalHtml);
 const panel=src.geometry?.boxes?.find(v=>v.tag==='section');
 assert.ok(panel,'Chrome must observe large section painted using gradient only');
 assert.match(panel.background_image,/^linear-gradient\(90deg, rgb\(16, 50, 120\) 0%, rgb\(60, 145, 218\) 100%\)$/);
 const legacy=structuredClone(src.geometry);
 for(const x of legacy.boxes)delete x.background_image;
 const legacyHtml=generateP4Reconstruction(legacy);
 const observedHtml=generateP4Reconstruction(src.geometry);
 assert.match(observedHtml,/background-image:linear-gradient\(90deg, rgb\(16, 50, 120\) 0%, rgb\(60, 145, 218\) 100%\)/);
 assert.notEqual(legacyHtml,observedHtml);
 assert.doesNotMatch(observedHtml,/<script\b|<iframe\b|https?:\/\//i);
 const prior=await capture('legacy',legacyHtml);
 const current=await capture('observed',observedHtml);
 const baseline=compareChromeScreenshots(src.image,prior.image,{stride:4});
 const improved=compareChromeScreenshots(src.image,current.image,{stride:4});
 assert.equal(baseline.dimensions_equal,true);
 assert.equal(improved.dimensions_equal,true);
 assert.equal(improved.coverage_pct,100);
 assert.ok(improved.rgb_mae+1<baseline.rgb_mae,
  JSON.stringify({legacy_mae:baseline.rgb_mae,observed_mae:improved.rgb_mae}));
 assert.equal(served,3);
 console.log(JSON.stringify({p4_gradient_chrome:'PASS',
  observed_sections:1,legacy_rgb_mae:baseline.rgb_mae,
  measured_rgb_mae:improved.rgb_mae,
  improvement_verified:true,independent_replays:2,
  external_network_requests:0,scripts_executed:false,
  real_site_or_backend_parity:false}));
}finally{
 await rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
