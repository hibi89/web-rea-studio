import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as netServer} from 'node:net';
import {deflateSync} from 'node:zlib';
import {makeStore} from '../studio/core.mjs';
import {createStudioServer} from '../studio/server.mjs';
import {saveIndependentDraftBundle} from '../studio/independent-draft.mjs';
import {reviewSavedP5GeometryRepair} from '../studio/p5-saved-geometry-repair.mjs';

async function freePort(){
 const server=netServer();await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 const port=server.address().port;await new Promise(ok=>server.close(ok));return port;
}
const source=()=>({source:'p4-geometry',viewport:{width:1440,height:900},
 document:{width:1440,height:900},body_color:'rgb(230, 234, 241)',boxes:[
 {tag:'body',depth:1,x:0,y:0,w:1440,h:900,background:'rgb(230, 234, 241)',
  radius:'0px',border_color:'rgb(0, 0, 0)',border_width:'0px'},
 {tag:'aside',depth:2,x:40,y:50,w:260,h:480,background:'rgb(255, 255, 255)',
  radius:'0px',border_color:'rgb(0, 0, 0)',border_width:'0px'},
 {tag:'main',depth:2,x:420,y:50,w:370,h:480,background:'rgb(186, 218, 239)',
  radius:'0px',border_color:'rgb(0, 0, 0)',border_width:'0px'}],titles:[]});
function png(){
 const w=24,h=16;
 const rows=Array.from({length:h},()=>{const b=Buffer.alloc(1+w*3);b.fill(230,1);return b});
 const chunk=(name,b)=>{const hd=Buffer.alloc(8);hd.writeUInt32BE(b.length);hd.write(name,4);
  return Buffer.concat([hd,b,Buffer.alloc(4)])};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),
  chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
async function seed(store,{draft=true,status='completed'}={}){
 const meta=await store.create({target_url:'https://original-never-fetched.example.org/',
  mode:'static-visual'});
 await store.saveReport(meta.id,{verdict:'PASS',reconstruction_available:true,screenshot_saved:true});
 await store.saveInspection(meta.id,{mode:'static-visual',page:{reconstruction_blueprint:source()}});
 await store.saveComparison(meta.id,{schema_version:2,ignored_notice_area:false});
 await writeFile(join(store.pathFor(meta.id),'screenshot.png'),png());
 await store.update(meta.id,{status});
 if(draft){
  const edited=source();edited.boxes[1].x+=28;edited.boxes[1].w+=54;
  await saveIndependentDraftBundle({store,id:meta.id,originalGeometry:source(),
   bundle:{confirm:'store-scriptless-p4-draft',geometry:edited}});
 }
 return meta.id;
}
test('saved draft integrity failure halts before any Chrome replay, originals unchanged',async()=>{
 const root=await mkdtemp(join(tmpdir(),'f5-saved-geometry-integrity-'));
 try{
  const store=makeStore(root);await store.init();
  const id=await seed(store);
  const savedPath=join(store.pathFor(id),'independent-draft.html');
  await writeFile(savedPath,'<script>evil</script>');
  const original=await readFile(join(store.pathFor(id),'screenshot.png'));
  let count=0;
  await assert.rejects(()=>reviewSavedP5GeometryRepair({store,id,browserPath:'fake',
   replayExecutor:async()=>{count++;throw Error('must not run');}}),{
    code:'P5_GEOMETRY_DRAFT_INTEGRITY_FAILED'
   });
  assert.equal(count,0);
  assert.deepEqual(await readFile(join(store.pathFor(id),'screenshot.png')),original);
  await assert.rejects(readFile(join(store.pathFor(id),'geometry-repair.json')),
   {code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true})}
});
test('captured saved draft with no unique region changes safely records no repair',async()=>{
 const root=await mkdtemp(join(tmpdir(),'f5-saved-geometry-noop-'));
 try{
  const store=makeStore(root);await store.init();
  const id=await seed(store);
  const original=await readFile(join(store.pathFor(id),'inspection.json'));
  let calls=0;
  const outcome=await reviewSavedP5GeometryRepair({store,id,browserPath:'fake',
   replayExecutor:async({target,dir,scriptsDisabled,relay})=>{
    calls++;
    assert.equal(target,'https://p5-saved-geometry-offline.example.org/');
    assert.equal(scriptsDisabled,true);
    assert.match((await relay(target)).body.toString(),/script-src &#39;none&#39;/);
    await assert.rejects(()=>relay('https://original-never-fetched.example.org/'),
     /P5_GEOMETRY_OFF_SCOPE/);
    await writeFile(join(dir,'screenshot.png'),png());
    return {report:{verdict:'PASS',screenshot_saved:true},
     inspection:{page:{reconstruction_blueprint:source()}}};
   }});
  assert.equal(outcome.status,'STOPPED_ALIGNMENT_UNVERIFIED');
  assert.equal(outcome.accepted,0);
  assert.equal(outcome.chrome_replays,1);
  assert.equal(outcome.downloadable_improved_html,false);
  assert.equal(outcome.canonical_draft_preflight_verified,false);
  assert.equal(calls,1);
  assert.deepEqual(await readFile(join(store.pathFor(id),'inspection.json')),original);
  const r=JSON.parse(await readFile(join(store.pathFor(id),'geometry-repair.json'),'utf8'));
  assert.equal(r.original_site_refetched,false);
  await assert.rejects(readFile(join(store.pathFor(id),'geometry-repair.html')),{code:'ENOENT'});
 }finally{await rm(root,{recursive:true,force:true})}
});
test('geometry POST requires same-origin confirmation; GET never launches Chrome, downloads only accepted',async()=>{
 const root=await mkdtemp(join(tmpdir(),'f5-saved-geometry-http-'));
 const port=await freePort(),fixturePort=await freePort();
 let launch=0,release;
 const gate=new Promise(ok=>{release=ok});
 const app=createStudioServer({studioPort:port,fixturePort,storageDir:root,
  browserPath:'fake',geometryRepairExecutor:async({store,id})=>{
   launch++;await gate;
   await writeFile(join(store.pathFor(id),'geometry-repair.html'),
    '<!doctype html><html><body>Corrected</body></html>',{flag:'wx'});
   await writeFile(join(store.pathFor(id),'geometry-repair.json'),JSON.stringify({
    kind:'saved-independent-p4-geometry-review',status:'BOUNDED_STATIC_GEOMETRY_IMPROVEMENT',
    accepted:1,downloadable_improved_html:true,product_ready:false
   }),{flag:'wx'});
  }});
 await app.init();
 const id=await seed(app.store),unseeded=await seed(app.store,{draft:false});
 await new Promise(ok=>app.server.listen(port,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+port,endpoint=base+'/api/runs/'+id+'/geometry-repair';
 const post=(body,headers={})=>fetch(endpoint,{method:'POST',headers:{
  Origin:base,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{
  assert.equal((await fetch(endpoint)).status,404);
  assert.equal((await fetch(endpoint+'-download')).status,404);
  assert.equal((await post({confirm:'wrong'})).status,400);
  assert.equal((await post({confirm:'offline-geometry-review',extra:1})).status,400);
  assert.equal((await post({confirm:'offline-geometry-review'},{Origin:'http://evil.invalid'})).status,403);
  assert.equal((await fetch(base+'/api/runs/'+unseeded+'/geometry-repair',{
   method:'POST',headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({confirm:'offline-geometry-review'})})).status,409);
  const response=await post({confirm:'offline-geometry-review'});
  assert.equal(response.status,202);
  assert.equal((await response.json()).original_site_refetched,false);
  assert.equal((await fetch(endpoint)).status,202);
  assert.equal((await post({confirm:'offline-geometry-review'})).status,409);
  // The shared browser lock must also reject starting a separate fresh run.
  const competing=await fetch(base+'/api/runs',{method:'POST',headers:{
   Origin:base,'Content-Type':'application/json'},body:JSON.stringify({
    target_url:'http://127.0.0.1:'+fixturePort+'/'})});
  assert.equal(competing.status,409);
  assert.equal(launch,1);
  release();
  let result;
  for(let i=0;i<50;i++){
   const r=await fetch(endpoint);
   if(r.status===200){result=await r.json();break;}
   await new Promise(ok=>setTimeout(ok,10));
  }
  assert.equal(result?.status,'BOUNDED_STATIC_GEOMETRY_IMPROVEMENT');
  const download=await fetch(endpoint+'-download');
  assert.equal(download.status,200);
  assert.match(download.headers.get('content-disposition'),/attachment/);
  assert.match(download.headers.get('content-security-policy'),/script-src 'none'/);
  assert.match(download.headers.get('content-security-policy'),/connect-src 'none'/);
  assert.match(download.headers.get('content-security-policy'),/sandbox/);
  assert.match(await download.text(),/Corrected/);
  await fetch(endpoint);await fetch(endpoint+'-download');
  assert.equal(launch,1);
  assert.equal((await post({confirm:'offline-geometry-review'})).status,409);
 }finally{
  release();await new Promise(ok=>app.server.close(ok));
  await rm(root,{recursive:true,force:true});
 }
});
