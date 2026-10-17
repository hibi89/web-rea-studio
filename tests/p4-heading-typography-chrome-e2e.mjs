// Real Chrome, scriptless, in-memory source-vs-generated heading layout
// verification. Does not fetch a live website or expand an allowlist.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
import {compareChromeScreenshots} from '../studio/p5-visual-diff.mjs';

const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('REAL_CHROME_REQUIRED');
const root=await mkdtemp(join(tmpdir(),'webrea-p4-heading-ci-'));
const page='<!doctype html><html lang="en"><head><meta charset="utf-8"><style>'+
 'html,body{margin:0;padding:0}body{width:1440px;height:900px;background:rgb(247,249,253);font-family:Arial,sans-serif}'+
 'main{position:relative;width:1440px;height:900px;background:rgb(247,249,253)}'+
 'h1{position:absolute;left:60px;top:58px;margin:0;width:210px;font-family:Arial,sans-serif;'+
 'font-size:32px;font-weight:700;line-height:37px;white-space:normal;text-align:center;'+
 'color:rgb(27,34,57)}'+
 '</style></head><body><main><h1>Measured heading wraps across several lines</h1></main></body></html>';
let relayed=0;
async function capture(id,html){
 const dir=join(root,id);await mkdir(dir,{mode:0o700});
 const target='https://p4-typography-'+id+'.example.org/';
 const result=await runDynamicAnalysis({target,browserPath,dir,scriptsDisabled:true,
  relay:async url=>{
   assert.equal(url,target);
   relayed++;
   return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(html)};
  }});
 assert.equal(result.report.verdict,'PASS',JSON.stringify(result.report.failures));
 assert.equal(result.report.scripts_executed,false);
 return {image:await readFile(join(dir,'screenshot.png')),
  geometry:result.inspection?.page?.reconstruction_blueprint};
}
try{
 const original=await capture('source',page);
 const heading=original.geometry?.titles?.find(t=>t.tag==='h1');
 assert.ok(heading,'Real Chrome must identify the heading');
 assert.ok(heading.h>=70,'Heading wraps into multiple rows');
 assert.equal(heading.white_space,'normal');
 assert.equal(heading.line_height,'37px');
 assert.equal(heading.text_align,'center');
 const legacy=structuredClone(original.geometry);
 for(const t of legacy.titles){
  delete t.white_space;delete t.line_height;delete t.text_align;
 }
 const priorHtml=generateP4Reconstruction(legacy);
 const enhancedHtml=generateP4Reconstruction(original.geometry);
 assert.notEqual(priorHtml,enhancedHtml);
 assert.match(enhancedHtml,/white-space:normal;line-height:37px;text-align:center;/);
 assert.doesNotMatch(enhancedHtml,/<script\b|<iframe\b|https?:\/\//);
 const oldCapture=await capture('legacy',priorHtml);
 const improved=await capture('measured',enhancedHtml);
 const old=compareChromeScreenshots(original.image,oldCapture.image,{stride:4});
 const next=compareChromeScreenshots(original.image,improved.image,{stride:4});
 assert.equal(old.dimensions_equal,true);
 assert.equal(next.dimensions_equal,true);
 assert.equal(next.coverage_pct,100);
 assert.ok(next.rgb_mae+0.05<old.rgb_mae,
  JSON.stringify({legacy_mae:old.rgb_mae,measured_mae:next.rgb_mae}));
 assert.equal(relayed,3,'One original + two independent in-memory Chrome captures');
 console.log(JSON.stringify({p4_heading_typography_chrome:'PASS',
  title_lines:'wrapped',heading_box_height:heading.h,
  legacy_rgb_mae:old.rgb_mae,measured_rgb_mae:next.rgb_mae,
  mae_improved:true,independent_replays:2,external_network_requests:0,
  scripts_executed:false,backend_or_functional_parity:false}));
}finally{
 await rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
