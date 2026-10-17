import {buildPassiveDependencyReview} from './passive-dependencies.mjs';

const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=10000?n:null;
const allowedFailures=new Set(['application_fetch_error_visible','resource_requests_unsettled',
 'fetch_requests_rejected','critical_resources_blocked']);
const allowedDiagnoses=new Set(['PASSIVE_EXTERNAL_FETCH_REJECTED','PASSIVE_CRITICAL_RESOURCE_BLOCKED',
 'PASSIVE_FETCH_REJECTED_UNATTRIBUTED','PASSIVE_FAVICON_PENDING','UNKNOWN']);
const flag=v=>v===true;
const pathType=p=>p==='/'?'root':p?.startsWith('/api/')?'api-candidate':'same-origin-resource';

/**
 * Shareable support packet from persisted evidence only. Do not include raw DOM,
 * labels, URLs, per-request paths, stderr, response data, or credentials.
 * Hostnames may still be sensitive: user must review before sharing.
 */
export function buildPassiveSupportPacket({mode,report,inspection,diagnosis}={}){
 if(mode!=='dynamic-passive'||inspection?.mode!=='dynamic-passive')
  throw Error('PASSIVE_SUPPORT_ONLY');
 const dependencyReview=buildPassiveDependencyReview({mode,report,inspection});
 const inventory=inspection?.page?.interaction_inventory;
 const totals=inventory?.source==='passive-controls'?inventory.counts:null;
 const groupSummary=dependencyReview.dependencies.slice(0,40).map(d=>({
  scope:d.scope,
  ...(d.scope==='external'?{host:d.host}:{path_category:pathType(d.path)}),
  events:count(d.events),fetch_attempts:count(d.fetch_attempts),
  fetch_rejections:count(d.fetch_rejections),xhr_open:count(d.xhr_open),
  browser_requested:count(d.requested),browser_fulfilled:count(d.fulfilled),
  browser_blocked:count(d.blocked),browser_failed:count(d.browser_failed),
  status_codes:d.status_codes.slice(0,4),reason_codes:d.reason_codes.slice(0,4),
  classification:d.assessment,review_candidate:d.permission_review_required
 }));
 const categories=['total','buttons','links','inputs','tabs','selects','offsite_links'];
 const controlSummary={available:!!totals};
 if(totals)for(const k of categories)controlSummary[k]=count(totals[k]);
 const code=diagnosis?.diagnosis;
 const diagnosisCode=allowedDiagnoses.has(code)?code:'UNKNOWN';
 const failures=Array.isArray(report?.failures)?
  [...new Set(report.failures.filter(f=>allowedFailures.has(f)))].slice(0,4):[];
 return {
  schema_version:1,kind:'rea-local-support-packet',mode:'dynamic-passive',
  source:'previously-stored-observation',network_requests_issued:0,actions_executed:0,
  diagnosis_code:diagnosisCode,
  capture:{verdict:report?.verdict==='FAIL'?'FAIL':report?.verdict==='PASS'?'PASS_NOT_EQUIVALENCE':'UNKNOWN',
   render_fidelity:['incomplete','partial','unverified'].includes(report?.render_fidelity)?report.render_fidelity:'unknown',
   application_fetch_error_visible:flag(report?.application_fetch_error_visible),
   failures,requested:count(report?.resource_requests),fulfilled:count(report?.resource_fulfilled),
   blocked:count(report?.resource_blocked),pending:count(report?.resource_pending),
   critical_resource_blocks:count(report?.critical_resources_blocked),
   fetch_attempts:count(report?.fetch_attempts??inspection?.network_diagnostics?.fetch_attempts),
   fetch_rejections:count(report?.fetch_rejections??inspection?.network_diagnostics?.fetch_rejections),
   browser_network_failures:count(report?.chrome_network_failures)},
  control_inventory:controlSummary,
  network:{events_saved:dependencyReview.summary.events_saved,
   events_omitted:dependencyReview.summary.events_omitted,
   evidence_incomplete:dependencyReview.summary.missing_fetch_details,
   groups:groupSummary,
   permission_review:{approved:false,requires_explicit_approval:dependencyReview.external_permission_review.requires_explicit_approval,
    candidate_hosts:dependencyReview.external_permission_review.candidate_hosts},
   verified_control_to_api_links:0},
  recommendations:dependencyReview.external_permission_review.requires_explicit_approval?
   ['Confirm host ownership and explicit authorization before any external API relay',
    'Do not conclude that blocked fetch alone proves the remote server or CORS cause']:
   ['Review saved browser failures and same-origin resource outcomes',
    'If evidence is incomplete, any new authorized passive capture must be separately initiated'],
  privacy:{contains_full_urls:false,contains_queries:false,contains_external_paths:false,
   contains_page_labels:false,contains_credentials:false,contains_response_bodies:false,
   contains_screenshot:false,review_before_sharing:true,
   warning:'Hostnames and counts may reveal architecture. Inspect this JSON before sending it elsewhere.'},
  limitations:['Saved event groups are not request-level causal evidence',
   'No additional target requests or permissions granted',
   'A captured screenshot does not prove the application rendered successfully']
 };
}
