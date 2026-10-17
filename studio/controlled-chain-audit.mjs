// F1/F2 -> F3 -> F4: cross-check one saved, controlled synthetic app
// without running Chrome, fetching a site, or trusting saved pass flags alone.
// F5 behavioral replay claims are checked for internal consistency only.
import {buildEvidenceManifest} from './evidence-manifest.mjs';
import {buildObservedFeatureGraph,markObservedFeatureGraphVerified} from './behavior-exploration.mjs';
import {generateGenericBehaviorHtml} from './generic-behavior.mjs';

const consistent=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const valid=n=>Number.isSafeInteger(n)&&n>=0;
const modes=new Set(['fixture-generic-catalog','fixture-generic-analytics']);
const stage=(status,reason)=>({status,reason});
export function auditSavedControlledChain({meta,report,inspection,manifest,graph,html}={}){
 const stages={
  f1_f2_observation:stage('MISSING','controlled_evidence_not_available'),
  f3_manifest:stage('MISSING','saved_manifest_not_verified'),
  f2_graph:stage('MISSING','saved_feature_graph_not_verified'),
  f4_independent_app:stage('MISSING','stored_app_not_verified'),
  f5_replay_claim:stage('UNKNOWN','separate_chrome_replay_not_performed')
 };
 const result={
  schema_version:1,kind:'rea-controlled-chain-offline-audit',
  status:'INCOMPLETE',scope:'controlled-synthetic-only',
  stages,counts:{states:0,edges:0,routes:0},
  network_requests_issued:0,browser_actions_executed:0,
  source_refetched:false,permissions_expanded:false,
  html_or_script_executed:false,real_site_verified:false,
  replay_independently_reexecuted:false,product_ready:false,
  privacy:{source_url_included:false,html_included:false,
   source_text_included:false,credentials_included:false}
 };
 if(!modes.has(meta?.mode)||meta?.status!=='completed')return result;
 if(report?.verdict!=='PASS'||report?.synthetic_fixture_only!==true||
    inspection?.mode!==meta.mode||inspection?.scope!=='controlled-fixture-only'||
    inspection?.exploration?.source!=='controlled-fixture-scenario'||
    inspection.exploration.permission_policy?.source!=='controlled-action-audit'||
    inspection.exploration.permission_policy?.scope!=='in-memory-synthetic-only'||
    inspection.exploration.permission_policy?.unauthorized_actions_executed!==0||
    inspection.exploration.permission_policy?.external_navigation_performed!==false||
    report.unauthorized_actions_executed!==0||
    report.action_policy_checked!==true){
  return result;
 }
 stages.f1_f2_observation=stage('VERIFIED','saved_synthetic_permission_and_observation');
 if(manifest!==null&&manifest!==undefined){
  try{
   if(report.evidence_manifest_available!==true||!consistent(manifest,buildEvidenceManifest(inspection,report)))
    throw Error('manifest mismatch');
   stages.f3_manifest=stage('VERIFIED','regenerated_f3_manifest_byte_equivalent_json');
  }catch{stages.f3_manifest=stage('CONFLICT','manifest_differs_from_observed_evidence');}
 }else if(report.evidence_manifest_available===true){
  stages.f3_manifest=stage('CONFLICT','manifest_claim_without_file');
 }
 if(graph!==null&&graph!==undefined){
  try{
   if(report.feature_graph_available!==true||
      report.feature_graph_source!=='observed-controlled-synthetic-only'||
      graph.scope!=='controlled-synthetic-only'||
      graph.kind!=='observed-function-graph'||
      graph.app_id!==(meta.mode==='fixture-generic-catalog'?'catalog':'analytics')||
      graph.verification?.status!=='verified-replayed-synthetic-only'||
      !Array.isArray(graph.states)||graph.states.length>20||
      !Array.isArray(graph.edges)||graph.edges.length<1||graph.edges.length>12)
    throw Error('graph header invalid');
   const states=new Map(graph.states.map(s=>[s.id,s.values]));
   if(states.size!==graph.states.length||!states.has('s0'))throw Error('states invalid');
   const steps=graph.edges.map(e=>{
    if(!states.has(e.from)||!states.has(e.to))throw Error('transition missing state');
    return {id:e.action,label:e.label,action:'click',status:'completed',
     attribution:'controlled-single-action-window',before:states.get(e.from),
     after:states.get(e.to),changed_fields:e.changed_fields,
     request_count:e.observed_api_requests,endpoint_paths:e.endpoint_paths};
   });
   const evidence={source:'controlled-generic-chrome',scope:'synthetic-only',
    verification:'real-isolated-chrome',app_id:graph.app_id,
    title:inspection.page?.title,initial:states.get('s0'),steps,
    observed_action_api_links:steps.reduce((n,s)=>n+s.request_count,0)};
   const planned=buildObservedFeatureGraph(evidence);
   const savedReplayProof={
    source:'controlled-generic-replay',scope:'synthetic-only',
    actual_api_calls:report.generic_replay_real_api_calls,
    verified_steps:report.generic_replay_verified_steps,
    observed_edge_coverage:report.feature_graph_verified_edges,
    verified_route_ids:planned.coverage_routes.map(r=>r.id)
   };
   const expected=markObservedFeatureGraphVerified(planned,savedReplayProof);
   if(!consistent(graph,expected)||
      graph.verification.routes_verified!==report.feature_graph_routes||
      graph.metrics.unique_states!==report.feature_graph_states||
      graph.metrics.route_count!==report.generic_branch_paths||
      graph.metrics.planned_clicks!==report.feature_graph_planned_clicks||
      report.generic_schema_version!==2||
      inspection.exploration.feature_graph_summary?.source!=='observed-function-graph'||
      inspection.exploration.feature_graph_summary.state_count!==graph.states.length||
      inspection.exploration.feature_graph_summary.edge_count!==graph.edges.length||
      inspection.exploration.feature_graph_summary.coverage_routes!==graph.metrics.route_count||
      inspection.exploration.feature_graph_summary.verified_replay_steps!==report.generic_replay_verified_steps)
    throw Error('cross-stage graph mismatch');
   stages.f2_graph=stage('VERIFIED','regenerated_observed_state_routes_and_report_consistent');
   result.counts={states:graph.states.length,edges:graph.edges.length,
    routes:graph.coverage_routes.length};
   if(typeof html==='string'&&Buffer.byteLength(html,'utf8')<=50000){
    if(report.generic_prototype_available!==true||generateGenericBehaviorHtml(evidence)!==html)
     throw Error('generated app mismatch');
    stages.f4_independent_app=stage('VERIFIED','regenerated_f4_html_byte_identical');
   }else if(report.generic_prototype_available===true){
    stages.f4_independent_app=stage('CONFLICT','missing_or_oversized_generated_html');
   }
   if(report.generic_replay_verified_steps===graph.metrics.planned_clicks&&
      report.generic_replay_real_api_calls===0&&
      graph.verification.observed_edges_verified===graph.edges.length)
    stages.f5_replay_claim=stage('CONSISTENT_SAVED_CLAIM','no_fresh_chrome_replay');
   else stages.f5_replay_claim=stage('CONFLICT','replay_counters_inconsistent');
  }catch{
   if(stages.f2_graph.status!=='VERIFIED')
    stages.f2_graph=stage('CONFLICT','stored_graph_or_observation_inconsistent');
   else stages.f4_independent_app=stage('CONFLICT','saved_prototype_differs_from_graph');
  }
 }else if(report.feature_graph_available===true){
  stages.f2_graph=stage('CONFLICT','feature_graph_claim_without_file');
 }
 if(Object.values(stages).some(x=>x.status==='CONFLICT'))result.status='EVIDENCE_CONFLICT';
 else if(stages.f1_f2_observation.status==='VERIFIED'&&
  stages.f3_manifest.status==='VERIFIED'&&
  stages.f2_graph.status==='VERIFIED'&&
  stages.f4_independent_app.status==='VERIFIED'&&
  stages.f5_replay_claim.status==='CONSISTENT_SAVED_CLAIM')
  result.status='SYNTHETIC_SAVED_CHAIN_CONSISTENT';
 return result;
}
