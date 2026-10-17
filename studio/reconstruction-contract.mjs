// F1/F2 observed synthetic transition evidence -> F3 provenance -> F4 runnable contract.
// Does not infer missing actions, data, source code, endpoints or server behavior.
import {createHash} from 'node:crypto';
import {normalizeGenericBehaviorEvidence,generateGenericBehaviorHtml} from './generic-behavior.mjs';
import {buildObservedFeatureGraph,markObservedFeatureGraphVerified} from './behavior-exploration.mjs';

const fail=()=>{throw Error('F4_CONTRACT_EVIDENCE_MISMATCH');};
const digest=value=>createHash('sha256').update(value).digest('hex');
const match=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

/** Independent synthetic state contract for any bounded validated app_id.
 * This checks coherence but DOES NOT attest source authenticity.
 */
export function compileObservedStateContract({evidence,verifiedGraph,replay,html}={}){
 const model=normalizeGenericBehaviorEvidence(evidence);
 const planned=buildObservedFeatureGraph(evidence);
 const expected=markObservedFeatureGraphVerified(planned,replay);
 if(!match(verifiedGraph,expected)||typeof html!=='string'||
    Buffer.byteLength(html,'utf8')>50000||generateGenericBehaviorHtml(evidence)!==html||
    (replay?.unobserved_transitions_rejected!==undefined&&
     (!Number.isSafeInteger(replay.unobserved_transitions_rejected)||
      replay.unobserved_transitions_rejected<1))||
    replay?.simulated_api_calls!==planned.coverage_routes.reduce((n,r)=>n+
     r.path_edge_ids.reduce((m,id)=>m+planned.edges.find(e=>e.id===id).observed_api_requests,0),0))fail();
 return {
  schema_version:1,kind:'rea-observed-state-contract',
  scope:'controlled-synthetic-only',app_id:model.app_id,
  source:'bounded-controlled-chrome-evidence',
  verification:'internally-consistent-chrome-claims-not-source-attestation',
  executable_html_sha256:digest(html),executable_html_bytes:Buffer.byteLength(html,'utf8'),
  feature_graph_sha256:digest(JSON.stringify(verifiedGraph)),
  initial_state:{...model.initial},
  state_fields:model.fields.map(name=>({name,type:typeof model.initial[name],source:'observed-synthetic'})),
  actions:model.actions.map(a=>({id:a.id,label:a.label,source:'observed-synthetic',
   unobserved_effect:'unknown-not-generated'})),
  transitions:planned.edges.map(e=>({id:e.id,action:e.action,from:e.from,to:e.to,
   changed_fields:[...e.changed_fields],simulated_api_calls:e.observed_api_requests,
   effect_provenance:'observed-controlled-synthetic-only'})),
  states:planned.states.map(s=>({id:s.id,values:{...s.values}})),
  replay:{verified_routes:expected.verification.routes_verified,
   verified_edges:expected.verification.observed_edges_verified,
   observed_state_count:expected.metrics.unique_states,
   observed_route_coverage_pct:100,real_api_calls:0,
   rejected_unobserved_events:replay.unobserved_transitions_rejected??null},
  backend:{mode:'local-simulated-counters',real_endpoint_calls:0,
   recovered_original_api:false,recovered_original_data:false,recovered_database:false},
  unknowns:['unobserved_actions','unobserved_states','original_backend',
   'original_response_bodies','external_site_parity','responsive_visual_parity'],
  product_ready:false
 };
}

/** F3 join only for existing two audited Studio fixture modes. */
export function compileF3LinkedReconstructionContract({evidence,verifiedGraph,replay,html,manifest}={}){
 const contract=compileObservedStateContract({evidence,verifiedGraph,replay,html});
 if(!['catalog','analytics'].includes(contract.app_id)||
    manifest?.kind!=='evidence-manifest'||manifest?.schema_version!==1||
    manifest?.analysis_mode!==`fixture-generic-${contract.app_id}`||
    manifest?.evidence_scope!=='controlled-local-fixture'||
    manifest?.generated_artifacts?.generic_branching_prototype!==true||
    manifest?.generated_artifacts?.verified_feature_graph!==true||
    manifest?.generated_artifacts?.interaction_verification_scope!=='synthetic-only'||
    manifest?.network?.attribution_scope!=='controlled-synthetic-only'||
    manifest?.network?.causal_links_verified!==evidence.observed_action_api_links||
    manifest?.controlled_scenario?.feature_graph?.verification_scope!=='controlled-synthetic-only'||
    manifest.controlled_scenario.feature_graph.unique_states!==contract.states.length||
    manifest.controlled_scenario.feature_graph.observed_edges!==contract.transitions.length||
    manifest.controlled_scenario.feature_graph.verified_routes!==contract.replay.verified_routes||
    manifest.controlled_scenario.feature_graph.replay_steps!==replay.verified_steps||
    manifest?.controlled_scenario?.permission_policy?.unauthorized_actions_executed!==0||
    manifest?.controlled_scenario?.permission_policy?.scope!=='in-memory-synthetic-only'||
    manifest?.findings?.find(f=>f.id==='observed-function-graph')?.status!=='verified-synthetic-only')fail();
 return {...contract,f3:{manifest_sha256:digest(JSON.stringify(manifest)),
  verification:'cross-stage-consistent-synthetic-only',
  unknown_effects:'not-generated',external_source_parity:'not-tested'}};
}

/** Read-only stored artifact coherence, not a signed authenticity certificate. */
export function matchesStoredReconstructionContract(contract,{verifiedGraph,manifest,html}={}){
 const initial=verifiedGraph?.states?.find(s=>s.id==='s0')?.values;
 const actions=verifiedGraph?.relationships?.map(a=>({
  id:a.action,label:a.label,source:'observed-synthetic',
  unobserved_effect:'unknown-not-generated'}));
 const transitions=verifiedGraph?.edges?.map(e=>({id:e.id,action:e.action,from:e.from,to:e.to,
  changed_fields:[...e.changed_fields],simulated_api_calls:e.observed_api_requests,
  effect_provenance:'observed-controlled-synthetic-only'}));
 return contract?.schema_version===1&&contract?.kind==='rea-observed-state-contract'&&
  ['catalog','analytics'].includes(contract.app_id)&&
  contract.app_id===verifiedGraph?.app_id&&contract.product_ready===false&&
  contract.backend?.mode==='local-simulated-counters'&&
  contract.backend?.real_endpoint_calls===0&&
  contract.backend?.recovered_original_api===false&&
  contract.backend?.recovered_original_data===false&&
  contract.backend?.recovered_database===false&&
  contract.f3?.external_source_parity==='not-tested'&&
  match(contract.initial_state,initial)&&
  match(contract.states,verifiedGraph.states)&&
  match(contract.actions,actions)&&match(contract.transitions,transitions)&&
  contract.replay?.verified_edges===verifiedGraph.edges.length&&
  contract.replay?.verified_routes===verifiedGraph.coverage_routes?.length&&
  contract?.scope==='controlled-synthetic-only'&&
  contract?.f3?.verification==='cross-stage-consistent-synthetic-only'&&
  typeof html==='string'&&Buffer.byteLength(html,'utf8')<=50000&&
  digest(html)===contract.executable_html_sha256&&
  Buffer.byteLength(html,'utf8')===contract.executable_html_bytes&&
  verifiedGraph?.kind==='observed-function-graph'&&
  digest(JSON.stringify(verifiedGraph))===contract.feature_graph_sha256&&
  manifest?.kind==='evidence-manifest'&&
  digest(JSON.stringify(manifest))===contract.f3.manifest_sha256&&
  manifest.analysis_mode===`fixture-generic-${contract.app_id}`;
}
