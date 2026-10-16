// F4: build a standalone interactive synthetic prototype ONLY from verified,
// fixed-scope F2 Chrome evidence. It is not a clone of any external website.
const IDS=['change-period','sort-rows','open-help','refresh'];
const FIELDS=['period','rows','order','view','ready'];
const COUNTS=[1,0,0,1];
const ENDPOINT='/api/rows';
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const guard=()=>{throw Error('F4_UNVERIFIED_BEHAVIOR_EVIDENCE');};
function state(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join('|')!==[...FIELDS].sort().join('|'))guard();
 if(![7,30].includes(x.period)||!Number.isInteger(x.rows)||x.rows<0||x.rows>100||
   !['asc','desc'].includes(x.order)||!['table','help'].includes(x.view)||x.ready!==true)guard();
 return {period:x.period,rows:x.rows,order:x.order,view:x.view,ready:x.ready};
}
function equal(a,b){return FIELDS.every(k=>a[k]===b[k]);}
export function normalizeControlledBehavior(evidence){
 if(evidence?.source!=='controlled-f2-chrome'||evidence?.scope!=='in-memory-synthetic-only'||
   evidence?.verified_actions!==4||evidence?.verified_action_api_links!==2||
   evidence?.initial_api_requests!==1||!Array.isArray(evidence.steps)||evidence.steps.length!==4)guard();
 const result=[];
 let prior=null;
 for(let i=0;i<4;i++){
  const s=evidence.steps[i];
  if(s?.step_id!==IDS[i]||s.action!=='click'||s.status!=='completed'||
    s.attribution!=='verified-in-controlled-single-action-window'||
    s.network_requests!==COUNTS[i]||!Array.isArray(s.endpoint_paths)||
    s.endpoint_paths.length!==(COUNTS[i]?1:0)||
    (COUNTS[i]&&s.endpoint_paths[0]!==ENDPOINT))guard();
  const before=state(s.state_before),after=state(s.state_after);
  if(i===0&&(before.period!==7||before.rows!==3||before.order!=='asc'||before.view!=='table'))guard();
  if(prior&&!equal(before,prior))guard();
  const changed=FIELDS.filter(k=>k!=='ready'&&before[k]!==after[k]);
  if(!Array.isArray(s.changed_fields)||s.changed_fields.length!==changed.length||
    s.changed_fields.some((v,k)=>v!==changed[k]))guard();
  // Network relationship is recorded but never emitted as a real request.
  result.push({id:IDS[i],before,after,simulated_api_delta:COUNTS[i],
    observed_changes:changed});
  prior=after;
 }
 return {kind:'controlled-behavior-blueprint',scope:'synthetic-only',
   initial:result[0].before,initial_simulated_api_calls:1,
   steps:result,network_mode:'local-simulation-no-requests',
   verified_source:'isolated-single-action-chrome'};
}
export function generateControlledInteractiveHtml(evidence){
 const data=normalizeControlledBehavior(evidence);
 const safe=JSON.stringify(data).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
 const runtime=String.raw`
const PLAN=__BLUEPRINT__;
const fields=['period','rows','order','view','ready'];
let state={...PLAN.initial},cursor=0,simulated=PLAN.initial_simulated_api_calls;
const get=id=>document.getElementById(id);
const labels={period:'기간',rows:'결과 행 수',order:'정렬',view:'화면',ready:'준비'};
function render(){
 for(const k of fields)get(k+'-state').textContent=k==='ready'?(state[k]?'yes':'no'):String(state[k]);
 get('api-simulated').textContent=String(simulated);
 get('step-count').textContent=String(cursor);
 const buttons=[...document.querySelectorAll('button[data-action]')];
 buttons.forEach((b,i)=>b.disabled=i!==cursor);
 get('status').textContent=cursor>=PLAN.steps.length?
  '검증된 4단계 재생 완료 (원본 서버 호출 없음)':
  '다음 검증 단계: '+PLAN.steps[cursor].id;
}
for(const b of document.querySelectorAll('button[data-action]')){
 b.addEventListener('click',()=>{
  const expected=PLAN.steps[cursor];
  if(!expected||b.dataset.action!==expected.id)return;
  // Reproduce only the validated fixed transition, without guessing effects
  // for unobserved action sequences and without any real API requests.
  state={...expected.after};
  simulated+=expected.simulated_api_delta;
  cursor++;
  render();
 });
}
get('restart').addEventListener('click',()=>{
 state={...PLAN.initial};cursor=0;simulated=PLAN.initial_simulated_api_calls;render();
});
render();
`.replace('__BLUEPRINT__',safe);
 const csp="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
 const items=FIELDS.map(k=>'<div class="value-card"><small>'+escape({period:'기간',rows:'결과 행 수',order:'정렬',view:'화면',ready:'준비'}[k])+
  '</small><strong id="'+k+'-state">—</strong></div>').join('');
 const buttons=data.steps.map((s,i)=>'<button data-action="'+s.id+'" type="button">'+
  escape(['기간 변경','정렬 변경','도움말 화면','데이터 새로고침'][i])+'</button>').join('');
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta http-equiv="Content-Security-Policy" content="'+escape(csp)+'">'+
  '<title>Web REA · Synthetic Behavior Replay</title>'+
  '<style>*{box-sizing:border-box}body{margin:0;background:#101827;color:#e5eefb;font:15px system-ui,Arial,sans-serif}'+
  'main{max-width:900px;margin:42px auto;padding:0 20px}h1{font-size:26px;margin-bottom:6px}p{color:#a9bad1;line-height:1.6}'+
  '.notice{border:1px solid #46546c;border-radius:8px;background:#1b293b;padding:13px;margin:20px 0;color:#d9e5f3}'+
  '.values{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}'+
  '.value-card{border:1px solid #394b62;background:#19283a;padding:16px;border-radius:10px}'+
  '.value-card small{display:block;color:#a9bcd2;margin-bottom:8px}.value-card strong{font-size:23px}'+
  '.actions{display:flex;flex-wrap:wrap;gap:10px;margin:24px 0}button{padding:10px 15px;border-radius:7px;'+
  'border:1px solid #7195d2;background:#234578;color:white;cursor:pointer;font-size:14px}'+
  'button:disabled{opacity:.32;cursor:not-allowed}#restart{background:#303a4d}'+
  'footer{color:#adbdd0;font-size:12px;border-top:1px solid #354358;padding-top:12px;margin-top:25px}'+
  '</style></head><body><main><h1>증거 기반 인터랙션 프로토타입</h1>'+
  '<p>고정된 테스트 사이트에서 확인된 4단계 행동만 재생합니다. 일반 웹사이트의 기능 복제 결과가 아닙니다.</p>'+
  '<div class="notice">모든 API 호출은 로컬 시뮬레이션입니다. 외부 네트워크 요청 0건 · 저장 데이터/로그인 없음</div>'+
  '<div class="values">'+items+'</div><div class="actions">'+buttons+
  '<button id="restart" type="button">처음부터</button></div>'+
  '<p id="status" role="status">준비 중</p><footer>완료 단계 <span id="step-count">0</span>/4 · '+
  '시뮬레이션된 API 횟수 <span id="api-simulated">0</span> · 기능 증거: synthetic-only</footer>'+
  '<script>'+runtime+'</script></main></body></html>';
}
