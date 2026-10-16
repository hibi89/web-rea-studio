import {summarizeFixtureExploration} from './interaction-blueprint.mjs';
import {summarizeFixtureTransitions} from './fixture-state-transitions.mjs';
// Intentionally small, fixture-only projection of REA Evidence.
// Never return raw DOM, cookies, headers, request bodies or URL query strings.
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const bounded=(x,n=100)=>typeof x==='string'?x.slice(0,n):'';
const fixtureOrigin=url=>{
 try { const u=new URL(url); return u.protocol==='http:'&&u.hostname==='127.0.0.1'&&/^\d+$/.test(u.port)?u.origin:null; }
 catch {return null;}
};
function safeUrl(value,origin){
 const raw=typeof value==='string'?value:value?.url;
 if(typeof raw!=='string')return null;
 try{const u=new URL(raw);return u.origin===origin?u.origin+u.pathname:null;}
 catch{return null;}
}
function sampleControls(html){
 if(typeof html!=='string')return [];
 const results=[];
 const pattern=/<(button|input|select|textarea)\b([^>]{0,1200})>(?:([^<]{0,160})<\/\1>)?/gi;
 for(const match of html.matchAll(pattern)){
  if(results.length>=30)break;
  const [,tag,attr,text='']=match;
  const id=/\bid\s*=\s*["']([^"']{1,80})["']/i.exec(attr)?.[1]||'';
  // Only structural IDs from our synthetic fixture, no form input values.
  if(!/^[a-z][a-z0-9_-]{0,50}$/i.test(id))continue;
  results.push({kind:tag.toLowerCase(),id,label:bounded(text.trim().replace(/\s+/g,' '),70)});
 }
 return results;
}
export function buildInspection(evidence,report){
 if(!isObj(evidence)||!isObj(evidence.normalized_result))throw Error('No normalized REA result');
 const result=evidence.normalized_result;
 const origin=fixtureOrigin(result.scenario?.start_origin);
 if(!origin)throw Error('Inspection requires controlled localhost evidence');
 const steps=Array.isArray(result.steps)?result.steps:[];
 const events=Array.isArray(result.events?.items)?result.events.items:[];
 const stepsSummary=steps.slice(0,40).map(step=>({
  step_id:bounded(step.step_id,64),
  action:bounded(step.action,32),
  status:['completed','failed','cancelled'].includes(step.status)?step.status:'unknown',
  elapsed_ms:Number.isSafeInteger(step.elapsed_ms)&&step.elapsed_ms>=0?step.elapsed_ms:null,
  path:safeUrl(step.after_url,origin),
  dom_state:bounded(step.artifacts?.dom?.state,20),
  accessibility_state:bounded(step.artifacts?.accessibility?.state,20),
  screenshot_state:bounded(step.artifacts?.screenshot?.state,20),
 }));
 const lastDom=steps.at(-1)?.artifacts?.dom?.state==='captured'?steps.at(-1).artifacts.dom.value?.text:'';
 const title=typeof lastDom==='string'?bounded(/<title[^>]*>([^<]{0,140})<\/title>/i.exec(lastDom)?.[1]?.trim(),100):'';
 const network=events.filter(e=>['request','response','request-failed'].includes(e.kind)).slice(0,80).map(e=>({
  kind:e.kind,
  method:bounded(e.method,12),
  path:safeUrl(e.url,origin),
  status:Number.isInteger(e.status)?e.status:null,
 })).filter(x=>x.path!==null);
 const exploration=summarizeFixtureExploration({steps:stepsSummary,network});
 exploration.state_transitions=summarizeFixtureTransitions(steps);
 return {
  schema_version:1,
  exploration,
  scope:'controlled-fixture-only',
  evidence_id:bounded(evidence.evidence_id,68),
  verdict:report?.verdict==='PASS'?'PASS':'FAIL',
  browser:{product:bounded(result.browser?.product,50),version:bounded(result.browser?.version,60),cleanup:bounded(result.browser?.cleanup,50)},
  completeness:bounded(result.completeness?.status,30),
  duration_ms:Number.isSafeInteger(result.duration_ms)?result.duration_ms:null,
  page:{origin,title,controls:sampleControls(lastDom)},
  steps:stepsSummary,
  network,
  counts:{steps:steps.length,network_records:network.length,dropped_events:Number.isSafeInteger(result.events?.dropped)?result.events.dropped:null},
  limitations:['Fixture observations only','URLs omit query strings','DOM text, credentials, headers, and response bodies are not exposed'],
 };
}
