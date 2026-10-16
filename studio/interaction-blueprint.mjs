// F1: read-only interactive control inventory. No page actions.
export const CONTROL_PROBE="(()=>{\n const selector='button,a[href],input,select,textarea,[role=\"button\"],[role=\"link\"],[role=\"tab\"],[role=\"combobox\"],[aria-expanded]';\n const candidates=[...document.querySelectorAll(selector)].slice(0,500);\n const controls=[];let hidden=0;\n for(const node of candidates){\n  if(controls.length>=100)break;\n  const style=getComputedStyle(node),box=node.getBoundingClientRect();\n  if(box.width<2||box.height<2||style.display==='none'||style.visibility==='hidden'){hidden++;continue;}\n  const tag=node.tagName.toLowerCase(),role=node.getAttribute('role')||'';\n  const safeText=(tag==='button'||tag==='a'||role==='tab'||role==='button')?\n   String(node.textContent||'').replace(/\\s+/g,' ').trim().slice(0,100):'';\n  // Read-only: never inspect input/select values, cookies, storage, form contents,\n  // JS handlers, or credentials. Never collect full URLs or query strings.\n  let navigation='';\n  if(tag==='a'){\n   try{\n    const u=new URL(node.getAttribute('href'),location.href);\n    navigation=u.protocol!=='http:'&&u.protocol!=='https:'?'non-http':\n     u.origin!==location.origin?'offsite':\n     (u.pathname+u.search+u.hash===location.pathname+location.search+location.hash?'same-page':'same-origin');\n   }catch{navigation='invalid';}\n  }\n  controls.push({tag,role,type:tag==='input'?node.type||'text':'',\n   text:safeText,nav:navigation,disabled:!!node.disabled,\n   expanded:node.getAttribute('aria-expanded')||'',\n   rect:{x:Math.round(box.left+scrollX),y:Math.round(box.top+scrollY),\n    w:Math.round(box.width),h:Math.round(box.height)}});\n }\n return {source:'passive-controls',candidates:candidates.length,hidden,controls};\n})()";

const finite=(v,lo,hi)=>typeof v==='number'&&Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):0;
const plainLabel=v=>{
 if(typeof v!=='string')return '';
 return v.replace(/[\x00-\x1f\x7f<>]/g,' ')
  .replace(/https?:\/\/\S+/gi,'[URL]')
  .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[EMAIL]')
  .replace(/\b[A-Za-z0-9_-]{19,}\b/g,'[REDACTED]')
  .replace(/\b\d{9,}\b/g,'[NUMBER]')
  .replace(/\s+/g,' ').trim().slice(0,64);
};
const safeHost=v=>typeof v==='string'&&v.length<=253&&/^[a-z0-9.-]+$/.test(v)?v:'';
export function sanitizeControlInventory(raw){
 if(!raw||raw.source!=='passive-controls'||!Array.isArray(raw.controls))return null;
 const tags=new Set(['button','a','input','select','textarea','div','span','li']);
 const roles=new Set(['','button','link','tab','combobox','menuitem','checkbox','radio','switch']);
 const validTypes=new Set(['','text','search','number','email','password','checkbox','radio','date','tel','url','hidden','submit','reset','button','file','range','color','time','datetime-local']);
 const allowedNav=new Set(['','offsite','same-origin','same-page','non-http','invalid']);
 const controls=raw.controls.slice(0,100).filter(o=>o&&tags.has(o.tag)&&roles.has(o.role))
  .map((o,i)=>({
   id:'control-'+String(i+1).padStart(3,'0'),
   kind:o.role==='tab'?'tab':o.tag==='a'?'link':o.tag==='button'||o.role==='button'?'button':
    o.tag==='select'?'select':o.tag==='textarea'?'textarea':
    o.tag==='input'?'input':o.role||'interactive',
   tag:o.tag,role:o.role,type:validTypes.has(o.type)?o.type:'',
   label:(o.tag==='button'||o.tag==='a'||o.role==='button'||o.role==='tab')?plainLabel(o.text):'',
   navigation:allowedNav.has(o.nav)?o.nav:'',
   disabled:o.disabled===true,expanded:['true','false'].includes(o.expanded)?o.expanded:null,
   rect:{x:finite(o.rect?.x,-10000,10000),y:finite(o.rect?.y,-10000,10000),
    width:finite(o.rect?.w,0,10000),height:finite(o.rect?.h,0,10000)}
  }));
 const counts={total:controls.length,buttons:0,links:0,inputs:0,tabs:0,selects:0,offsite_links:0};
 for(const c of controls){
  if(c.kind==='button')counts.buttons++;
  if(c.kind==='link'){counts.links++;if(c.navigation==='offsite')counts.offsite_links++;}
  if(c.kind==='input'||c.kind==='textarea')counts.inputs++;
  if(c.kind==='tab')counts.tabs++;
  if(c.kind==='select')counts.selects++;
 }
 return {source:'passive-controls',verification:'presence-only',actions_executed:0,
  candidates:finite(raw.candidates,0,500),hidden:finite(raw.hidden,0,500),
  counts,controls,limitations:['Visible DOM only; not proof of working behavior',
   'No clicks, input values, form submits or API requests performed by this probe',
   'Navigation targets classified without storing href, query, or external URLs']};
}
export function summarizePassiveDependencies(events,inventory,{mode='dynamic-passive'}={}){
 const allowed=new Set(['fetch-attempt','fetch-rejected','xhr-open','blocked','requested','fulfilled','browser-failed']);
 const groups=new Map();
 for(const e of (Array.isArray(events)?events:[]).slice(0,120)){
  if(!e||!allowed.has(e.kind))continue;
  const host=safeHost(e.host);
  const kind=e.kind;
  // Distinguish actual app network attempts from browser resource loads.
  const key=host?'external:'+host:'same-origin';
  if(!groups.has(key))groups.set(key,{scope:host?'external':'same-origin',host:host||null,
   events:0,fetch_attempts:0,fetch_rejections:0,blocked:0,loaded:0});
  const g=groups.get(key);g.events++;
  if(kind==='fetch-attempt')g.fetch_attempts++;
  if(kind==='fetch-rejected')g.fetch_rejections++;
  if(kind==='blocked')g.blocked++;
  if(kind==='fulfilled')g.loaded++;
 }
 const records=[...groups.values()].slice(0,12);
 return {source:'read-only-network-evidence',mode,
  control_count:inventory?.counts?.total??0,dependencies:records,
  attribution:'none',causal_links_verified:0,
  interaction_execution:'not-performed',
  conclusion:mode==='static-visual'?'Scripts disabled. Control effects and API dependencies cannot be inferred.':
   'Observed request traces do not prove which control caused a request.',
  limitations:['No click-to-network cause inferred from temporal co-occurrence',
   'External hosts and request query paths are never re-fetched or authorized']};
}
export function summarizeFixtureExploration(inspection){
 const steps=(Array.isArray(inspection?.steps)?inspection.steps:[]).slice(0,40)
  .map(s=>({step_id:typeof s.step_id==='string'?s.step_id.slice(0,64):'',
   action:typeof s.action==='string'?s.action.slice(0,30):'',
   status:['completed','failed','cancelled'].includes(s.status)?s.status:'unknown'}));
 const endpoints=[...new Set((Array.isArray(inspection?.network)?inspection.network:[])
  .filter(s=>s&&typeof s.path==='string'&&s.path.startsWith('http://127.0.0.1:'))
  .map(s=>{try{return new URL(s.path).pathname.slice(0,120);}catch{return null;}})
  .filter(Boolean))].slice(0,20);
 return {source:'controlled-fixture-scenario',execution:'controlled-only',
  actions_observed:steps.length,successful_steps:steps.filter(s=>s.status==='completed').length,
  steps,observed_endpoint_paths:endpoints,
  causality:'scenario-observed; individual controls and requests not linked without per-step network timestamps',
  limitations:['Only the local controlled REA fixture executes actions',
   'No automatic browsing or actions on external sites']};
}
