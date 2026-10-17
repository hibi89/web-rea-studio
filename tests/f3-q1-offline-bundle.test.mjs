import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tcpServer} from 'node:net';
import {createStudioServer} from '../studio/server.mjs';
import {reviewAnonymousLayout,ACCEPTANCE_FILENAME} from '../studio/f3-q1-acceptance.mjs';
import {buildVerifiedOfflineBundle,encodeFixedTwoFileZip,OFFLINE_ZIP_FILES} from '../studio/f3-q1-offline-bundle.mjs';
const mode='dynamic-passive',approved='https://owner-fixture.example.org/';
const secret='NEVER_INCLUDE_SECRET_LABEL_983';
const sha=v=>createHash('sha256').update(v).digest('hex');
function ev(){
 const inspection={mode,screen_capture:{width:1440,height:900},page:{
  frontend_blueprint:{source:'computed-dom',viewport:{w:1440,h:900}},
  interaction_inventory:{source:'passive-controls',verification:'presence-only',
   actions_executed:0,counts:{total:3},controls:[
    {kind:'button',label:secret,rect:{x:50,y:70,width:180,height:34}},
    {kind:'link',label:secret,rect:{x:1030,y:180,width:210,height:34}},
    {kind:'input',value:secret,rect:{x:420,y:610,width:220,height:34}}]}},
  network:[{kind:'fetch-attempt',scope:'other-origin',host:'private-server.example.org'},
   {kind:'fetch-rejected',scope:'other-origin',host:'private-server.example.org'}]};
 return {mode,inspection,report:{analysis_mode:mode,verdict:'FAIL',
  fetch_attempts:1,fetch_rejections:1,screenshot_width:1440,screenshot_height:900}};
}
function mockChrome(){
 let count=0;return {get count(){return count},run:async({target,relay,scriptsDisabled,observeAnonymousLayout,offlineViewport})=>{
  count++;assert.equal(scriptsDisabled,true);assert.equal(observeAnonymousLayout,true);
  const a=await relay(target);assert.match(a.body.toString(),/NOT A REPLICA/);
  const width=offlineViewport.width,mobile=width===390,columns=mobile?1:3;
  const x=mobile?12:20,unit=mobile?366:300;
  return {report:{verdict:'PASS',scripts_executed:false,fetch_attempts:0,
   fetch_rejections:0,resource_blocked:0,screenshot_width:width,
   screenshot_height:mobile?1087:900},
   inspection:{page:{interaction_inventory:{controls:[]},offline_anonymous_layout:{
    viewport:width,document_scroll_width:width,document_client_width:width,
    computed_grid_columns:columns,zone_count:9,native_controls:0,
    grid:[x,130,mobile?366:948,1200],zones:Array.from({length:9},(_,i)=>[
     x+(i%columns)*(unit+12),150+Math.floor(i/columns)*125,unit,112])
   }}}};
 }};
}
function unzipTwo(bytes){
 // Independent ZIP32 parser: validate local+central structure, exact two flat safe names,
 // method STORE, CRC32, file contents and no trailing entries.
 const end=bytes.length-22;
 assert.equal(bytes.readUInt32LE(end),0x06054b50);
 assert.equal(bytes.readUInt16LE(end+10),2);
 assert.equal(bytes.readUInt16LE(end+8),2);
 const cdSize=bytes.readUInt32LE(end+12),cdStart=bytes.readUInt32LE(end+16);
 assert.equal(cdStart+cdSize,end);
 let loc=0,central=cdStart;const files=[];
 for(let i=0;i<2;i++){
  assert.equal(bytes.readUInt32LE(loc),0x04034b50);
  assert.equal(bytes.readUInt32LE(central),0x02014b50);
  assert.equal(bytes.readUInt16LE(loc+8),0);
  assert.equal(bytes.readUInt16LE(central+10),0);
  const n=bytes.readUInt16LE(loc+26),cn=bytes.readUInt16LE(central+28);
  assert.equal(n,cn);
  const name=bytes.subarray(loc+30,loc+30+n).toString('ascii');
  const other=bytes.subarray(central+46,central+46+cn).toString('ascii');
  assert.equal(name,other);assert.equal(name,OFFLINE_ZIP_FILES[i]);
  assert.equal(bytes.readUInt32LE(central+42),loc);
  const size=bytes.readUInt32LE(loc+18);
  assert.equal(size,bytes.readUInt32LE(loc+22));assert.equal(size,bytes.readUInt32LE(central+20));
  const data=bytes.subarray(loc+30+n,loc+30+n+size);
  assert.equal(bytes.readUInt32LE(loc+14),bytes.readUInt32LE(central+16));
  files.push({name,bytes:data});
  loc+=30+n+size;central+=46+cn;
 }
 assert.equal(loc,cdStart);assert.equal(central,end);
 return files;
}
async function port(){const s=tcpServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'rea-two-file-zip-')),p=await port();
 const browser=mockChrome(),base='http://127.0.0.1:'+p;
 let sourceCalls=0;
 const app=createStudioServer({studioPort:p,fixturePort:4317,storageDir:root,
  approvedUrls:[approved],
  dynamicExecutor:async()=>{sourceCalls++;throw Error('FORBIDDEN_LIVE_CAPTURE');},
  anonymousAcceptanceExecutor:async args=>reviewAnonymousLayout({
   ...args,browserPath:'offline',replayExecutor:browser.run})
 });
 await app.init();const e=ev(),meta=await app.store.create({mode,target_url:approved});
 await app.store.saveInspection(meta.id,e.inspection);await app.store.saveReport(meta.id,e.report);
 await app.store.update(meta.id,{status:'failed'});
 await new Promise(ok=>app.server.listen(p,'127.0.0.1',ok));
 return {app,base,root,meta,browser,get sourceCalls(){return sourceCalls},
  close:async()=>{await new Promise(ok=>app.server.close(ok));await rm(root,{recursive:true,force:true});}};
}
async function accept(f){
 const start=await fetch(f.base+'/api/runs/'+f.meta.id+'/f3-q1-layout-acceptance',{
  method:'POST',headers:{Origin:f.base,'Content-Type':'application/json'},
  body:JSON.stringify({confirm:'offline-anonymous-layout-review'})});
 assert.equal(start.status,202);
 const endpoint=f.base+'/api/runs/'+f.meta.id+'/f3-q1-offline-bundle';
 for(let i=0;i<120;i++){
  const response=await fetch(endpoint);
  if(response.status===200)return response;
  assert.ok([404,409].includes(response.status));
  await new Promise(ok=>setTimeout(ok,20));
 }
 throw Error('ACCEPTANCE_TIMEOUT');
}
test('ZIP writer uses two fixed names and deterministic stored-only headers, rejects arbitrary files',()=>{
 const input=[{name:OFFLINE_ZIP_FILES[0],bytes:Buffer.from('HTML')},
  {name:OFFLINE_ZIP_FILES[1],bytes:Buffer.from('{"sha":"abc"}')}];
 const a=encodeFixedTwoFileZip(input),b=encodeFixedTwoFileZip(input);
 assert.equal(sha(a),sha(b));
 const parts=unzipTwo(a);assert.deepEqual(parts.map(x=>x.bytes.toString()),['HTML','{"sha":"abc"}']);
 assert.throws(()=>encodeFixedTwoFileZip([{name:'../../evil',bytes:Buffer.from('bad')},input[1]]));
 assert.throws(()=>encodeFixedTwoFileZip([input[0],input[1],input[1]]));
 assert.throws(()=>encodeFixedTwoFileZip([input[0],{name:input[1].name,bytes:Buffer.alloc(256*1024+1)}]));
});
test('without verified receipt and for ineligible modes, ZIP download returns JSON and no Chrome',async()=>{
 const f=await fixture(),endpoint=f.base+'/api/runs/'+f.meta.id+'/f3-q1-offline-bundle';
 try{
  let x=await fetch(endpoint);assert.equal(x.status,404);assert.match(x.headers.get('content-type'),/json/);
  const complete=await f.app.store.create({mode,target_url:approved});
  await f.app.store.update(complete.id,{status:'completed'});
  assert.equal((await fetch(f.base+'/api/runs/'+complete.id+'/f3-q1-offline-bundle')).status,409);
  const synthetic=await f.app.store.create({mode:'fixture-generic-planner',target_url:'http://127.0.0.1:4317/'});
  assert.equal((await fetch(f.base+'/api/runs/'+synthetic.id+'/f3-q1-offline-bundle')).status,404);
  assert.equal(f.browser.count,0);assert.equal(f.sourceCalls,0);
 }finally{await f.close();}
});
test('accepted offline ZIP delivers exactly HTML and canonical receipt, with matching SHA and repeat GET zero replay',async()=>{
 const f=await fixture(),url=f.base+'/api/runs/'+f.meta.id+'/f3-q1-offline-bundle';
 try{
  const first=await accept(f);
  assert.equal(first.headers.get('content-type'),'application/zip');
  assert.match(first.headers.get('content-disposition'),/attachment.*\\.zip/);
  assert.equal(first.headers.get('x-rea-verification-scope'),'synthetic-offline-only');
  assert.equal(first.headers.get('cache-control'),'no-store');
  const zipped=Buffer.from(await first.arrayBuffer());
  assert.equal(sha(zipped),first.headers.get('x-rea-bundle-sha256'));
  const parts=unzipTwo(zipped),html=parts[0].bytes.toString('utf8'),
   receipt=JSON.parse(parts[1].bytes.toString('utf8'));
  assert.equal(receipt.status,'VERIFIED_SYNTHETIC_LAYOUT_ONLY');
  assert.deepEqual(receipt.views.map(v=>v.columns),[3,1]);
  assert.equal(receipt.html_sha256,sha(parts[0].bytes));
  assert.equal(receipt.original_site_parity_verified,false);
  assert.equal(receipt.permission_status,'NOT_APPROVED');
  assert.doesNotMatch(zipped.toString('utf8'),/NEVER_INCLUDE_SECRET_LABEL_983|private-server\\.example\\.org/);
  assert.doesNotMatch(html,/<(?:script|form|input|button|a)\\b/i);
  assert.equal(f.browser.count,2);
  for(let i=0;i<3;i++){
   const current=await fetch(url);assert.equal(current.status,200);
   assert.equal(sha(Buffer.from(await current.arrayBuffer())),sha(zipped));
  }
  assert.equal(f.browser.count,2);assert.equal(f.sourceCalls,0);
  const page=await(await fetch(f.base+'/')).text(),js=await(await fetch(f.base+'/app.js')).text();
  assert.match(page,/download-f3-q1-offline-bundle/);assert.match(js,/f3-q1-offline-bundle/);
 }finally{await f.close();}
});
test('mutated receipt or source evidence blocks ZIP while unreviewed preview stays separate',async()=>{
 const f=await fixture(),endpoint=f.base+'/api/runs/'+f.meta.id+'/f3-q1-offline-bundle';
 try{
  assert.equal((await accept(f)).status,200);
  const file=join(f.app.store.pathFor(f.meta.id),ACCEPTANCE_FILENAME);
  const original=JSON.parse(await readFile(file,'utf8'));
  await writeFile(file,JSON.stringify({...original,views:[
   original.views[0],{...original.views[1],columns:3}]}));
  const bad=await fetch(endpoint);
  assert.equal(bad.status,409);assert.match(bad.headers.get('content-type'),/json/);
  assert.equal((await fetch(f.base+'/api/runs/'+f.meta.id+'/f3-q1-geometry-preview-download')).status,200);
  await writeFile(file,JSON.stringify(original));
  await f.app.store.saveReport(f.meta.id,{...ev().report,resource_requests:99});
  assert.equal((await fetch(endpoint)).status,409);
  assert.equal(f.browser.count,2);
 }finally{await f.close();}
});
