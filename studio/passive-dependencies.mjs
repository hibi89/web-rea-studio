/** A pure, read-only summary. All input comes from previously saved Chrome evidence. */
const permittedKinds=new Set(['requested','fulfilled','blocked','browser-failed','fetch-attempt','fetch-rejected','xhr-open']);
const permittedReasons=new Set(['origin_blocked','method_blocked','resource_blocked','navigation_blocked','budget_exhausted','HTTP_REJECTED','DNS_LOOKUP_FAILED','DNS_ADDRESS_BLOCKED','HTTPS_TIMEOUT','HTTPS_REQUEST_FAILED','REQUEST_FAILED','REDIRECT_BLOCKED','MIME_BLOCKED','RESOURCE_TOO_LARGE','blocked_by_client','cors_error','network_failed']);
const hostOk=x=>typeof x==='string'&&/^[a-z0-9.-]{1,180}$/.test(x)&&x.includes('.')&&!x.includes('..')&&!x.startsWith('.')&&!x.endsWith('.');
const pathOk=x=>typeof x==='string'&&x.startsWith('/')&&x.length<=120&&!/[?#%@\\]/.test(x)&&!x.includes('..')&&x.split('/').slice(1).every(s=>!s||/^[a-zA-Z_][a-zA-Z0-9_-]{0,23}$/.test(s));
const integer=x=>Number.isInteger(x)&&x>=0&&x<=10000?x:null;
export function buildPassiveDependencyReview({mode,report,inspection}={}){
 if(mode!=='dynamic-passive')throw Error('PASSIVE_ONLY');
 const events=Array.isArray(inspection?.network)?inspection.network.slice(0,100):[];
 const grouped=new Map();let omitted=0;
 for(const e of events){
  if(!e||!permittedKinds.has(e.kind)){omitted++;continue;}
  let identity;
  if(e.scope==='other-origin'&&hostOk(e.host))identity={scope:'external',host:e.host};
  else if(e.scope!=='other-origin'&&e.scope!=='other-scheme'&&e.scope!=='credential-url'&&e.scope!=='unknown'&&e.host===undefined&&pathOk(e.path))identity={scope:'approved-origin',path:e.path};
  if(!identity){omitted++;continue;}
  const key=identity.scope+':'+(identity.host||identity.path);
  if(!grouped.has(key)){
   if(grouped.size>=40){omitted++;continue;}
   grouped.set(key,{...identity,events:0,fetch_attempts:0,fetch_rejections:0,xhr_open:0,requested:0,fulfilled:0,blocked:0,browser_failed:0,reason_codes:[],status_codes:[]});
  }
  const d=grouped.get(key);d.events++;
  const field={'fetch-attempt':'fetch_attempts','fetch-rejected':'fetch_rejections','xhr-open':'xhr_open','requested':'requested','fulfilled':'fulfilled','blocked':'blocked','browser-failed':'browser_failed'}[e.kind];d[field]++;
  if(permittedReasons.has(e.reason)&&!d.reason_codes.includes(e.reason)&&d.reason_codes.length<4)d.reason_codes.push(e.reason);
  if(Number.isInteger(e.status)&&e.status>=100&&e.status<=599&&!d.status_codes.includes(e.status)&&d.status_codes.length<4)d.status_codes.push(e.status);
 }
 const dependencies=[...grouped.values()].map(d=>{
  const review=d.scope==='external'&&d.fetch_attempts>0&&d.fetch_rejections>0;
  return {...d,verification:'observation-only',permission_review_required:review,assessment:review?'matching_host_attempt_and_rejection':d.blocked?'resource_blocked':d.fetch_rejections?'fetch_rejected':d.browser_failed?'browser_failure':d.fulfilled?'resource_fulfilled':'unverified'};
 });
 const hosts=dependencies.filter(d=>d.permission_review_required).map(d=>d.host);
 const total=integer(report?.fetch_rejections)??integer(inspection?.network_diagnostics?.fetch_rejections);
 return {schema_version:1,scope:'saved-passive-evidence-only',mode:'dynamic-passive',network_requests_issued:0,external_hosts_approved:[],
  summary:{events_saved:events.length,events_omitted:omitted,dependencies:dependencies.length,external_hosts_observed:dependencies.filter(d=>d.scope==='external').length,fetch_rejections_reported:total,missing_fetch_details:total===null||total>dependencies.reduce((v,d)=>v+d.fetch_rejections,0)||!events.length},
  external_permission_review:{approved:false,requires_explicit_approval:hosts.length>0,candidate_hosts:hosts},dependencies,
  limitations:['Host-level matching does not prove a specific request caused failure','XHR.open is not proof of a sent request','No host, origin, API or permission is added by this report','No external paths, queries, credentials or response data exported','CORS, ownership and remote host reachability unverified']};
}
