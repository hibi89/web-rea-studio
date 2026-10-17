import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as netServer} from 'node:net';
import {makeStore} from '../studio/core.mjs';
import {createStudioServer} from '../studio/server.mjs';
import {generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';
import {validateIndependentDraftBundle,saveIndependentDraftBundle,
 readIndependentDraftReceipt,MAX_INDEPENDENT_DRAFT_BODY} from '../studio/independent-draft.mjs';

async function freePort(){
 const s=netServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));
 const p=s.address().port;await new Promise(ok=>s.close(ok));return p;
}
const box=(tag,x,y,w,h,color)=>({tag,depth:tag==='body'?1:2,x,y,w,h,
 background:color,border_color:'rgb(0, 0, 0)',border_width:'0px',radius:'0px'});
function sourceGeometry(){
 return {source:'p4-geometry',viewport:{width:1440,height:900},
 document:{width:1440,height:900},body_color:'rgb(231, 235, 241)',
 boxes:[box('body',0,0,1440,900,'rgb(231, 235, 241)'),
  box('aside',40,50,260,480,'rgb(255, 255, 255)'),
  box('main',420,50,370,480,'rgb(186, 218, 239)')],titles:[]};
}
const changed=()=>{const g=sourceGeometry();g.boxes[1].x=68;g.boxes[1].w=314;return g;};
test('standalone draft validator only accepts regenerated P4 template and geometry',()=>{
 const input={confirm:'store-scriptless-p4-draft',geometry:changed(),
  html:generateP4Reconstruction(changed())};
 const result=validateIndependentDraftBundle(input,sourceGeometry());
 assert.equal(result.record.status,'STORED_UNVERIFIED');
 assert.equal(result.record.source_draft_alignment_verified,false);
 assert.equal(result.record.browser_replay_executed,false);
 assert.equal(result.record.external_requests_issued,0);
 assert.equal(result.record.product_ready,false);
 assert.ok(/^[a-f0-9]{64}$/.test(result.record.html_sha256));
 assert.equal(result.html,input.html);
 assert.doesNotMatch(JSON.stringify(result.record),/aside|script|token=/i);
 const generated=validateIndependentDraftBundle({confirm:'store-scriptless-p4-draft',
  geometry:changed()},sourceGeometry());
 assert.equal(generated.html,result.html);
 assert.equal(generated.record.provenance,'explicit-local-user-provided-p4-geometry');
 for(const html of [
  input.html+'<script>alert(1)</script>',
  input.html.replace('<body>','<body onload="fetch(\'https://exfil.invalid\')">'),
  input.html.replace('background:rgb(255, 255, 255)','background:url(https://exfil.invalid/a)'),
  input.html+'<iframe src="https://exfil.invalid/"/>'
 ]){
  assert.throws(()=>validateIndependentDraftBundle({...input,html},sourceGeometry()),
   /DRAFT_HTML_NOT_CANONICAL/);
 }
 assert.throws(()=>validateIndependentDraftBundle({...input,secret:'XYZ'},sourceGeometry()),
  /DRAFT_INVALID_ENVELOPE/);
 const wrong=changed();wrong.viewport.width=1000;
 assert.throws(()=>validateIndependentDraftBundle({...input,geometry:wrong},sourceGeometry()),
  /DRAFT_VIEWPORT_MISMATCH/);
 assert.throws(()=>validateIndependentDraftBundle({...input,html:'x'.repeat(250001)},sourceGeometry()),
  /DRAFT_INVALID_ENVELOPE/);
 assert.equal(MAX_INDEPENDENT_DRAFT_BODY,320000);
});
test('local-only immutable bundle stores sanitized geometry and never edits original run',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-independent-bundle-'));
 try{
  const store=makeStore(root);await store.init();
  const meta=await store.create({target_url:'https://approved.example.org/',mode:'static-visual'});
  await store.update(meta.id,{status:'completed'});
  await store.saveInspection(meta.id,{mode:'static-visual',page:{
   reconstruction_blueprint:sourceGeometry()}});
  await store.saveReport(meta.id,{reconstruction_available:true});
  const inspectionBefore=await readFile(join(store.pathFor(meta.id),'inspection.json'));
  const receipt=await saveIndependentDraftBundle({store,id:meta.id,
   originalGeometry:sourceGeometry(),bundle:{
    confirm:'store-scriptless-p4-draft',geometry:changed()}});
  assert.equal(receipt.status,'STORED_UNVERIFIED');
  assert.equal((await readIndependentDraftReceipt(store,meta.id)).html_sha256,receipt.html_sha256);
  assert.equal(await readFile(join(store.pathFor(meta.id),'independent-draft.html'),'utf8'),
   generateP4Reconstruction(changed()));
  const geometry=JSON.parse(await readFile(join(store.pathFor(meta.id),
   'independent-draft-geometry.json'),'utf8'));
  assert.equal(geometry.boxes[1].x,68);
  assert.deepEqual(await readFile(join(store.pathFor(meta.id),'inspection.json')),inspectionBefore);
  await assert.rejects(()=>saveIndependentDraftBundle({store,id:meta.id,
   originalGeometry:sourceGeometry(),bundle:{
    confirm:'store-scriptless-p4-draft',geometry:changed()}}),{code:'EEXIST'});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('Studio draft import is opt-in, same-origin, immutable, read-only, scriptless attached',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-independent-http-'));
 const port=await freePort(),fixturePort=await freePort();
 const studio=createStudioServer({studioPort:port,fixturePort,storageDir:root,
  browserPath:'/fake/chrome'});
 await studio.init();
 const meta=await studio.store.create({target_url:'https://approved.example.org/',
  mode:'static-visual'});
 await studio.store.saveInspection(meta.id,{mode:'static-visual',page:{
  reconstruction_blueprint:sourceGeometry()}});
 await studio.store.saveReport(meta.id,{reconstruction_available:true});
 await studio.store.update(meta.id,{status:'completed'});
 const bad=await studio.store.create({target_url:'https://approved.example.org/',
  mode:'dynamic-passive'});
 await studio.store.update(bad.id,{status:'failed'});
 await new Promise(ok=>studio.server.listen(port,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+port,end=base+'/api/runs/'+meta.id+'/independent-draft';
 const starter=base+'/api/runs/'+meta.id+'/independent-draft-starter';
 const make=(payload,extra={})=>fetch(end,{method:'POST',headers:{
  Origin:base,'Content-Type':'application/json',...extra},body:JSON.stringify(payload)});
 try{
  assert.equal((await fetch(end)).status,404);
  const intro=await fetch(starter);
  assert.equal(intro.status,200);
  assert.match(intro.headers.get('content-disposition'),/attachment/);
  const proposed=await intro.json();
  assert.equal(proposed.geometry.boxes[1].x,40);
  proposed.geometry.boxes[1].x=68;
  proposed.geometry.boxes[1].w=314;
  assert.equal((await make({confirm:'store-scriptless-p4-draft',geometry:changed()},
   {Origin:'http://malicious.invalid'})).status,403);
  assert.equal((await fetch(end,{method:'POST',
   headers:{Origin:base,'Content-Type':'text/plain'},body:'x'})).status,415);
  assert.equal((await make({confirm:'wrong',geometry:changed()})).status,400);
  assert.equal((await make({confirm:'store-scriptless-p4-draft',
   geometry:changed(),html:'<script>evil</script>'})).status,400);
  assert.equal((await fetch(base+'/api/runs/'+bad.id+'/independent-draft',{
   method:'POST',headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({confirm:'store-scriptless-p4-draft',geometry:changed()})})).status,409);
  const done=await make({confirm:'store-scriptless-p4-draft',geometry:proposed.geometry});
  assert.equal(done.status,201);
  const receipt=await done.json();
  assert.equal(receipt.status,'STORED_UNVERIFIED');
  assert.equal(receipt.browser_replay_executed,false);
  assert.equal(receipt.external_requests_issued,0);
  const read=await fetch(end);
  assert.equal(read.status,200);
  const same=await read.json();
  assert.equal(same.html_sha256,receipt.html_sha256);
  assert.ok(!Object.hasOwn(same,'html'));
  assert.ok(!Object.hasOwn(same,'geometry'));
  const download=await fetch(end+'-download');
  assert.equal(download.status,200);
  assert.match(download.headers.get('content-disposition'),/attachment/);
  assert.match(download.headers.get('content-security-policy'),/script-src 'none'/);
  assert.match(download.headers.get('content-security-policy'),/connect-src 'none'/);
  assert.match(download.headers.get('content-security-policy'),/sandbox/);
  assert.equal(await download.text(),generateP4Reconstruction(changed()));
  assert.equal((await make({confirm:'store-scriptless-p4-draft',geometry:changed()})).status,409);
  assert.equal((await fetch(base+'/api/runs/'+bad.id+'/independent-draft-starter')).status,404);
  assert.equal((await fetch(base+'/api/runs/'+bad.id+'/independent-draft-download')).status,404);
  assert.equal((await studio.store.get(meta.id)).status,'completed');
 }finally{
  await new Promise(ok=>studio.server.close(ok));
  await rm(root,{recursive:true,force:true});
 }
});
