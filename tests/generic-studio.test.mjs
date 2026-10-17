import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as netServer} from 'node:net';
import {createStudioServer} from '../studio/server.mjs';
import {normalizeGenericBehaviorEvidence} from '../studio/generic-behavior.mjs';
import {buildObservedFeatureGraph} from '../studio/behavior-exploration.mjs';
async function freePort(){const s=netServer();await new Promise(ok=>s.listen(0,'127.0.0.1',ok));const p=s.address().port;await new Promise(ok=>s.close(ok));return p;}
async function until(check){
 const deadline=Date.now()+4000;
 while(Date.now()<deadline){const x=await check();if(x)return x;await new Promise(ok=>setTimeout(ok,20));}
 throw Error('Generic Studio test timeout');
}
function observed(id){
 const analytics=id==='analytics';
 const initial=analytics?{chart:'bar',range:'week',total:12}:{category:'all',count:8,layout:'grid'};
 const first=analytics?{...initial,range:'month',total:31}:{...initial,category:'summer',count:3};
 const second=analytics?{...first,chart:'line'}:{...first,layout:'list'};
 const alternate=analytics?{...initial,chart:'line'}:{...initial,layout:'list'};
 const names=analytics?['range','chart']:['filter','layout'];
 const labels=analytics?['기간 확대','차트 전환']:['카테고리 변경','목록 표시'];
 const endpoint=analytics?'/api/metrics':'/api/items';
 const state=(index,from,to,calls=0)=>{
  const fields=Object.keys(from).sort().filter(k=>from[k]!==to[k]);
  return {id:names[index],label:labels[index],before:from,after:to,action:'click',
   status:'completed',changed_fields:fields,request_count:calls,
   endpoint_paths:calls?[endpoint]:[],attribution:'controlled-single-action-window'};
 };
 return {source:'controlled-generic-chrome',scope:'synthetic-only',
  verification:'real-isolated-chrome',app_id:id,
  title:analytics?'분석 대시보드 실험':'상품 목록 실험',
  initial,observed_action_api_links:1,
  execution_policy:{source:'controlled-action-audit',scope:'in-memory-synthetic-only',
   authorized_controls:3,denied_controls:4,unauthorized_actions_executed:0,
   external_navigation_performed:false,form_submissions_performed:0,
   approved_action_ids:analytics?['range','chart','reset']:['filter','layout','reset']},
  steps:[state(0,initial,first,1),state(1,first,second),state(1,initial,alternate)]};
}
test('generic Studio modes are exact-fixture-only and persist Chrome-verified branching prototypes',async()=>{
 const port=await freePort(),fixturePort=await freePort();
 const dir=await mkdtemp(join(tmpdir(),'webrea-generic-studio-'));
 const fixture='http://127.0.0.1:'+fixturePort+'/',external='https://approved.example.org/';
 const observedApps=[],replayedApps=[];
 const studio=createStudioServer({studioPort:port,fixturePort,storageDir:dir,
  approvedUrls:[external],browserPath:'/fake/chrome',
  genericObserver:async({browserPath,appId})=>{
   assert.equal(browserPath,'/fake/chrome');
   observedApps.push(appId);
   return observed(appId);
  },
  genericVerifier:async({browserPath,evidence,html})=>{
   assert.equal(browserPath,'/fake/chrome');
   const graph=normalizeGenericBehaviorEvidence(evidence);
   const explored=buildObservedFeatureGraph(evidence);
   assert.match(html,/Controlled Generic Replay/);
   assert.doesNotMatch(html,/fetch\s*\(|https?:\/\//);
   replayedApps.push(evidence.app_id);
   return {source:'controlled-generic-replay',scope:'synthetic-only',
    verified_steps:explored.metrics.planned_clicks,actual_api_calls:0,
    observed_edge_coverage:graph.edges.length,
    verified_route_ids:explored.coverage_routes.map(r=>r.id),
    simulated_api_calls:1,branching:true};
  }});
 await studio.init();await new Promise(ok=>studio.server.listen(port,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+port;
 const post=body=>fetch(base+'/api/runs',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  for(const mode of ['fixture-generic-catalog','fixture-generic-analytics']){
   assert.equal((await post({target_url:external,analysis_mode:mode})).status,400);
   assert.equal((await post({target_url:fixture+'other',analysis_mode:mode})).status,400);
   const response=await post({target_url:fixture,analysis_mode:mode});
   assert.equal(response.status,202);
   const id=(await response.json()).id;
   await until(async()=>{const m=await(await fetch(base+'/api/runs/'+id)).json();return m.status==='completed';});
   const report=await(await fetch(base+'/api/runs/'+id+'/report')).json();
   assert.equal(report.analysis_mode,mode);
   assert.equal(report.generic_prototype_available,true);
   assert.equal(report.feature_graph_available,true);
   assert.equal(report.feature_graph_verified_edges,3);
   assert.equal(report.feature_graph_routes,2);
   assert.equal(report.feature_graph_states,4);
   assert.equal(report.feature_graph_planned_clicks,3);
   assert.equal(report.action_policy_checked,true);
   assert.equal(report.approved_dom_controls,3);
   assert.equal(report.denied_dom_controls,4);
   assert.equal(report.unauthorized_actions_executed,0);
   assert.equal(report.generic_replay_verified_steps,3);
   assert.equal(report.generic_replay_real_api_calls,0);
   assert.equal(report.generic_branch_paths,2);
   assert.equal(report.generic_reachable_states,4);
   assert.equal(report.evidence_manifest_available,true);
   assert.equal(report.reconstruction_contract_available,true);
   const inspection=await(await fetch(base+'/api/runs/'+id+'/inspection')).json();
   assert.equal(inspection.exploration.verified_action_api_links,1);
   assert.equal(inspection.exploration.state_transitions.steps.length,3);
   const manifest=await(await fetch(base+'/api/runs/'+id+'/manifest')).json();
   assert.equal(manifest.analysis_mode,mode);
   assert.equal(manifest.network.causal_links_verified,1);
   assert.equal(manifest.controlled_scenario.permission_policy.authorized_controls,3);
   assert.equal(manifest.controlled_scenario.permission_policy.denied_controls,4);
   assert.equal(manifest.findings.find(f=>f.id==='synthetic-action-permissions').status,'verified-synthetic-only');
   assert.equal(manifest.network.attribution_scope,'controlled-synthetic-only');
   assert.equal(manifest.generated_artifacts.generic_branching_prototype,true);
   assert.equal(manifest.generated_artifacts.verified_feature_graph,true);
   assert.equal(manifest.controlled_scenario.feature_graph.unique_states,4);
   assert.equal(manifest.controlled_scenario.feature_graph.observed_edges,3);
   assert.equal(manifest.controlled_scenario.feature_graph.verified_routes,2);
   const graphResponse=await fetch(base+'/api/runs/'+id+'/feature-graph');
   assert.equal(graphResponse.status,200);
   assert.match(graphResponse.headers.get('content-disposition'),/attachment.*json/);
   const saved=await graphResponse.json();
   assert.equal(saved.verification.status,'verified-replayed-synthetic-only');
   assert.equal(saved.edges.length,3);
   assert.equal(saved.states.length,4);
   assert.deepEqual(saved.coverage_routes.map(r=>r.actions),mode==='fixture-generic-catalog'?
    [['filter','layout'],['layout']]:[['range','chart'],['chart']]);
   assert.deepEqual(saved.coverage_routes.map(r=>r.verified_in_source),[true,true]);
   const preview=await fetch(base+'/api/runs/'+id+'/generic-prototype');
   assert.equal(preview.status,200);
   assert.match(preview.headers.get('content-security-policy'),/connect-src 'none'/);
   assert.doesNotMatch(preview.headers.get('content-disposition')||'',/attachment/);
   const html=await preview.text();
   assert.match(html,/reset-flow/);
   assert.match(html,/state-/);
   assert.doesNotMatch(html,/\bfetch\s*\(|https?:\/\//);
   const download=await fetch(base+'/api/runs/'+id+'/generic-prototype-download');
   assert.equal(download.status,200);
   assert.match(download.headers.get('content-disposition'),/attachment.*html/);
   assert.equal(await download.text(),html);
   const contractResponse=await fetch(base+'/api/runs/'+id+'/reconstruction-contract');
   assert.equal(contractResponse.status,200);
   assert.match(contractResponse.headers.get('content-disposition'),/attachment.*json/);
   const contract=await contractResponse.json();
   assert.equal(contract.scope,'controlled-synthetic-only');
   assert.equal(contract.app_id,mode.slice('fixture-generic-'.length));
   assert.equal(contract.product_ready,false);
   assert.equal(contract.f3.verification,'cross-stage-consistent-synthetic-only');
   assert.equal(contract.replay.verified_edges,3);
   assert.equal(contract.backend.real_endpoint_calls,0);
   const graphFile=join(dir,id,'function-graph.json');
   const originalGraph=await readFile(graphFile,'utf8');
   await writeFile(graphFile,JSON.stringify({...JSON.parse(originalGraph),unsafe_extra:'tampered'}));
   assert.equal((await fetch(base+'/api/runs/'+id+'/reconstruction-contract')).status,409);
   await writeFile(graphFile,originalGraph);
   assert.equal((await fetch(base+'/api/runs/'+id+'/reconstruction-contract')).status,200);
   assert.equal((await fetch(base+'/api/runs/'+id+'/behavior-prototype')).status,404);
  }
  assert.deepEqual(observedApps,['catalog','analytics']);
  assert.deepEqual(replayedApps,['catalog','analytics']);
  const bad='00000000-0000-4000-8000-000000000000';
  assert.equal((await fetch(base+'/api/runs/'+bad+'/generic-prototype')).status,404);
  assert.equal((await fetch(base+'/api/runs/'+bad+'/feature-graph')).status,404);
  const html=await(await fetch(base+'/')).text();
  assert.match(html,/value="fixture-generic-catalog"/);
  assert.match(html,/value="fixture-generic-analytics"/);
  assert.match(html,/id="feature-graph-panel"/);
  assert.match(html,/id="download-feature-graph"/);
  const app=await(await fetch(base+'/app.js')).text();
  assert.match(app,/generic_prototype_available/);
  assert.match(app,/feature_graph_available/);
  assert.match(app,/\/generic-prototype-download/);
 }finally{await new Promise(ok=>studio.server.close(ok));await rm(dir,{recursive:true,force:true});}
});

test('generic Studio rejects missing permission proof before saving or replaying a prototype',async()=>{
 const port=await freePort(),fixturePort=await freePort();
 const dir=await mkdtemp(join(tmpdir(),'webrea-permission-denial-'));
 const target='http://127.0.0.1:'+fixturePort+'/';
 let replayCalls=0;
 const studio=createStudioServer({studioPort:port,fixturePort,storageDir:dir,
  browserPath:'/fake/chrome',approvedUrls:[],
  genericObserver:async()=>({...observed('catalog'),execution_policy:{
   source:'controlled-action-audit',scope:'in-memory-synthetic-only',
   authorized_controls:3,denied_controls:4,
   unauthorized_actions_executed:1,external_navigation_performed:false,
   form_submissions_performed:0,approved_action_ids:['filter','layout','reset']
  }}),
  genericVerifier:async()=>{replayCalls++;throw Error('should not execute');}
 });
 await studio.init();await new Promise(ok=>studio.server.listen(port,'127.0.0.1',ok));
 const base='http://127.0.0.1:'+port;
 try{
  const response=await fetch(base+'/api/runs',{method:'POST',
   headers:{Origin:base,'Content-Type':'application/json'},
   body:JSON.stringify({target_url:target,analysis_mode:'fixture-generic-catalog'})});
  assert.equal(response.status,202);
  const id=(await response.json()).id;
  await until(async()=>{const x=await(await fetch(base+'/api/runs/'+id)).json();return x.status==='failed';});
  assert.equal(replayCalls,0);
  assert.equal((await fetch(base+'/api/runs/'+id+'/generic-prototype')).status,404);
  assert.equal((await fetch(base+'/api/runs/'+id+'/generic-prototype-download')).status,404);
 }finally{
  await new Promise(ok=>studio.server.close(ok));
  await rm(dir,{recursive:true,force:true});
 }
});
