// F4 v2 — evidence-driven branching state machine. No copied scripts or APIs.
// It accepts ONLY bounded synthetic Chrome observations, never passive HTTPS.
const fail=()=>{throw Error('F4_GENERIC_UNVERIFIED_EVIDENCE');};
const id=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{1,31}$/.test(v)?v:null;
const stateKey=v=>typeof v==='string'&&/^[a-z][a-z0-9_]{1,25}$/.test(v)&&
 !/(?:password|token|secret|auth|cookie|session|email|phone|credential|user|account|api_key)/.test(v);
const text=v=>typeof v==='string'&&v.length>0&&v.length<=44&&
 !/[<>&"'\\/@:=\x00-\x1f\x7f]/.test(v)&&
 !/\b(?:https?|www|token|secret|password|api_key)\b/i.test(v)&&
 !/\d{9,}/.test(v);
const safeValue=v=>typeof v==='boolean'||
 typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=99999||
 typeof v==='string'&&v.length<=32&&/^[\p{L}\p{N}_ -]+$/u.test(v)&&
 !/(?:secret|password|token|apikey|auth|cookie|session|credential)/i.test(v)&&
 !/\d{9,}/.test(v);
const same=(a,b,keys)=>keys.every(k=>a[k]===b[k]);
const cleanState=(s,keys)=>{
 if(!s||Array.isArray(s)||typeof s!=='object'||Object.keys(s).sort().join(',')!==keys.join(','))fail();
 const result=Object.create(null);
 for(const k of keys){if(!safeValue(s[k]))fail();result[k]=s[k];}
 return {...result};
};
export function normalizeGenericBehaviorEvidence(evidence){
 if(evidence?.source!=='controlled-generic-chrome'||evidence.scope!=='synthetic-only'||
    evidence.verification!=='real-isolated-chrome'||!id(evidence.app_id)||
    !text(evidence.title)||!Array.isArray(evidence.steps)||
    evidence.steps.length<2||evidence.steps.length>12)fail();
 const keys=Object.keys(evidence.initial||{}).sort();
 if(keys.length<2||keys.length>10||!keys.every(stateKey))fail();
 const initial=cleanState(evidence.initial,keys);
 const seen=new Set(),edges=[];
 let linked=0;
 for(const s of evidence.steps){
  if(!id(s?.id)||!text(s.label)||s.action!=='click'||s.status!=='completed'||
   s.attribution!=='controlled-single-action-window'||!Array.isArray(s.changed_fields)||
   !Number.isSafeInteger(s.request_count)||s.request_count<0||s.request_count>2||
   !Array.isArray(s.endpoint_paths)||s.endpoint_paths.length!==(s.request_count?1:0)||
   s.endpoint_paths.some(p=>typeof p!=='string'||!/^\/api\/[a-z][a-z0-9/_-]{0,40}$/.test(p)))fail();
  const before=cleanState(s.before,keys),after=cleanState(s.after,keys);
  const change=keys.filter(k=>before[k]!==after[k]);
  if(change.length===0&&!s.request_count)fail();
  if(JSON.stringify(change)!==JSON.stringify(s.changed_fields))fail();
  const unique=JSON.stringify(before)+'|'+s.id;
  if(seen.has(unique))fail();
  seen.add(unique);
  linked+=s.request_count?1:0;
  edges.push({id:s.id,label:s.label,before,after,changed_fields:change,
   simulated_api_delta:s.request_count});
 }
 const reachable=new Set([JSON.stringify(initial)]);
 let updated=true;
 while(updated){
  updated=false;
  for(const e of edges){
   if(reachable.has(JSON.stringify(e.before))&&!reachable.has(JSON.stringify(e.after))){
    reachable.add(JSON.stringify(e.after));updated=true;
   }
  }
 }
 if(edges.some(e=>!reachable.has(JSON.stringify(e.before))))fail();
 if(evidence.observed_action_api_links!==linked)fail();
 const actions=[];
 for(const edge of edges){
  if(!actions.find(a=>a.id===edge.id)){
   if(actions.length>=12)fail();
   actions.push({id:edge.id,label:edge.label});
  }else if(actions.find(a=>a.id===edge.id).label!==edge.label)fail();
 }
 return {schema_version:2,kind:'controlled-branching-replay',
   scope:'verified-synthetic-only',app_id:evidence.app_id,title:evidence.title,
   fields:keys,initial,actions,edges,reachable_state_count:reachable.size,
   observed_action_api_links:linked,network_mode:'local-counter-no-http'};
}
const esc=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;')
 .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function generateGenericBehaviorHtml(evidence){
 const plan=normalizeGenericBehaviorEvidence(evidence);
 // JSON goes only into a SCRIPT literal after strict whitelisting.
 const embedded=JSON.stringify(plan).replace(/</g,'\\u003c').replace(/>/g,'\\u003e')
  .replace(/&/g,'\\u0026').replace(/\u2028|\u2029/g,'');
 const runtime=String.raw`
const GRAPH=__DATA__;
let state={...GRAPH.initial},simulated=0,completed=0;
const key=s=>JSON.stringify(s), el=id=>document.getElementById(id);
function paint(){
 for(const f of GRAPH.fields)el('state-'+f).textContent=String(state[f]);
 el('api-simulated').textContent=String(simulated);
 el('completed-count').textContent=String(completed);
 for(const b of document.querySelectorAll('button[data-action]')){
  b.disabled=!GRAPH.edges.some(e=>e.id===b.dataset.action&&key(e.before)===key(state));
 }
 el('status').textContent=GRAPH.edges.some(e=>key(e.before)===key(state))?
  '관찰된 상태에서 실행 가능한 동작만 활성화됩니다':'더 이상 검증된 동작 없음 · 재시작 가능';
}
for(const b of document.querySelectorAll('button[data-action]')){
 b.addEventListener('click',()=>{
  const e=GRAPH.edges.find(x=>x.id===b.dataset.action&&key(x.before)===key(state));
  if(!e)return;
  state={...e.after};simulated+=e.simulated_api_delta;completed++;paint();
 });
}
el('reset-flow').addEventListener('click',()=>{state={...GRAPH.initial};simulated=0;completed=0;paint();});
paint();
`.replace('__DATA__',embedded);
 const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";
 const fields=plan.fields.map(k=>'<section class="metric"><small>'+esc(k)+
  '</small><strong id="state-'+k+'">—</strong></section>').join('');
 const buttons=plan.actions.map(a=>'<button type="button" id="action-'+a.id+
  '" data-action="'+a.id+'">'+esc(a.label)+'</button>').join('');
 const html='<!doctype html><html lang="ko"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta http-equiv="Content-Security-Policy" content="'+esc(csp)+'">'+
  '<title>Web REA · Controlled Generic Replay</title>'+
  '<style>*{box-sizing:border-box}body{margin:0;background:#0b1424;color:#e9f0ff;font:15px system-ui,Arial}'+
  'main{max-width:920px;margin:48px auto;padding:0 20px}h1{font-size:27px}p{color:#9fb6cf;line-height:1.6}'+
  '.notice{padding:13px 16px;border:1px solid #35506d;border-radius:9px;background:#162a40}'+
  '.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px;margin:20px 0}'+
  '.metric{padding:15px;border-radius:10px;background:#18283f;border:1px solid #38516b}'+
  '.metric small{display:block;color:#a0b7cc;margin-bottom:8px}.metric strong{font-size:23px}'+
  '.actions{display:flex;gap:10px;flex-wrap:wrap;margin:20px 0}button{border:1px solid #6b9ee4;'+
  'background:#275084;color:white;font:14px system-ui;padding:11px 16px;border-radius:7px;cursor:pointer}'+
  'button:disabled{opacity:.28;cursor:not-allowed}#reset-flow{background:#374052}'+
  'footer{border-top:1px solid #34465d;padding-top:14px;margin-top:28px;color:#9fb6cf;font-size:13px}</style>'+
  '</head><body><main><h1>'+esc(plan.title)+'</h1>'+
  '<p class="notice">검증된 합성 테스트의 상태 전이만 재생합니다. 외부 API 요청은 전혀 하지 않습니다.</p>'+
  '<div class="metrics">'+fields+'</div><div class="actions">'+buttons+
  '<button type="button" id="reset-flow">처음부터</button></div>'+
  '<p id="status" role="status"></p><footer>관찰된 단계 진행 횟수: <span id="completed-count">0</span>'+
  ' · 시뮬레이션 API 호출: <span id="api-simulated">0</span>'+
  ' · 검증 출처: synthetic-only</footer><script>'+runtime+'</script></main></body></html>';
 if(Buffer.byteLength(html,'utf8')>50000)fail();
 return html;
}
