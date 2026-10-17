// Scriptless synthetic card-shadow fidelity test with real isolated Chrome.
// Exactly one in-memory original and two independent generated replays.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runDynamicAnalysis} from '../studio/dynamic-browser.mjs';
import {generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
import {compareChromeScreenshots} from '../studio/p5-visual-diff.mjs';

const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('REAL_CHROME_REQUIRED');
const root=await mkdtemp(join(tmpdir(),'rea-p4-shadow-'));
const page='<!doctype html><html><head><meta charset="utf-8"><style>'+
 'html,body{margin:0}body{background:rgb(245,248,251);height:900px}'+
 'main{position:relative;width:1440px;height:900px;background:rgb(245,248,251)}'+
 'article{position:absolute;left:190px;top:160px;width:480px;height:345px;'+
 'background:rgb(255,255,255);border-radius:12px;'+
 'box-shadow:rgba(18, 32, 65, 0.52) 0px 18px 45px 0px}'+
 '</style></head><body><main><article></article></main></body></html>';
let responses=0;
async function capture(key,html){
 const dir=join(root,key);await mkdir(dir,{mode:0o700});
 const target='https://p4-shadow-'+key+'.example.org/';
 const r=await runDynamicAnalysis({target,browserPath,dir,scriptsDisabled:true,
  relay:async requested=>{
   assert.equal(requested,target,'Unexpected host request');
   responses++;
   return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(html,'utf8')};
  }});
 assert.equal(r.report.verdict,'PASS',JSON.stringify(r.report.failures));
 assert.equal(r.report.scripts_executed,false);
 return {image:await readFile(join(dir,'screenshot.png')),
  geometry:r.inspection?.page?.reconstruction_blueprint};
}
try{
 const original=await capture('source',page);
 const rect=original.geometry?.boxes?.find(x=>x.tag==='article');
 assert.ok(rect,'Chrome must observe the card shape');
 assert.match(rect.box_shadow,/rgba\(18, 32, 65, 0\.52\)/);
 const legacy=structuredClone(original.geometry);
 for(const b of legacy.boxes)delete b.box_shadow;
 const oldHTML=generateP4Reconstruction(legacy);
 const newHTML=generateP4Reconstruction(original.geometry);
 assert.match(newHTML,/box-shadow:rgba\(18, 32, 65, 0\.52\)/);
 assert.notEqual(oldHTML,newHTML);
 assert.doesNotMatch(newHTML,/<script\b|<iframe\b|https?:\/\//);
 const [before,after]=await Promise.all([
  capture('legacy',oldHTML),capture('measured',newHTML)
 ]);
 const old=compareChromeScreenshots(original.image,before.image,{stride:4});
 const next=compareChromeScreenshots(original.image,after.image,{stride:4});
 assert.equal(next.dimensions_equal,true);
 assert.equal(next.coverage_pct,100);
 assert.ok(next.rgb_mae+0.04<old.rgb_mae,
  JSON.stringify({legacy_mae:old.rgb_mae,measured_mae:next.rgb_mae}));
 assert.equal(responses,3,'Only three offline in-memory HTML responses');
 console.log(JSON.stringify({p4_card_shadow_chrome:'PASS',
  card_count:1,legacy_rgb_mae:old.rgb_mae,measured_rgb_mae:next.rgb_mae,
  mae_improved:true,independent_replays:2,external_requests:0,
  scripts_executed:false,real_site_or_api_parity:false}));
}finally{
 await rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:100});
}
