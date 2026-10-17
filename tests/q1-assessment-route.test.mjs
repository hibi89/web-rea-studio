import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tcpServer} from 'node:net';
import {createStudioServer} from '../studio/server.mjs';

async function freePort(){
 const server=tcpServer();
 await new Promise((ok,bad)=>server.once('error',bad).listen(0,'127.0.0.1',ok));
 const port=server.address().port;
 await new Promise(ok=>server.close(ok));
 return port;
}
async function done(url,id){
 for(let n=0;n<180;n++){
  const response=await fetch(url+'/api/runs/'+id),run=await response.json();
  if(run.status==='failed')return;
  await new Promise(ok=>setTimeout(ok,20));
 }
 throw Error('Q1_ROUTE_FIXTURE_TIMEOUT');
}
test('read-only Q1 assessment is private, host-free and never reruns real capture',async()=>{
 const root=await mkdtemp(join(tmpdir(),'q1-assessment-route-'));
 const port=await freePort(),base='http://127.0.0.1:'+port;
 const target='https://owner.example.org/approved';
 let runs=0;
 const app=createStudioServer({
  studioPort:port,fixturePort:4317,storageDir:root,approvedUrls:[target],
  dynamicExecutor:async()=>{
   runs++;
   return {
    report:{verdict:'FAIL',fetch_attempts:1,fetch_rejections:1,
     resource_requests:2,resource_fulfilled:1,resource_blocked:0,
     application_fetch_error_visible:true},
    inspection:{mode:'dynamic-passive',network:[
     {kind:'requested',scope:'approved-origin',path:'/',status:200},
     {kind:'fulfilled',scope:'approved-origin',path:'/',status:200},
     {kind:'fetch-attempt',scope:'other-origin',host:'api.owner.example.org',
      raw_url:'https://api.owner.example.org/secret?password=PRIVATE_SENTINEL'},
     {kind:'fetch-rejected',scope:'other-origin',host:'api.owner.example.org'}
    ]}
   };
  }
 });
 try{
  await app.init();
  await new Promise((ok,bad)=>app.server.once('error',bad).listen(port,'127.0.0.1',ok));
  const created=await fetch(base+'/api/runs',{method:'POST',
   headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({target_url:target,analysis_mode:'dynamic-passive'})});
  assert.equal(created.status,202);
  const id=(await created.json()).id;
  await done(base,id);
  const response=await fetch(base+'/api/runs/'+id+'/q1-assessment');
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-disposition'),/attachment/);
  const result=await response.json();
  assert.equal(result.kind,'rea-q1-offline-failure-assessment');
  assert.equal(result.finding,'LOCAL_POLICY_BOUNDARY_COMPATIBLE_NOT_CAUSAL');
  assert.equal(result.evidence_status,'BOUNDED');
  assert.equal(result.observed.fetch_rejections,1);
  assert.equal(result.cause_identified,false);
  assert.equal(result.network_permission_granted,false);
  assert.equal(result.network_requests_issued,0);
  assert.doesNotMatch(JSON.stringify(result),/api\.owner|PRIVATE_SENTINEL|secret|password=/);
  for(let n=0;n<3;n++)assert.equal((await fetch(base+'/api/runs/'+id+'/q1-assessment')).status,200);
  assert.equal(runs,1);
  assert.equal((await fetch(base+'/api/runs/00000000-0000-4000-8000-000000000000/q1-assessment')).status,404);
  const good=await app.store.create({target_url:target,mode:'dynamic-passive'});
  await app.store.update(good.id,{status:'completed',verdict:'PASS'});
  assert.equal((await fetch(base+'/api/runs/'+good.id+'/q1-assessment')).status,409);
  const other=await app.store.create({target_url:'http://127.0.0.1:4317/',mode:'rea-browser'});
  await app.store.update(other.id,{status:'failed',verdict:'FAIL'});
  assert.equal((await fetch(base+'/api/runs/'+other.id+'/q1-assessment')).status,404);
  const missing=await app.store.create({target_url:target,mode:'dynamic-passive'});
  await app.store.update(missing.id,{status:'failed',verdict:'FAIL'});
  assert.equal((await fetch(base+'/api/runs/'+missing.id+'/q1-assessment')).status,404);
  const html=await(await fetch(base+'/')).text(),js=await(await fetch(base+'/app.js')).text();
  assert.match(html,/id="download-q1-assessment"/);
  assert.match(js,/\/q1-assessment/);
 }finally{
  await new Promise(ok=>app.server.close(ok));
  await rm(root,{recursive:true,force:true});
 }
});
