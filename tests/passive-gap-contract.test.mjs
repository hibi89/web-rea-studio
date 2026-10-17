import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as netServer} from 'node:net';
import {buildPassiveGapContract} from '../studio/passive-gap-contract.mjs';
import {createStudioServer} from '../studio/server.mjs';

function evidence(){
 return {mode:'dynamic-passive',scope:'explicit-https-allowlist',
  page:{interaction_inventory:{source:'passive-controls',controls:[
   {kind:'button',label:'View PRIVATE_CUSTOMER',rect:{x:3,y:3,width:95,height:30}},
   {kind:'input',type:'password',label:'SECRET_PASSWORD',value:'DO_NOT_COPY',rect:{x:2,y:44,width:110,height:23}},
   {kind:'link',label:'Offsite',navigation:'offsite',rect:{x:40,y:91,width:90,height:25}}
  ]}},
  network:[
   {kind:'requested',path:'/api/custom',resource_type:'Fetch',headers:{authorization:'DO_NOT_COPY'}},
   {kind:'fulfilled',path:'/api/custom',status:200,body:'DO_NOT_COPY'},
   {kind:'fetch-attempt',scope:'other-origin',host:'private-api.example.net',url:'https://private-api.example.net/DO_NOT_COPY?key=DO_NOT_COPY'},
   {kind:'fetch-rejected',scope:'other-origin',host:'private-api.example.net'},
   {kind:'xhr-open',scope:'other-origin',host:'other.example.org'}
  ]};
}
test('passive F3 contract distinguishes real observation from unknown behavior and API data',()=>{
 const r=buildPassiveGapContract({mode:'dynamic-passive',inspection:evidence(),
  report:{analysis_mode:'dynamic-passive',verdict:'FAIL',fetch_rejections:1}});
 assert.equal(r.kind,'rea-passive-functional-data-gap-contract');
 assert.equal(r.source_capture.verdict,'capture-failed');
 assert.equal(r.ui_affordances.observed_total,3);
 assert.deepEqual(r.ui_affordances.groups.map(x=>x.category),['button','link','input']);
 assert.equal(r.ui_affordances.groups[2].data_fields,'unknown');
 assert.equal(r.network_observation.approved_origin.fulfilled,1);
 assert.equal(r.network_observation.external.fetch_rejections,1);
 assert.equal(r.network_observation.control_to_api_links_verified,0);
 assert.equal(r.network_observation.response_fields_verified,0);
 assert.equal(r.gaps.find(x=>x.id==='external-dependency-access').status,'not-approved');
 assert.equal(r.decisions.ready_for_real_site_reimplementation,false);
 assert.equal(r.decisions.external_permissions_granted,false);
 assert.equal(r.decisions.original_site_requests_issued,0);
 const json=JSON.stringify(r);
 for(const secret of ['PRIVATE_CUSTOMER','SECRET_PASSWORD','DO_NOT_COPY',
  'private-api.example.net','/api/custom','other.example.org'])
  assert.ok(!json.includes(secret),'Leaked '+secret);
});
test('legacy/failing passive evidence preserves unknowns; no inferred API',()=>{
 const r=buildPassiveGapContract({mode:'dynamic-passive',
  inspection:{mode:'dynamic-passive',scope:'explicit-https-allowlist'},
  report:{analysis_mode:'dynamic-passive',verdict:'FAIL',fetch_rejections:3}});
 assert.equal(r.ui_affordances.observed_total,0);
 assert.equal(r.network_observation.external.groups,0);
 assert.equal(r.source_capture.network_details_complete,false);
 assert.equal(r.gaps.find(x=>x.id==='capture-completeness').priority,'incomplete');
 assert.equal(r.gaps.find(x=>x.id==='external-dependency-access').priority,'unobserved');
 assert.equal(r.gaps.find(x=>x.id==='response-field-schema').status,'unknown');
 for(const args of [
  {mode:'fixture-generic-planner',inspection:{mode:'dynamic-passive'}},
  {mode:'dynamic-passive',inspection:{mode:'static-html'}},
  {mode:'dynamic-passive',inspection:{mode:'dynamic-passive'},report:{analysis_mode:'fixture-causal'}}
 ])assert.throws(()=>buildPassiveGapContract(args),/F3_PASSIVE_GAP_SCOPE_DENIED/);
});
test('F3 passive gap GET is read only, bounded to saved passive mode and never starts a capture',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rea-f3-passive-gap-'));
 const sock=netServer();
 await new Promise(ok=>sock.listen(0,'127.0.0.1',ok));
 const port=sock.address().port;
 await new Promise(ok=>sock.close(ok));
 let captureCount=0;
 const studio=createStudioServer({storageDir:dir,studioPort:port,fixturePort:4317,
  approvedUrls:[],executor:async()=>{captureCount++;throw Error('CAPTURE_FORBIDDEN');},
  dynamicExecutor:async()=>{captureCount++;throw Error('NETWORK_FORBIDDEN');}});
 await studio.init();
 await new Promise(ok=>studio.server.listen(port,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+port;
 try{
  const meta=await studio.store.create({mode:'dynamic-passive',target_url:'https://private-target.example.org'});
  await studio.store.saveInspection(meta.id,evidence());
  await studio.store.saveReport(meta.id,{analysis_mode:'dynamic-passive',verdict:'FAIL',fetch_rejections:1});
  const url=base+'/api/runs/'+meta.id+'/passive-gap-contract';
  const a=await fetch(url),b=await fetch(url);
  assert.equal(a.status,200);assert.equal(b.status,200);
  assert.match(a.headers.get('content-disposition'),/attachment.*json/);
  assert.deepEqual(await a.json(),await b.json());
  assert.equal(captureCount,0);
  const missing=await studio.store.create({mode:'dynamic-passive',target_url:'https://other.example.org'});
  assert.equal((await fetch(base+'/api/runs/'+missing.id+'/passive-gap-contract')).status,404);
  const other=await studio.store.create({mode:'fixture-generic-planner',target_url:'http://127.0.0.1:4317/'});
  assert.equal((await fetch(base+'/api/runs/'+other.id+'/passive-gap-contract')).status,404);
  const homepage=await(await fetch(base+'/')).text();
  assert.match(homepage,/download-passive-gap-contract/);
  const app=await(await fetch(base+'/app.js')).text();
  assert.match(app,/passive-gap-contract/);
  assert.equal(captureCount,0);
 }finally{await new Promise(ok=>studio.server.close(ok));await rm(dir,{recursive:true,force:true});}
});
