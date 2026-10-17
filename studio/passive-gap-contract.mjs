// F3 real-site reconstruction gap contract from saved *passive* observations.
// Strictly offline: presence and network events never imply authorized actions,
// verified endpoints, response schemas, recovered app behavior or permissions.
import {buildPassiveSiteBlueprint} from './passive-blueprint.mjs';

const categories=['button','link','tab','select','textarea','input','interactive','unknown'];
const safeCount=n=>Number.isSafeInteger(n)&&n>=0?Math.min(n,1000):0;
const summarize=(deps,scope)=>deps.filter(d=>d.scope===scope).reduce((o,d)=>{
 o.groups++;o.observed_events+=safeCount(d.events);
 o.fetch_attempts+=safeCount(d.fetch_attempts);
 o.fetch_rejections+=safeCount(d.fetch_rejections);
 o.requested+=safeCount(d.requested);
 o.fulfilled+=safeCount(d.fulfilled);
 o.blocked+=safeCount(d.blocked);
 o.browser_failed+=safeCount(d.browser_failed);
 o.xhr_open+=safeCount(d.xhr_open);
 return o;
},{groups:0,observed_events:0,fetch_attempts:0,fetch_rejections:0,
 requested:0,fulfilled:0,blocked:0,browser_failed:0,xhr_open:0});

export function buildPassiveGapContract({mode,inspection,report}={}){
 if(mode!=='dynamic-passive'||inspection?.mode!=='dynamic-passive'||
  (report?.analysis_mode!==undefined&&report.analysis_mode!=='dynamic-passive'))
  throw Error('F3_PASSIVE_GAP_SCOPE_DENIED');
 const blueprint=buildPassiveSiteBlueprint({mode,inspection,report});
 const counts=new Map(categories.map(c=>[c,0]));
 for(const item of blueprint.controls.items||[]){
  const c=counts.has(item.category)?item.category:'unknown';
  counts.set(c,counts.get(c)+1);
 }
 const affordances=categories.filter(c=>counts.get(c)>0).map(category=>({
  category,observed_count:counts.get(category),
  observation:'visible-element-presence-only',
  action_implementation:'unknown-not-replayed',
  state_transitions:'unknown',
  api_causality:'unknown',
  data_fields:'unknown',
  permission_to_interact:false
 }));
 const deps=blueprint.network.dependencies||[];
 const same=summarize(deps,'approved-origin');
 const external=summarize(deps,'external');
 const capture=blueprint.evidence.capture_verdict;
 const incomplete=blueprint.evidence.incomplete_network===true;
 const gaps=[
  {id:'real-action-effects',priority:affordances.length?'needs-authorized-action-evidence':'unobserved',
   status:'unknown',required_evidence:'separate-explicit-action-approval-and-observation'},
  {id:'response-field-schema',priority:'unresolved',status:'unknown',
   required_evidence:'separately-authorized-and-redacted-response-schema'},
  {id:'control-to-api-causality',priority:affordances.length&&deps.length?'unresolved':'unobserved',
   status:'unknown',required_evidence:'same-action-window-authorized-replay'},
  {id:'backend-and-database-contract',priority:'unresolved',status:'unknown',
   required_evidence:'owner-provided-api-and-data-contract'},
  {id:'external-dependency-access',
   priority:external.groups?'requires-scope-review':'unobserved',
   status:'not-approved',required_evidence:'explicit-host-method-path-authorization'},
  {id:'capture-completeness',
   priority:capture==='capture-pass-not-parity'&&!incomplete?'unverified-parity':'incomplete',
   status:'not-proven',required_evidence:'authorized-complete-source-capture'}
 ];
 return {
  schema_version:1,kind:'rea-passive-functional-data-gap-contract',
  scope:'saved-approved-passive-evidence-only',
  observation_mode:'dynamic-passive',
  source_capture:{verdict:capture,network_details_complete:!incomplete&&deps.length>0,
   completeness_or_parity_verified:false},
  ui_affordances:{verification:'presence-only',observed_total:safeCount(blueprint.controls.total),
   groups:affordances},
  network_observation:{verification:'network-events-only',
   approved_origin:same,external:external,
   endpoint_contracts_verified:0,response_fields_verified:0,
   control_to_api_links_verified:0,api_schema:'unknown',
   reported_fetch_details_incomplete:incomplete},
  gaps,
  decisions:{ready_for_real_site_reimplementation:false,
   original_backend_recovered:false,original_database_recovered:false,
   external_permissions_granted:false,real_actions_executed:0,
   original_site_requests_issued:0,artifact_generation_allowed:false},
  privacy:{hostnames_included:false,url_paths_included:false,
   queries_included:false,headers_included:false,
   response_bodies_included:false,form_values_included:false,
   control_labels_included:false,credentials_included:false},
  limitations:[
   'Saved passive observation may be incomplete or have failed to render',
   'Visible controls do not prove effects, data requirements or navigation behavior',
   'XHR open/fetch attempt is not a successful API response or control-to-endpoint causal link',
   'Any active action, off-origin access and schema access need separate authorization',
   'No real original application or backend parity has been verified'
  ]
 };
}
