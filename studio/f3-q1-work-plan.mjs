// Deterministic offline planning from one saved F3/Q1 passive run.
// Presence only can support a wireframe *plan*, never source parity or actions.
import {assessF3Q1Readiness} from './f3-q1-readiness.mjs';
import {buildPassiveGapContract} from './passive-gap-contract.mjs';

const categories=new Set(['button','link','tab','select','textarea','input','interactive','unknown']);
const sane=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000?n:0;
const task=(id,priority,area,status,reason,required_evidence)=>({
 id,priority,area,status,reason,required_evidence,
 verified_implementation:false,original_site_parity:false,
 authorization_granted:false
});
export function planF3Q1Work({mode,inspection,report,diagnosis}={}){
 if(mode!=='dynamic-passive'||inspection?.mode!=='dynamic-passive'||
   (report?.analysis_mode!==undefined&&report.analysis_mode!=='dynamic-passive'))
  throw Error('F3_Q1_PLAN_SCOPE_DENIED');
 const args={mode,inspection,report,diagnosis};
 const readiness=assessF3Q1Readiness(args);
 const gap=buildPassiveGapContract(args);
 const coherent=readiness.evidence.integrity!=='CONFLICTING_SAVED_OBSERVATIONS'&&
  readiness.evidence.conflicts.length===0&&
  readiness.evidence.observed_ui_controls===gap.ui_affordances.observed_total&&
  readiness.evidence.saved_external_groups===gap.network_observation.external.groups&&
  readiness.evidence.saved_origin_groups===gap.network_observation.approved_origin.groups&&
  readiness.unresolved_gap_ids.length===gap.gaps.length&&
  readiness.decision==='BLOCK_REAL_SITE_RECONSTRUCTION'&&
  readiness.network_decision==='BLOCK_NETWORK_EXPANSION'&&
  readiness.permission_status==='NOT_APPROVED';
 const structure=coherent&&readiness.offline_structure_planning==='OBSERVED_UI_CATEGORIES_ONLY';
 const items=[
  task('verify-saved-provenance',0,'evidence',
   coherent?'REVIEW_REQUIRED':'BLOCKED',
   coherent?'SAVED_OBSERVATIONS_ONLY':'EVIDENCE_CONFLICT',
   'inspect-original-saved-passive-capture-within-local-permission')
 ];
 for(const [i,entry] of gap.ui_affordances.groups.entries()){
  if(!categories.has(entry.category))continue;
  items.push({...task('presence-plan-'+entry.category,1,'ui-presence',
    structure?'PLANNABLE_OFFLINE_ONLY':'BLOCKED',
    structure?'CONTROL_PRESENCE_ONLY':'INCOMPLETE_OR_CONFLICTED_EVIDENCE',
    'observed-control-count-and-separate-UI-geometry-proof'),
   observed_controls:sane(entry.observed_count),order:i});
 }
 if(!gap.ui_affordances.groups.length)items.push(
  task('presence-plan-unavailable',1,'ui-presence','BLOCKED',
   'VISIBLE_CONTROL_EVIDENCE_MISSING','authorized-passive-control-inventory'));
 items.push(
  task('capture-completeness',2,'evidence','BLOCKED',
   gap.source_capture.verdict==='capture-failed'?'FAILED_SOURCE_CAPTURE':'UNVERIFIED_CAPTURE_COMPLETENESS',
   'separately-authorized-complete-source-observation'),
  task('verify-real-action-transitions',3,'behavior','BLOCKED',
   'NO_APPROVED_ACTION_REPLAY','owner-authorized-action-window-and-state-diff'),
  task('verify-control-api-links',4,'api-causality','BLOCKED',
   'CONTROL_TO_API_UNVERIFIED','explicitly-authorized-control-to-request-proof'),
  task('specify-response-fields',5,'data-schema','BLOCKED',
   'NO_VERIFIED_RESPONSE_FIELDS','owner-provided-redacted-response-field-contract'),
  task('backend-and-database',6,'backend','BLOCKED',
   'ORIGINAL_SERVER_AND_STORAGE_UNKNOWN','owner-provided-server-and-database-contract'),
  task('external-api-permission',7,'external-network','BLOCKED',
   'NETWORK_SCOPE_NOT_APPROVED','separate-ownership-origin-path-method-budget-and-security-review'),
  task('prove-original-parity',8,'verification','BLOCKED',
   'SOURCE_BEHAVIOR_AND_DATA_UNVERIFIED','independent-authorized-real-source-equivalence-evidence')
 );
 const counts={total:items.length,plannable_offline:items.filter(x=>x.status==='PLANNABLE_OFFLINE_ONLY').length,
  review_required:items.filter(x=>x.status==='REVIEW_REQUIRED').length,
  blocked:items.filter(x=>x.status==='BLOCKED').length};
 return {
  schema_version:1,kind:'rea-f3-q1-offline-work-plan',
  scope:'same-saved-passive-run-only',
  overall_decision:'BLOCK_REAL_SITE_RECONSTRUCTION',
  permission_status:'NOT_APPROVED',network_decision:'BLOCK_NETWORK_EXPANSION',
  status:!coherent?'EVIDENCE_CONFLICT':structure?'UI_PRESENCE_PLANNING_ONLY':'INSUFFICIENT_EVIDENCE',
  counts,items,
  next_step:!coherent?'RECONCILE_SAVED_EVIDENCE_BEFORE_PLANNING':
   structure?'OUTLINE_NONINTERACTIVE_UI_CATEGORIES_ONLY':'OBTAIN_VERIFIED_VISIBLE_CONTROL_EVIDENCE',
  output_constraints:{html_generated:false,code_generated:false,
   original_site_behavior_implemented:false,real_api_used:false,real_database_recovered:false,
   new_approvals_granted:false,source_requests_issued:0,browser_actions_executed:0,
   original_site_parity:false,product_ready:false},
  privacy:{hostnames_included:false,urls_or_paths_included:false,
   control_labels_included:false,form_values_included:false,
   response_bodies_included:false,credentials_included:false},
  limitations:[
   'Presence-only control categories support an offline wireframe planning task, not cloned UI behavior',
   'All real actions, schemas, backend, external network and source parity remain blocked',
   'Missing or conflicting saved evidence blocks even local UI presence planning',
   'This is a task prioritization report and does not write or execute implementation code'
  ]
 };
}
