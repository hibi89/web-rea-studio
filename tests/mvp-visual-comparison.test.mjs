import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleMvpVisualComparison} from '../studio/mvp-visual-comparison.mjs';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const digest=x=>createHash('sha256').update(x).digest('hex');
const geometryHtml='<!doctype html><html><body>Faithful offline</body></html>';
function png(width=1440,height=900,shade=225){
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
 const scanlines=Buffer.alloc((width*3+1)*height);
 for(let y=0;y<height;y++)scanlines.fill(shade,y*(width*3+1)+1,(y+1)*(width*3+1));
 const chunk=(tag,data)=>{const head=Buffer.alloc(8);head.writeUInt32BE(data.length,0);head.write(tag,4);return Buffer.concat([head,data,Buffer.alloc(4)])};
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),
  chunk('IDAT',deflateSync(scanlines)),chunk('IEND',Buffer.alloc(0))]);
}
const response=(res,code,data,type='application/json; charset=utf-8')=>{
 const bytes=Buffer.isBuffer(data)?data:Buffer.from(type.startsWith('application/json')?JSON.stringify(data):data);
 res.writeHead(code,{'Content-Type':type,'Content-Length':bytes.length});res.end(bytes);
};
async function serverTest(fn,{screenshot=true,size=[1440,900]}={}){
 const root=await mkdtemp(join(tmpdir(),'rea-mvp-compare-'));
 const base=join(root,id,'mvp');await mkdir(base,{recursive:true});
 const html=Buffer.from(geometryHtml);
 const artifact={version:1,run_id:id,scope:'saved-static-visual-offline-only',modes:{faithful:{sha256:digest(html),bytes:html.byteLength}}};
 await writeFile(join(base,'manifest.json'),JSON.stringify(artifact));
 await writeFile(join(base,'faithful.html'),html);
 let source=screenshot?png(...size):null,replica=png(),captures=0,unexpected=false;
 const store={pathFor:()=>join(root,id),get:async()=>({id,mode:'static-visual',status:'completed'}),
  getReport:async()=>({reconstruction_available:true,screenshot_saved:!!source,
   ...(source?{screenshot_sha256:digest(source)}:{})}),getScreenshot:async()=>source};
 let port;
 const executor=async({target,browserPath,dir,scriptsDisabled,offlineViewport,relay})=>{
  captures++;
  assert.equal(target,'https://mvp-faithful-offline.example.org/');
  assert.equal(browserPath,'/fake/chrome');
  assert.equal(scriptsDisabled,true);
  assert.deepEqual(offlineViewport,{width:1440,height:900});
  assert.equal((await relay(target)).body.toString(),geometryHtml);
  await assert.rejects(()=>relay('https://other.example.org/'),/MVP_OFFLINE_ONLY/);
  await writeFile(join(dir,'screenshot.png'),replica);
  return {report:{verdict:'PASS',screenshot_saved:true,scripts_executed:false}};
 };
 const http=createServer(async(req,res)=>{
  try{
   const handled=await handleMvpVisualComparison({req,res,path:new URL(req.url,'http://local').pathname,
    store,respond:response,studioPort:port,isBusy:()=>false,replayExecutor:executor,browserPath:'/fake/chrome'});
   if(!handled)response(res,404,{error:'not_found'});
  }catch(e){unexpected=true;response(res,500,{error:'internal_error'});}
 });
 try{
  await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));port=http.address().port;
  const url='http://127.0.0.1:'+port+'/api/runs/'+id;
  await fn({url,root,base,source:()=>source,replaceSource:x=>{source=x},replaceReplica:x=>{replica=x},
   calls:()=>captures,unexpected:()=>unexpected});
 }finally{
  await new Promise(resolve=>http.close(resolve));
  await rm(root,{recursive:true,force:true});
 }
}
test('explicit POST measures matching source and faithful Chrome screenshots, persisted read GET is zero-Chrome',async()=>{
 await serverTest(async({url,base,calls})=>{
  assert.equal((await fetch(url+'/mvp-comparison')).status,404);
  assert.equal((await fetch(url+'/mvp-compare')).status,405);
  assert.equal((await fetch(url+'/mvp-compare',{method:'POST'})).status,403);
  const opts={method:'POST',headers:{Origin:new URL(url).origin}};
  let r=await fetch(url+'/mvp-compare',opts);assert.equal(r.status,201,await r.text().catch(()=>'')); // body consumed below only in new request
  const read=await fetch(url+'/mvp-comparison');assert.equal(read.status,200);
  const receipt=await read.json();
  assert.equal(receipt.status,'MEASURED');
  assert.equal(receipt.metrics.pixel_match_pct,100);
  assert.equal(receipt.metrics.rgb_mae,0);
  assert.equal(receipt.source_site_refetched,false);
  const shot=await fetch(url+'/mvp-replica-screenshot');assert.equal(shot.status,200);
  assert.equal(digest(Buffer.from(await shot.arrayBuffer())),receipt.generated.sha256);
  assert.equal((await fetch(url+'/mvp-compare',opts)).status,409);
  assert.equal(calls(),1,'GET must not start Chrome again');
  await writeFile(join(base,'faithful.html'),'tampered');
  assert.equal((await fetch(url+'/mvp-comparison')).status,409);
  assert.equal((await fetch(url+'/mvp-replica-screenshot')).status,409);
 });
});
test('missing saved original screenshot does not launch Chrome or manufacture a score',async()=>{
 await serverTest(async({url,calls})=>{
  const r=await fetch(url+'/mvp-compare',{method:'POST',headers:{Origin:new URL(url).origin}});
  assert.equal(r.status,409);assert.equal((await r.json()).error,'original_screenshot_unavailable');
  assert.equal(calls(),0);
 },{screenshot:false});
});
test('mismatched capture dimensions yield visible comparison but no similarity percentage',async()=>{
 await serverTest(async({url,calls})=>{
  const r=await fetch(url+'/mvp-compare',{method:'POST',headers:{Origin:new URL(url).origin}});
  assert.equal(r.status,201);
  const result=await r.json();
  assert.equal(result.status,'DIMENSIONS_DIFFER');
  assert.equal(result.metrics,null);
  assert.deepEqual(result.original.height,1100);
  assert.equal(result.generated.height,900);
  assert.equal((await fetch(url+'/mvp-replica-screenshot')).status,200);
  assert.equal(calls(),1);
 },{size:[1440,1100]});
});
test('source evidence changed after measured comparison revokes read-only receipt and screenshot',async()=>{
 await serverTest(async({url,replaceSource,calls})=>{
  const opts={method:'POST',headers:{Origin:new URL(url).origin}};
  assert.equal((await fetch(url+'/mvp-compare',opts)).status,201);
  replaceSource(png(1440,900,100));
  assert.equal((await fetch(url+'/mvp-comparison')).status,409);
  assert.equal((await fetch(url+'/mvp-replica-screenshot')).status,409);
  assert.equal(calls(),1);
 });
});
