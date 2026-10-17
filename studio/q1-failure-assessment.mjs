// Q1 saved-evidence assessment. This never contacts observed or test hosts.
// It reads only already-redacted packet/preflight data and actual local policy.
import {approveBrowserRequest,LOCKDOWN_CSP} from './dynamic-gateway.mjs';

const count=x=>Number.isSafeInteger(x)&&x>=0&&x<=10000?x:null;
const unknowns=Object.freeze([
 'remote_api_reachability','remote_api_health','remote_cors_response',
 'host_ownership_and_authorization','exact_request_path_and_method',
 'per_request_browser_rejection_cause','original_application_data_ready'
]);
function localPolicy(){
 const blocked=approveBrowserRequest({
  method:'GET',resourceType:'Fetch',
  url:'https://api.unknown-fixture.example.org/v1/report'
 },{target:'https://page.unknown-fixture.example.org/'});
 return {
  off_origin_get_denied:blocked.allowed===false&&blocked.reason==='origin_blocked',
  connect_src_self_only:/(?:^|;)\s*connect-src\s+'self'\s*(?:;|$)/.test(LOCKDOWN_CSP)
 };
}
const failCodes=['SCHEMA_OR_PROVENANCE_MISMATCH','COUNT_MISMATCH',
 'HOST_EVIDENCE_CONFLICT','PERMISSION_STATE_CONFLICT'];
/** No source host, path, URL, page label, credential or arbitrary input string is exported. */
export function assessSavedQ1Failure({packet,preflight}={}){
 const policy=localPolicy(),issues=[];
 if(packet?.kind!=='rea-local-support-packet'||
    packet?.source!=='previously-stored-observation'||
    packet?.mode!=='dynamic-passive'||packet?.network_requests_issued!==0||
    packet?.actions_executed!==0||
    preflight?.kind!=='rea-q1-offline-permission-preflight'||
    preflight?.source!=='saved-failed-passive-evidence'||
    preflight?.network_requests_issued!==0||
    preflight?.browser_actions_executed!==0)issues.push(failCodes[0]);
 const rejected=count(packet?.capture?.fetch_rejections);
 const gateRejected=count(preflight?.evidence?.fetch_rejections);
 const attempts=count(packet?.capture?.fetch_attempts);
 if(rejected===null||gateRejected===null||attempts===null||
    rejected!==gateRejected||rejected>attempts||
    packet?.capture?.verdict!==preflight?.evidence?.capture_verdict)
  issues.push(failCodes[1]);
 const groups=Array.isArray(packet?.network?.groups)?packet.network.groups:[];
 const candidates=Array.isArray(packet?.network?.permission_review?.candidate_hosts)?
  packet.network.permission_review.candidate_hosts:[];
 const hosts=Array.isArray(preflight?.host_candidates)?preflight.host_candidates:[];
 const sameHostPairs=groups.filter(x=>x?.scope==='external'&&typeof x.host==='string'&&
  count(x.fetch_attempts)>0&&count(x.fetch_rejections)>0).map(x=>x.host);
 if(!Array.isArray(packet?.network?.groups)||!Array.isArray(hosts)||
    candidates.length!==hosts.length||
    candidates.some((name,i)=>typeof name!=='string'||name!==hosts[i]?.host||
      !sameHostPairs.includes(name))||
    sameHostPairs.slice(0,8).some((name,i)=>name!==candidates[i])||
    preflight?.evidence?.event_groups_observed!==groups.length)
  issues.push(failCodes[2]);
 if(preflight?.permission_status!=='NOT_APPROVED'||
    preflight?.decision!=='BLOCK_NETWORK_EXPANSION'||
    preflight?.executable_policy_generated!==false||
    preflight?.auto_allowlist_changes!==0||
    packet?.network?.permission_review?.approved!==false)
  issues.push(failCodes[3]);
 const captureFailed=packet?.capture?.verdict==='FAIL';
 const matched=candidates.length>0;
 const policyCompatible=policy.off_origin_get_denied&&policy.connect_src_self_only;
 const evidenceStatus=issues.length?'INCONSISTENT':
  packet?.network?.evidence_incomplete===true||count(packet?.network?.events_omitted)!==0?
  'PARTIAL':'BOUNDED';
 const finding=issues.length?'EVIDENCE_CONFLICT':
  captureFailed&&rejected>0&&matched&&policyCompatible?
  'LOCAL_POLICY_BOUNDARY_COMPATIBLE_NOT_CAUSAL':
  captureFailed&&rejected>0?'FETCH_FAILURE_CAUSE_UNATTRIBUTED':
  'CAPTURE_FAILURE_NOT_CONFIRMED';
 return {
  schema_version:1,kind:'rea-q1-offline-failure-assessment',
  source:'saved-redacted-evidence-and-current-local-policy',
  network_requests_issued:0,browser_actions_executed:0,
  finding,evidence_status:evidenceStatus,
  evidence_conflicts:issues,permission_status:'NOT_APPROVED',
  decision:'BLOCK_NETWORK_EXPANSION',
  local_policy:policy,
  observed:{
   capture_failed:captureFailed,fetch_attempts:attempts,fetch_rejections:rejected,
   matched_external_host_count:count(candidates.length),
   browser_blocked:count(packet?.capture?.blocked),
   saved_group_count:count(groups.length),
   omitted_events:count(packet?.network?.events_omitted)
  },
  known_not_proven:unknowns,
  confidence_scope:'host-level-observation-only',
  browser_blocked_zero_does_not_prove_api_access:true,
  cause_identified:false,remote_api_healthy_verified:false,
  cors_verified:false,network_permission_granted:false,
  privacy:{raw_hostnames_included:false,urls_included:false,
   paths_queries_credentials_included:false,response_bodies_included:false},
  safe_next_step:'Confirm host ownership, exact request scope and security budget separately; do not change live network policy based on this report'
 };
}
