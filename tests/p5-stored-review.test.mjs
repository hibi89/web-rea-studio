import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deflateSync} from 'node:zlib';
import {createServer as netServer} from 'node:net';
import {makeStore} from '../studio/core.mjs';
import {createStudioServer} from '../studio/server.mjs';
import {reviewSavedP5ColorRepair} from '../studio/p5-stored-review.mjs';

async function freePort(){
 const server=netServer();
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const port=server.address().port;await new Promise(ok=>server.close(ok));
 return port;
}
function png(){
 const w=24,h=16;
 const rows=Array.from({length:h},()=>{
  const b=Buffer.alloc(1+w*3);for(let i=1;i<b.length;i++)b[i]=240;return b;
 });
 function chunk(name,b){
  const h=Buffer.alloc(8);h.writeUInt32BE(b.length);h.write(name,4);
  return Buffer.concat([h,b,Buffer.alloc(4)]);
 }
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),
  chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
const geometry={
 source:'p4-geometry',viewport:{width:1440,height:900},document:{height:900},
 background:'rgb(240, 240, 240)',
 boxes:[{tag:'aside',depth:2,x:20,y:30,w:200,h:400,
  background:'rgb(240, 240, 240)',border_width:'0px',radius:'0px'}],titles:[]
};
async function seed(store,{complete=true}={}){
 const meta=await store.create({target_url:'https://owner.example.org/static',mode:'static-visual'});
 await store.saveReport(meta.id,{verdict:'PASS',screenshot_saved:true,reconstruction_available:true});
 await store.saveInspection(meta.id,{mode:'static-visual',page:{reconstruction_blueprint:geometry}});
 await store.saveComparison(meta.id,{schema_version:2,ignored_notice_area:false});
 await writeFile(join(store.pathFor(meta.id),'screenshot.png'),png());
 if(complete)await store.update(meta.id,{status:'completed',verdict:'PASS'});
 return meta.id;
}
test('saved P5 standalone replay uses synthetic document only, preserves original artifacts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'p5-review-unit-'));
 try{
  const store=makeStore(root);await store.init();
  const id=await seed(store);
  const before=await readFile(join(store.pathFor(id),'screenshot.png'));
  let renders=0;
  const result=await reviewSavedP5ColorRepair({store,id,browserPath:'test-only',
   replayExecutor:async({target,dir,scriptsDisabled,relay})=>{
    renders++;
    assert.equal(target,'https://p5-offline-replay.example.org/');
    assert.equal(scriptsDisabled,true);
    const doc=await relay(target);
    assert.match(doc.body.toString(),/script-src &#39;none&#39;/);
    await assert.rejects(()=>relay('https://owner.example.org/static'),/P5_REVIEW_OFF_SCOPE/);
    await writeFile(join(dir,'screenshot.png'),png());
    return {report:{verdict:'PASS',screenshot_saved:true},
     inspection:{page:{reconstruction_blueprint:geometry}}};
   }});
  assert.equal(result.status,'NO_SAFE_COLOR_PATCH');
  assert.equal(result.renderings,1);
  assert.equal(result.accepted,0);
  assert.equal(result.external_requests_issued,0);
  assert.equal(result.original_capture_reexecuted,false);
  assert.equal(result.downloadable_improved_html,false);
  assert.equal(result.product_ready,false);
  assert.equal(renders,1);
  assert.deepEqual(await readFile(join(store.pathFor(id),'screenshot.png')),before);
  assert.equal((await store.get(id)).status,'completed');
  const persisted=JSON.parse(await readFile(join(store.pathFor(id),'color-repair.json'),'utf8'));
  assert.equal(persisted.status,result.status);
  await assert.rejects(readFile(join(store.pathFor(id),'color-repair.html')), {code:'ENOENT'});
  await assert.rejects(()=>reviewSavedP5ColorRepair({store,id,browserPath:'test-only',
   replayExecutor:async()=>{throw Error('never');}}),{code:'EEXIST'});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('Studio P5 POST requires explicit action, deduplicates and reads receipt without new analysis',async()=>{
 const root=await mkdtemp(join(tmpdir(),'p5-review-http-'));
 const port=await freePort(),fixturePort=await freePort();
 let release,invocations=0;
 const gate=new Promise(ok=>{release=ok;});
 const server=createStudioServer({studioPort:port,fixturePort,storageDir:root,
  browserPath:'test-only',approvedUrls:['https://owner.example.org/static'],
  colorRepairExecutor:async({store,id})=>{
   invocations++;
   await gate;
   await writeFile(join(store.pathFor(id),'color-repair.json'),
    JSON.stringify({kind:'stored-static-p5-color-review',status:'NO_SAFE_COLOR_PATCH',
      downloadable_improved_html:false,product_ready:false}),{flag:'wx'});
  }});
 await server.init();
 const id=await seed(server.store);
 const rejected=await seed(server.store,{complete:false});
 await new Promise(ok=>server.server.listen(port,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+port,endpoint=base+'/api/runs/'+id+'/color-repair';
 const post=(body,headers={})=>fetch(endpoint,{method:'POST',headers:{Origin:base,
  'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(endpoint)).status,404);
  assert.equal((await post({confirm:'wrong'})).status,400);
  assert.equal((await post({confirm:'offline-color-review',unexpected:1})).status,400);
  assert.equal((await post({confirm:'offline-color-review'},{Origin:'http://evil.test'})).status,403);
  assert.equal((await fetch(base+'/api/runs/'+rejected+'/color-repair',{
   method:'POST',headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({confirm:'offline-color-review'})})).status,409);
  const begin=await post({confirm:'offline-color-review'});
  assert.equal(begin.status,202);
  assert.equal((await begin.json()).original_site_refetched,false);
  assert.equal((await fetch(endpoint)).status,202);
  assert.equal((await post({confirm:'offline-color-review'})).status,409);
  assert.equal(invocations,1);
  release();
  let out;
  for(let i=0;i<50;i++){
   const r=await fetch(endpoint);
   if(r.status===200){out=await r.json();break;}
   await new Promise(ok=>setTimeout(ok,10));
  }
  assert.equal(out?.status,'NO_SAFE_COLOR_PATCH');
  assert.equal(out.product_ready,false);
  assert.equal((await fetch(endpoint+'/color-repair-download')).status,404);
  assert.equal((await fetch(base+'/api/runs/'+id+'/color-repair-download')).status,404);
  assert.equal((await post({confirm:'offline-color-review'})).status,409);
  assert.equal(invocations,1,'GET and duplicate POST must not execute another Chrome repair');
 }finally{
  release();
  await new Promise(ok=>server.server.close(ok));
  await rm(root,{recursive:true,force:true});
 }
});
