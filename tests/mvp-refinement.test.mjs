import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleMvpRefinement,generateBoundedFaithfulCandidates} from '../studio/mvp-refinement.mjs';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',sha=x=>createHash('sha256').update(x).digest('hex');
const html='<!doctype html><html><head><title>REA MVP · faithful</title><style>.label{color:#000}</style></head><body><div class="label">Hello</div><div class="scope">original functions unverified</div></body></html>';
function png(n=230){
 const width=32,height=32,ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
 const rows=Buffer.alloc((width*3+1)*height);
 for(let y=0;y<height;y++)rows.fill(n,y*(width*3+1)+1,(y+1)*(width*3+1));
 const chunk=(tag,b)=>{const h=Buffer.alloc(8);h.writeUInt32BE(b.length);h.write(tag,4);return Buffer.concat([h,b,Buffer.alloc(4)])};
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]);
}
const original=png(240),baseline=png(180),noisy=png(100),near=png(230),h=Buffer.from(html);
function respond(res,status,value,type='application/json; charset=utf-8',headers={}){
 const data=Buffer.isBuffer(value)?value:Buffer.from(type.startsWith('application/json')?JSON.stringify(value):value);
 res.writeHead(status,{'Content-Type':type,'Content-Length':data.length,...headers});res.end(data);
}
async function setup(action){
 const root=await mkdtemp(join(tmpdir(),'rea-mvp-refine-')),base=join(root,id,'mvp');
 await mkdir(base,{recursive:true});
 await writeFile(join(base,'faithful.html'),h);
 await writeFile(join(base,'manifest.json'),JSON.stringify({version:1,run_id:id,modes:{faithful:{sha256:sha(h),bytes:h.length}}}));
 await writeFile(join(base,'faithful-comparison.png'),baseline);
 // delta 60 means zero matching pixels, near 10 means all matching pixels, and MAE 10.
 await writeFile(join(base,'faithful-comparison.json'),JSON.stringify({
  status:'MEASURED',run_id:id,html_sha256:sha(h),original:{sha256:sha(original)},generated:{sha256:sha(baseline)},
  metrics:{pixel_match_pct:0,rgb_mae:60}
 }));
 let count=0,chosen='label-down-4',allBad=false;
 const store={pathFor:()=>join(root,id),get:async()=>({mode:'static-visual',status:'completed'}),
  getInspection:async()=>({mode:'static-visual'}),
  getReport:async()=>({screenshot_saved:true,reconstruction_available:true,screenshot_sha256:sha(original)}),
  getScreenshot:async()=>original};
 let port=0;
 const browser=async({relay,dir,target,scriptsDisabled,offlineViewport})=>{
  count++;assert.equal(scriptsDisabled,true);assert.equal(target,'https://mvp-faithful-offline.example.org/');
  assert.deepEqual(offlineViewport,{width:1440,height:900});
  await assert.rejects(()=>relay('https://unauthorized.example/'),/MVP_REFINEMENT_OFFLINE_ONLY/);
  const doc=(await relay(target)).body.toString();
  const picture=doc.includes('data-mvp-refinement="'+chosen+'"')&&!allBad?near:noisy;
  await writeFile(join(dir,'screenshot.png'),picture);
  return {report:{verdict:'PASS',scripts_executed:false,screenshot_saved:true}};
 };
 const server=createServer(async(req,res)=>{
  try{
   const handled=await handleMvpRefinement({req,res,path:new URL(req.url,'http://localhost').pathname,store,
    respond,browserPath:'/synthetic/chrome',replayExecutor:browser,studioPort:port});
   if(!handled)respond(res,404,{error:'unknown_route'});
  }catch(e){respond(res,500,{error:'internal_error'});}
 });
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port;
  await action({url:'http://127.0.0.1:'+port+'/api/runs/'+id,root,base,
   calls:()=>count,setBad:v=>allBad=v});
 }finally{await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
}
test('candidate patches are four bounded text transforms and do not remove disclosures',()=>{
 const arr=generateBoundedFaithfulCandidates(html);
 assert.deepEqual(arr.map(x=>x.id),['label-up-4','label-down-4','label-left-4','label-right-4']);
 for(const p of arr){assert.match(p.html,/original functions unverified/);assert.match(p.html,/<style data-mvp-refinement/);}
 assert.throws(()=>generateBoundedFaithfulCandidates('<html></html>'),/MVP_REFINEMENT_UNTRUSTED_HTML/);
});
test('panel geometry targets the largest eligible non-canvas region',()=>{
 const withPanels=html.replace('<div class="label">',
  '<main class="page">'+
  '<div class="region" aria-hidden="true" style="left:0px;top:0px;width:1440px;height:900px;background:#fff;"></div>'+
  '<div class="region" aria-hidden="true" style="left:100px;top:120px;width:400px;height:300px;background:#ddd;"></div>'+
  '<div class="region" aria-hidden="true" style="left:500px;top:130px;width:650px;height:320px;background:#eee;"></div>'+
  '<div class="label">');
 const patches=generateBoundedFaithfulCandidates(withPanels);
 assert.equal(patches.length,8);
 assert.deepEqual(patches.slice(4).map(p=>p.id),['region-up-4','region-down-4','region-left-4','region-right-4']);
 for(const patch of patches.slice(4)){
  assert.match(patch.html,/\.page > \.region:nth-child\(3\)/);
  assert.doesNotMatch(patch.html,/\.region\{transform:/);
  assert.match(patch.html,/original functions unverified/);
 }
 const backgroundOnly=html.replace('<div class="label">',
  '<main class="page"><div class="region" aria-hidden="true" style="left:0px;top:0px;width:1440px;height:900px;background:#fff;"></div><div class="label">');
 assert.equal(generateBoundedFaithfulCandidates(backgroundOnly).length,4);
});
test('opt-in refinement chooses measured improvement, preserves faithful and requires integrity',async()=>{
 await setup(async({url,base,calls})=>{
  assert.equal((await fetch(url+'/mvp-refinement')).status,404);
  assert.equal((await fetch(url+'/mvp-refine')).status,405);
  assert.equal((await fetch(url+'/mvp-refine',{method:'POST'})).status,403);
  const headers={Origin:new URL(url).origin};
  let r=await fetch(url+'/mvp-refine',{method:'POST',headers});
  assert.equal(r.status,201,await r.text().catch(()=>'')); // receipt fetched via independent GET
  r=await fetch(url+'/mvp-refinement');assert.equal(r.status,200);
  const receipt=await r.json();
  assert.equal(receipt.status,'IMPROVED');assert.equal(receipt.candidate_id,'label-down-4');
  assert.equal(receipt.candidate_count,4);
  assert.deepEqual([receipt.before.pixel_match_pct,receipt.after.pixel_match_pct],[0,100]);
  assert.equal(receipt.source_site_refetched,false);
  assert.equal(await readFile(join(base,'faithful.html'),'utf8'),html);
  const refined=await fetch(url+'/mvp-refined');assert.equal(refined.status,200);
  assert.match(await refined.text(),/data-mvp-refinement="label-down-4"/);
  const download=await fetch(url+'/mvp-refined-download');assert.equal(download.status,200);
  assert.match(download.headers.get('content-disposition'),/attachment/);
  assert.equal((await fetch(url+'/mvp-refined-screenshot')).status,200);
  assert.equal(calls(),4);
  assert.equal((await fetch(url+'/mvp-refine',{method:'POST',headers})).status,409);
  assert.equal(calls(),4,'GET does not rerender');
  await writeFile(join(base,'faithful-refined.html'),'tampered');
  assert.equal((await fetch(url+'/mvp-refinement')).status,409);
  assert.equal((await fetch(url+'/mvp-refined-download')).status,409);
 });
});
test('no improvement yields a receipt but no misleading refined HTML/download',async()=>{
 await setup(async({url,calls,setBad})=>{
  setBad(true);
  const r=await fetch(url+'/mvp-refine',{method:'POST',headers:{Origin:new URL(url).origin}});
  assert.equal(r.status,201);
  const data=await r.json();
  assert.equal(data.status,'NO_IMPROVEMENT');
  assert.equal(data.candidate_id,null);assert.equal(data.after,null);
  assert.equal(calls(),4);
  assert.equal((await fetch(url+'/mvp-refined')).status,404);
  assert.equal((await fetch(url+'/mvp-refinement')).status,200);
 });
});
test('original/baseline evidence changes block refinement and all read-only results',async()=>{
 await setup(async({url,base,calls})=>{
  await writeFile(join(base,'faithful-comparison.png'),png(32));
  const r=await fetch(url+'/mvp-refine',{method:'POST',headers:{Origin:new URL(url).origin}});
  assert.equal(r.status,409);assert.equal(calls(),0);
 });
});
