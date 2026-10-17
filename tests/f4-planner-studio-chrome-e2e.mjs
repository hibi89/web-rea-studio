// End-to-end: a real isolated Chrome observes a third synthetic source,
// then the real Studio saves, audits and exports its independent HTML.
// This does not touch any external website or actual API.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tcpServer} from 'node:net';
import {createHash} from 'node:crypto';
import {createStudioServer} from '../studio/server.mjs';

if(!process.env.CHROME_BIN)throw Error('PLANNER_STUDIO_REAL_CHROME_REQUIRED');
async function freePort(){
 const s=tcpServer();
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 const port=s.address().port;
 await new Promise(resolve=>s.close(resolve));
 return port;
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=await mkdtemp(join(tmpdir(),'rea-planner-studio-chrome-'));
const port=await freePort(),fixturePort=await freePort();
const studio=createStudioServer({
 studioPort:port,fixturePort,storageDir:root,approvedUrls:[],
 browserPath:process.env.CHROME_BIN
});
await studio.init();
await new Promise(resolve=>studio.server.listen(port,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+port;
const json=async path=>{
 const r=await fetch(origin+path);
 assert.equal(r.status,200,path+': HTTP '+r.status);
 return r.json();
};
let id,observerCalls=0;
try{
 const invalid=await fetch(origin+'/api/runs',{method:'POST',
  headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({target_url:'https://not-approved.example/',analysis_mode:'fixture-generic-planner'})});
 assert.equal(invalid.status,400,'unapproved target remains disallowed');
 const response=await fetch(origin+'/api/runs',{method:'POST',
  headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({target_url:'http://127.0.0.1:'+fixturePort+'/',analysis_mode:'fixture-generic-planner'})});
 assert.equal(response.status,202);
 id=(await response.json()).id;
 let meta;
 const deadline=Date.now()+45000;
 while(Date.now()<deadline){
  meta=await json('/api/runs/'+id);
  if(!['queued','running'].includes(meta.status))break;
  await sleep(90);
 }
 assert.equal(meta?.status,'completed',JSON.stringify(meta));
 const report=await json('/api/runs/'+id+'/report');
 assert.equal(report.verdict,'PASS');assert.equal(report.action_policy_checked,true);
 assert.equal(report.approved_dom_controls,3);assert.ok(report.denied_dom_controls>=4);
 assert.equal(report.unauthorized_actions_executed,0);
 assert.equal(report.feature_graph_states,4);assert.equal(report.feature_graph_routes,2);
 assert.equal(report.feature_graph_verified_edges,3);
 assert.equal(report.generic_replay_real_api_calls,0);
 assert.equal(report.reconstruction_contract_available,true);
 const inspection=await json('/api/runs/'+id+'/inspection');
 assert.equal(inspection.mode,'fixture-generic-planner');
 assert.equal(inspection.exploration.state_transitions.steps.length,3);
 const manifest=await json('/api/runs/'+id+'/manifest');
 assert.equal(manifest.analysis_mode,'fixture-generic-planner');
 assert.equal(manifest.generated_artifacts.generic_branching_prototype,true);
 assert.deepEqual(manifest.controlled_scenario.state_transitions[0].changes.map(x=>x.field),
  ['day','slots']);
 const graph=await json('/api/runs/'+id+'/feature-graph');
 assert.equal(graph.app_id,'planner');
 assert.deepEqual(graph.coverage_routes.map(x=>x.actions),[['day','view'],['view']]);
 const contract=await json('/api/runs/'+id+'/reconstruction-contract');
 assert.equal(contract.app_id,'planner');
 assert.equal(contract.f3.verification,'cross-stage-consistent-synthetic-only');
 assert.deepEqual(contract.initial_state,{day:'monday',layout:'list',slots:4});
 assert.equal(contract.backend.real_endpoint_calls,0);
 assert.equal(contract.product_ready,false);
 const audit=await json('/api/runs/'+id+'/controlled-chain-audit');
 assert.equal(audit.status,'SYNTHETIC_SAVED_CHAIN_CONSISTENT');
 assert.equal(audit.replay_independently_reexecuted,false);
 const receipt=await json('/api/runs/'+id+'/delivery-receipt');
 assert.equal(receipt.export_eligible,true);
 assert.equal(receipt.artifact.filename,'rea-reviewed-synthetic-planner.html');
 const preview=await fetch(origin+'/api/runs/'+id+'/generic-prototype');
 assert.equal(preview.status,200);
 const html=await preview.text();
 assert.doesNotMatch(html,/fetch\s*\(|XMLHttpRequest|https?:\/\//);
 const reviewed=await fetch(origin+'/api/runs/'+id+'/reviewed-export');
 assert.equal(reviewed.status,200);
 assert.equal(await reviewed.text(),html);
 assert.equal(receipt.artifact.sha256,createHash('sha256').update(html).digest('hex'));
 const manifestFile=join(root,id,'manifest.json');
 const saved=await readFile(manifestFile,'utf8');
 await writeFile(manifestFile,JSON.stringify({...manifest,analysis_mode:'dynamic-passive'}));
 assert.equal((await json('/api/runs/'+id+'/controlled-chain-audit')).status,'EVIDENCE_CONFLICT');
 assert.equal((await json('/api/runs/'+id+'/delivery-receipt')).export_eligible,false);
 assert.equal((await fetch(origin+'/api/runs/'+id+'/reviewed-export')).status,409);
 assert.equal((await fetch(origin+'/api/runs/'+id+'/reconstruction-contract')).status,409);
 await writeFile(manifestFile,saved);
 assert.equal((await json('/api/runs/'+id+'/delivery-receipt')).export_eligible,true);
 console.log(JSON.stringify({planner_studio_full_chrome:'PASS',actions:3,
  routes:2,states:4,external_api_calls:0,html_bytes:Buffer.byteLength(html),
  contract_sha256:contract.executable_html_sha256,manifest_tamper_export_blocked:true,
  real_source_site_parity:false}));
}finally{
 await new Promise(resolve=>studio.server.close(resolve));
 await rm(root,{recursive:true,force:true,maxRetries:4,retryDelay:150});
}
