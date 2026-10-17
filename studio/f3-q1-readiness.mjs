// F3/Q1 read-only cross-stage decision. No calls, discovery, consent inference,
// output hostnames, paths, labels, secrets or generated authorization policies.
import {buildPassiveGapContract} from './passive-gap-contract.mjs';
import {buildPassiveSupportPacket} from './support-packet.mjs';
import {buildPassivePermissionPreflight} from './permission-preflight.mjs';
import {assessSavedQ1Failure} from './q1-failure-assessment.mjs';

const sane=x=>Number.isSafeInteger(x)&&x>=0&&x<=10000?x:null;
const sum=(records,key)=>records.reduce((n,r)=>n+(sane(r[key])??0),0);
const validFailures=new Set(['SCHEMA_OR_PROVENANCE_MISMATCH','COUNT_MISMATCH',
 'HOST_EVIDENCE_CONFLICT','PERMISSION_STATE_CONFLICT']);
const validRequirements=new Set(['host_ownership_or_permission','exact_https_origin',
 'allowed_path_prefixes','allowed_methods','request_count_limit',
 'response_byte_limit','time_limit_seconds','credential_forwarding_policy',
 'cors_behavior','redirect_policy','dns_tls_ssrf_controls','rollback_and_audit_plan']);

export function assessF3Q1Readiness({mode,inspection,report,diagnosis}={}){
 if(mode!=='dynamic-passive'||inspection?.mode!=='dynamic-passive'||
    (report?.analysis_mode!==undefined&&report.analysis_mode!=='dynamic-passive'))
  throw Error('F3_Q1_SCOPE_DENIED');
 const args={mode,inspection,report,diagnosis};
 const gap=buildPassiveGapContract(args);
 const packet=buildPassiveSupportPacket(args);
 const preflight=buildPassivePermissionPreflight(args);
 const assessment=assessSavedQ1Failure({packet,preflight});
 const groups=packet.network.groups||[];
 const external=groups.filter(g=>g.scope==='external');
 const same=groups.filter(g=>g.scope==='approved-origin');
 const conflicts=[];
 if(gap.source_capture.verdict!==(
   packet.capture.verdict==='FAIL'?'capture-failed':
   packet.capture.verdict==='PASS_NOT_EQUIVALENCE'?'capture-pass-not-parity':'unknown'))
  conflicts.push('CAPTURE_STATUS_CONFLICT');
 if(gap.network_observation.external.groups!==external.length||
    gap.network_observation.approved_origin.groups!==same.length||
    gap.network_observation.external.fetch_rejections!==sum(external,'fetch_rejections')||
    gap.network_observation.approved_origin.fulfilled!==sum(same,'browser_fulfilled')||
    preflight.evidence.event_groups_observed!==groups.length)
  conflicts.push('F1_F2_F3_OBSERVATION_COUNT_CONFLICT');
 if(packet.network.verified_control_to_api_links!==0||
    gap.network_observation.control_to_api_links_verified!==0||
    gap.network_observation.endpoint_contracts_verified!==0||
    gap.network_observation.response_fields_verified!==0||
    gap.decisions.external_permissions_granted!==false||
    gap.decisions.ready_for_real_site_reimplementation!==false||
    preflight.permission_status!=='NOT_APPROVED'||
    preflight.decision!=='BLOCK_NETWORK_EXPANSION'||
    preflight.executable_policy_generated!==false||
    preflight.auto_allowlist_changes!==0||
    assessment.permission_status!=='NOT_APPROVED'||
    assessment.decision!=='BLOCK_NETWORK_EXPANSION'||
    assessment.network_permission_granted!==false)
  conflicts.push('UNSUPPORTED_PRIVILEGE_OR_CAUSALITY_CLAIM');
 if(assessment.evidence_status==='INCONSISTENT'||
    assessment.evidence_conflicts?.length)
  conflicts.push('Q1_EVIDENCE_CONFLICT');
 const validated=conflicts.length===0;
 const missingRequirements=(preflight.authorization_requirements||[])
  .filter(x=>validRequirements.has(x.field)&&x.status==='not_verified')
  .map(x=>x.field);
 const reasons=[
  ...(validated?[]:['SAVED_EVIDENCE_CONFLICT']),
  ...(gap.source_capture.verdict!=='capture-failed'?['FAILED_CAPTURE_NOT_VERIFIED']:[]),
  ...(gap.network_observation.reported_fetch_details_incomplete?['NETWORK_EVIDENCE_INCOMPLETE']:[]),
  ...(gap.ui_affordances.observed_total===0?['VISIBLE_CONTROL_EVIDENCE_MISSING']:[]),
  'ACTION_EFFECT_AND_STATE_TRANSITION_UNKNOWN',
  'CONTROL_API_CAUSALITY_NOT_VERIFIED',
  'RESPONSE_FIELDS_AND_BACKEND_NOT_VERIFIED',
  'EXTERNAL_ORIGIN_METHOD_PATH_NOT_AUTHORIZED',
  'REMOTE_SERVICE_AND_CORS_NOT_VERIFIED'
 ];
 return {
  schema_version:1,kind:'rea-f3-q1-offline-reconstruction-readiness',
  scope:'same-saved-passive-run-read-only',
  decision:'BLOCK_REAL_SITE_RECONSTRUCTION',
  network_decision:'BLOCK_NETWORK_EXPANSION',
  permission_status:'NOT_APPROVED',source_site_functional_parity:false,
  offline_structure_planning:validated&&gap.ui_affordances.observed_total>0?
   'OBSERVED_UI_CATEGORIES_ONLY':'INSUFFICIENT_OR_CONFLICTING_EVIDENCE',
  evidence:{integrity:validated?
   assessment.evidence_status==='BOUNDED'?'BOUNDED_SAVED_OBSERVATIONS':
    'PARTIAL_SAVED_OBSERVATIONS':'CONFLICTING_SAVED_OBSERVATIONS',
   capture_verdict:gap.source_capture.verdict,
   matched_host_candidates_count:sane(preflight.host_candidates.length),
   observed_ui_controls:gap.ui_affordances.observed_total,
   saved_origin_groups:gap.network_observation.approved_origin.groups,
   saved_external_groups:gap.network_observation.external.groups,
   fetch_rejections_reported:sane(packet.capture.fetch_rejections),
   q1_local_policy_finding:assessment.finding,
   q1_compatibility_is_causality:false,
   q1_evidence_status:assessment.evidence_status,
   conflicts:[...new Set([...conflicts,...(assessment.evidence_conflicts||[])
    .filter(x=>validFailures.has(x))])],
   authorization_missing_fields:missingRequirements
  },
  blockers:[...new Set(reasons)],
  unresolved_gap_ids:gap.gaps.map(x=>x.id),
  next_evidence:[
   {id:'owner-authority',status:'not_verified',
    action:'verify-owner-authorization-outside-automated-pipeline'},
   {id:'network-scope',status:'not_verified',
    action:'separately-approve-exact-origin-path-method-and-budgets'},
   {id:'behavior-and-data',status:'unknown',
    action:'supply-authorized-action-evidence-and-redacted-data-schema'},
   {id:'capture-completeness',status:'not_proven',
    action:'review-saved-passive-capture-and-evidence-gaps'}
  ],
  execution:{source_recontacted:false,browser_launched:false,
   network_requests_issued:0,actions_executed:0,
   policy_files_written:false,approval_granted:false,product_ready:false},
  privacy:{hostnames_included:false,raw_urls_or_paths_included:false,
   labels_or_form_values_included:false,response_bodies_included:false,
   credentials_included:false},
  limitations:[
   'Observed host or resource does not establish host ownership, consent or functional necessity',
   'F1-F3 presence evidence cannot prove actions, API field schemas or original database',
   'A Q1 local-policy-compatible failure is not proven CORS or remote service causality',
   'No source site, API or browser was contacted to generate this decision'
  ]
 };
}
