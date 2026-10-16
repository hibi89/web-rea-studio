import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {diagnoseRuns} from '../studio/diagnose.mjs';
test('local diagnoser classifies failure without revealing sensitive stderr text',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-diag-'));
 const id='ad6906c3-fddb-41ce-8d7c-5387fcfd43d2';
 try{
  const dir=join(root,id);await mkdir(dir);
  await writeFile(join(dir,'metadata.json'),JSON.stringify({id,status:'failed',created_at:'2026-10-16T05:00:00Z'}));
  await writeFile(join(dir,'rea-stderr.log'),'npm error EAI_AGAIN https://example.com/?token=secret-password');
  const r=await diagnoseRuns(root);
  assert.equal(r.found,true);assert.equal(r.diagnosis,'NPM_OR_NETWORK_ERROR');
  assert.equal(r.files.stderr_bytes>0,true);
  assert.equal(JSON.stringify(r).includes('secret-password'),false);
  await assert.rejects(diagnoseRuns(root,'../../escape'),/Invalid run ID/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('passive-browser saved failure gives sanitized network diagnostics without retrying',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-browser-diag-'));
 const id='15a1a225-53c5-4d40-bf91-5ca9a9b4f528';
 const folder=join(root,id);
 try{
  await mkdir(folder);
  await writeFile(join(folder,'metadata.json'),JSON.stringify({id,mode:'dynamic-passive',status:'failed',created_at:'2026-10-16T17:44:00Z',error:'resource_requests_unsettled'}));
  await writeFile(join(folder,'report.json'),JSON.stringify({verdict:'FAIL',failures:['resource_requests_unsettled'],resource_requests:2,resource_fulfilled:1,resource_blocked:0,resource_pending:1}));
  await writeFile(join(folder,'inspection.json'),JSON.stringify({network:[
   {kind:'requested',path:'/api/report',resource_type:'Fetch',url:'https://x/?token=secret'},
   {kind:'browser-failed',host:'api.external.example',reason:'cors_error',query:'user-secret'},
   {kind:'requested',path:'/api/report?access_key=PRIVATE',resource_type:'Fetch'},
  ]}));
  const result=await diagnoseRuns(root);
  assert.equal(result.passive_browser.pending,1);
  assert.equal(result.passive_browser.fulfilled,1);
  assert.equal(result.passive_browser.recent_network_events[0].path,'/api/report');
  assert.equal(result.passive_browser.recent_network_events[1].external_host,'api.external.example');
  assert.equal(result.passive_browser.recent_network_events[2].path,null);
  assert.equal(JSON.stringify(result).includes('secret'),false);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('legacy passive failure with only favicon pending explains it is not the report API',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-favicon-'));
 const id='ef139eb3-0d4f-4940-a165-31b2aa5f7b6c';
 try{
  const dir=join(root,id);await mkdir(dir);
  await writeFile(join(dir,'metadata.json'),JSON.stringify({id,status:'failed',mode:'dynamic-passive',created_at:'2026-10-16T17:44:00Z',error:'resource_requests_unsettled'}));
  await writeFile(join(dir,'report.json'),JSON.stringify({verdict:'FAIL',resource_requests:2,resource_fulfilled:1,resource_pending:1}));
  await writeFile(join(dir,'inspection.json'),JSON.stringify({network:[
   {kind:'requested',path:'/',resource_type:'Document'},
   {kind:'fulfilled',path:'/',status:200},
   {kind:'requested',path:'/favicon.ico',resource_type:'Other'}
  ]}));
  const x=await diagnoseRuns(root);
  assert.equal(x.diagnosis,'PASSIVE_FAVICON_PENDING');
  assert.match(x.next_action,/no report API call was recorded/);
 }finally{await rm(root,{recursive:true,force:true});}
});
