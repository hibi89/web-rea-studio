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


test('failed report fetch to different origin gets a clear next action without allowing network access',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-crossorigin-'));
 const id='d04e4c7f-691e-407c-93a9-9f8091659ca9';
 try{
  const folder=join(root,id);await mkdir(folder);
  await writeFile(join(folder,'metadata.json'),JSON.stringify({id,status:'failed',mode:'dynamic-passive',created_at:'2026-10-16T20:49:12Z',error:'application_fetch_error_visible'}));
  await writeFile(join(folder,'report.json'),JSON.stringify({verdict:'FAIL',failures:['application_fetch_error_visible'],resource_requests:2,resource_fulfilled:2,resource_pending:0,application_fetch_error_visible:true,fetch_rejections:1}));
  await writeFile(join(folder,'inspection.json'),JSON.stringify({network_diagnostics:{fetch_rejections:1},network:[
   {kind:'requested',path:'/'},{kind:'fulfilled',path:'/',status:200},
   {kind:'fetch-attempt',scope:'other-origin',host:'practice02.61-107-199-22.sslip.io',raw_url:'https://practice02.61-107-199-22.sslip.io/private?token=SECRET'},
   {kind:'fetch-rejected',scope:'other-origin',host:'practice02.61-107-199-22.sslip.io'}
  ]}));
  const result=await diagnoseRuns(root);
  assert.equal(result.diagnosis,'PASSIVE_EXTERNAL_FETCH_REJECTED');
  assert.match(result.next_action,/same-origin CSP/);
  assert.match(result.next_action,/practice02.61-107-199-22.sslip.io/);
  assert.match(result.next_action,/CORS and remote-server availability remain unverified/);
  assert.equal(result.passive_browser.recent_network_events.at(-1).external_host,'practice02.61-107-199-22.sslip.io');
  assert.deepEqual(result.passive_browser.external_permission_review.candidate_hosts,['practice02.61-107-199-22.sslip.io']);
  assert.equal(result.passive_browser.external_permission_review.approved,false);
  assert.equal(result.passive_browser.external_permission_review.additional_requests_sent,false);
  assert.equal(result.passive_browser.external_permission_review.requires_explicit_approval,true);
  assert.equal(JSON.stringify(result).includes('SECRET'),false);
  assert.equal(JSON.stringify(result).includes('/private'),false);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('a rejected fetch without matching external attempt cannot be misclassified',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-unmatched-'));
 const id='b03e9c83-f6ac-4bec-8d74-6e621abbc789';
 try{
  const folder=join(root,id);await mkdir(folder);
  await writeFile(join(folder,'metadata.json'),JSON.stringify({id,status:'failed',mode:'dynamic-passive',created_at:'2026-10-16T20:49:12Z',error:'application_fetch_error_visible'}));
  await writeFile(join(folder,'report.json'),JSON.stringify({verdict:'FAIL',application_fetch_error_visible:true,fetch_rejections:1}));
  await writeFile(join(folder,'inspection.json'),JSON.stringify({network:[{kind:'fetch-rejected',scope:'other-origin',host:'api.example.net'}]}));
  const result=await diagnoseRuns(root);
  assert.equal(result.diagnosis,'PASSIVE_FETCH_REJECTED_UNATTRIBUTED');
  assert.deepEqual(result.passive_browser.external_permission_review.candidate_hosts,[]);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('critical data resource block creates safe diagnosis from stored evidence',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-critical-'));
 const id='b1dc6a18-a23c-4ef3-b01b-478bd2399ed7';
 try{
  const dir=join(root,id);await mkdir(dir);
  await writeFile(join(dir,'metadata.json'),JSON.stringify({id,status:'failed',mode:'dynamic-passive',created_at:'2026-10-17T07:00:00Z'}));
  await writeFile(join(dir,'report.json'),JSON.stringify({verdict:'FAIL',critical_resources_blocked:1,resource_blocked:1,fetch_rejections:0}));
  await writeFile(join(dir,'inspection.json'),JSON.stringify({network:[{kind:'blocked',path:'/api/report',resource_type:'Fetch',reason:'HTTP_REJECTED',raw_url:'https://example.com/?token=VERY_PRIVATE'}]}));
  const r=await diagnoseRuns(root);
  assert.equal(r.diagnosis,'PASSIVE_CRITICAL_RESOURCE_BLOCKED');
  assert.equal(r.passive_browser.critical_resource_blocks,1);
  assert.deepEqual(r.passive_browser.external_permission_review.candidate_hosts,[]);
  assert.equal(JSON.stringify(r).includes('VERY_PRIVATE'),false);
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
