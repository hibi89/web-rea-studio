// Isolated real Chrome proof: synthetic CSS-only bar chart observed vs
// independent static reconstruction. No remote origin or data/API requests.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
import {compareChromeScreenshots} from '../studio/p5-visual-diff.mjs';

const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('REAL_CHROME_REQUIRED');
const root=await mkdtemp(join(tmpdir(),'rea-p4-chart-'));
const heights=[76,173,112,246,157,208];
const bars=heights.map((height,index)=>'<div style="position:absolute;left:'+
 (34+index*84)+'px;bottom:32px;width:30px;height:'+height+
 'px;background:rgb(43,108,208);border-radius:0px"></div>').join('');
const html='<!doctype html><html><head><meta charset="utf-8"><style>'+
 'html,body{margin:0}body{background:rgb(245,248,252);height:900px}'+
 'main{position:relative;width:1440px;height:900px;background:rgb(245,248,252)}'+
 'section{position:absolute;left:160px;top:120px;width:650px;height:440px;background:rgb(255,255,255)}'+
 '</style></head><body><main><section>'+bars+'</section></main></body></html>';
let responses=0;
async function capture(name,markup){
 const directory=join(root,name);await mkdir(directory,{mode:0o700});
 const target='https://p4-chart-'+name+'.example.org/';
 const result=await runDynamicAnalysis({target,browserPath,dir:directory,scriptsDisabled:true,
  relay:async observed=>{
   assert.equal(observed,target,'unexpected external resource request');
   responses++;
   return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(markup)};
  }});
 assert.equal(result.report.verdict,'PASS',JSON.stringify(result.report.failures));
 assert.equal(result.report.scripts_executed,false);
 return {image:await readFile(join(directory,'screenshot.png')),
  geometry:result.inspection?.page?.reconstruction_blueprint};
}
try{
 const original=await capture('source',html);
 assert.equal(original.geometry?.primitives?.length,6,'six compact visible bars must be observed');
 const canonical=structuredClone(original.geometry);
 delete canonical.primitives;
 const oldHtml=generateP4Reconstruction(canonical);
 const newHtml=generateP4Reconstruction(original.geometry);
 assert.equal((newHtml.match(/class="primitive"/g)||[]).length,6);
 assert.equal((oldHtml.match(/class="primitive"/g)||[]).length,0);
 assert.doesNotMatch(newHtml,/<script\b|<iframe\b|https?:\/\//i);
 const oldImage=await capture('legacy',oldHtml);
 const newImage=await capture('measured',newHtml);
 const old=compareChromeScreenshots(original.image,oldImage.image,{stride:4});
 const current=compareChromeScreenshots(original.image,newImage.image,{stride:4});
 assert.equal(old.dimensions_equal,true);
 assert.equal(current.dimensions_equal,true);
 assert.equal(current.coverage_pct,100);
 assert.ok(current.rgb_mae+0.25<old.rgb_mae,
  JSON.stringify({old_rgb_mae:old.rgb_mae,new_rgb_mae:current.rgb_mae}));
 assert.equal(responses,3,'one original and two independent in-memory replays only');
 console.log(JSON.stringify({p4_compact_chart_chrome:'PASS',
  bars:original.geometry.primitives.length,legacy_rgb_mae:old.rgb_mae,
  measured_rgb_mae:current.rgb_mae,mae_improved:true,
  independent_replays:2,external_requests:0,scripts_executed:false,
  actual_site_or_chart_semantics_verified:false}));
}finally{
 await rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
