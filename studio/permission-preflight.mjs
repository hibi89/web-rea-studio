import {buildPassiveSupportPacket} from './support-packet.mjs';

// This is a non-executable permission planning document. Never treat a saved
// fetch attempt or a matching hostname as consent or network authorization.
const integer=(v)=>Number.isSafeInteger(v)&&v>=0&&v<=10000?v:null;
const DNS_LABEL=/^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
function classifyHost(host){
 if(typeof host!=='string'||host.length>180||!host.includes('.')||
  host.endsWith('.')||!host.split('.').every(x=>DNS_LABEL.test(x)))
  return 'invalid';
 const h=host.toLowerCase();
 if(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(h)||
    h.includes(':')||h==='localhost'||h.endsWith('.localhost')||
    h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.onion')||
    h.endsWith('.test')||h.endsWith('.invalid')||h.endsWith('.example')||
    h.endsWith('.arpa')||h.endsWith('.home')||
    ['example.com','example.net','example.org'].some(x=>h===x||h.endsWith('.'+x)))
  return 'special_use_or_address';
 // DNS wildcard-to-IP naming services can point a public-looking hostname
 // at an internal/private address. This is an offline warning, not a DNS check.
 if(['sslip.io','nip.io','xip.io'].some(x=>h===x||h.endsWith('.'+x)))
  return 'dynamic_ip_hostname_requires_dns_review';
 return 'hostname_only_unverified';
}
const FIELDS=['host_ownership_or_permission','exact_https_origin',
 'allowed_path_prefixes','allowed_methods','request_count_limit',
 'response_byte_limit','time_limit_seconds','credential_forwarding_policy',
 'cors_behavior','redirect_policy','dns_tls_ssrf_controls',
 'rollback_and_audit_plan'];
export function buildPassivePermissionPreflight({mode,report,inspection,diagnosis}={}){
 const packet=buildPassiveSupportPacket({mode,report,inspection,diagnosis});
 const candidates=packet.network.permission_review.candidate_hosts.slice(0,8).map(host=>({
  host,host_class:classifyHost(host),
  evidence:'same_host_fetch_attempt_and_rejection_observed',
  is_api_dependency_proven:false,
  remote_reachability_verified:false,
  cors_verified:false,
  network_permission_granted:false
 }));
 const flags={
  stored_passive_inspection:true,
  report_failed:packet.capture.verdict==='FAIL',
  fetch_rejections_present:(integer(packet.capture.fetch_rejections)??0)>0,
  evidence_incomplete:packet.network.evidence_incomplete===true,
  attribution_to_control_verified:false,
  host_candidates_observed:candidates.length>0,
  host_ownership_verified:false,
  path_scope_verified:false,
  method_scope_verified:false,
  budget_and_security_verified:false
 };
 const blockers=[];
 if(!flags.report_failed)blockers.push('failing_capture_not_confirmed');
 if(!flags.fetch_rejections_present)blockers.push('fetch_rejection_not_confirmed');
 if(flags.evidence_incomplete)blockers.push('saved_event_evidence_incomplete');
 if(!candidates.length)blockers.push('matched_external_host_evidence_missing');
 if(candidates.some(c=>c.host_class!=='hostname_only_unverified'))
  blockers.push('unsafe_or_non_public_host_candidate');
 blockers.push('host_ownership_or_permission_not_verified');
 blockers.push('exact_path_and_method_scope_missing');
 blockers.push('request_limits_and_network_safety_not_verified');
 blockers.push('cors_and_remote_reachability_not_verified');
 return {
  schema_version:1,kind:'rea-q1-offline-permission-preflight',
  source:'saved-failed-passive-evidence',
  network_requests_issued:0,browser_actions_executed:0,
  target_scope:'not_fully_identified_by_sanitized_evidence',
  permission_status:'NOT_APPROVED',
  executable_policy_generated:false,auto_allowlist_changes:0,
  decision:'BLOCK_NETWORK_EXPANSION',
  evidence:{diagnosis_code:packet.diagnosis_code,
   capture_verdict:packet.capture.verdict,
   fetch_rejections:packet.capture.fetch_rejections,
   browser_blocked:packet.capture.blocked,
   event_groups_observed:packet.network.groups.length,
   evidence_incomplete:flags.evidence_incomplete,
   observed_control_to_api_links:packet.network.verified_control_to_api_links},
  flags,host_candidates:candidates,blockers,
  authorization_requirements:FIELDS.map(field=>({field,status:'not_verified',value:null})),
  safe_next_step:candidates.length?
   'Review the stored support packet locally; confirm authority and exact host/path/method with the owner before proposing any narrowly scoped opt-in connection':
   'Review saved browser evidence locally; without matched external host evidence do not assume a cross-origin API is the cause',
  warnings:['Observed hostname is not permission or proof of an API dependency',
   'No executable allowlist or network relay is created by this review',
   'The original live dashboard and remote CORS behavior remain unverified',
   'Review hostnames locally before sharing the output']
 };
}
