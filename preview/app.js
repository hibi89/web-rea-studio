// PUBLIC READ-ONLY DEMO. No fetch, XHR, WebSocket, external resources or storage.
const el=id=>document.getElementById(id);
const fixture='http://127.0.0.1:4317/';
const original='https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/';
const examples={
 'rea-browser':{
  target:fixture,name:'Fixture · REA browser',status:'DEMO',steps:'7 / 7',responses:'1',summary:'Controlled local fixture의 과거 성공 사례를 바탕으로 구성된 시각적 예시입니다.',
  report:{demo:true,live:false,analysis_mode:'rea-browser',sample_verdict:'PASS (과거 테스트 사례)',step_count:7,completed_steps:7,api_responses_200:1,screenshot_saved:false,note:'UI DEMO ONLY: actual Chrome/REA is not launched; the illustration is not a real screenshot.'},
  steps:['fixture-open · navigate · sample completed','fixture-sort · click · sample completed','fixture-filter · click · sample completed','fixture-inspect · evaluate · sample completed','fixture-api · GET · sample HTTP 200','fixture-screenshot · capture · illustration only'],
  network:['SAMPLE · GET /api/catalog · 200','SAMPLE · GET /assets/app.js · 200'],shot:'fixture'
 },
 'static-html':{
  target:original,name:'Daily Dashboard · Static HTML',status:'DEMO',steps:'1 / 1',responses:'—',summary:'2026-10-16에 관찰한 정적 HTML 분석 사례를 샘플로 표시합니다. 현재 사이트를 재조회하지 않습니다.',
  report:{demo:true,live:false,analysis_mode:'static-html',sample_verdict:'PASS (과거 정적 HTML 검사)',http_status:200,html_bytes:87532,buttons:10,scripts:3,step_count:1,completed_steps:1,screenshot_saved:false,note:'Archived sample values only. No live HTTPS request occurs in this preview.'},
  steps:['SAMPLE · HTTPS document · GET · 200'],network:['SAMPLE · GET / · HTTP 200'],shot:'none'
 },
 'dynamic-passive':{
  target:original,name:'Daily Dashboard · Passive Chrome',status:'DEMO',steps:'1 / 1',responses:'—',summary:'과거 확인된 Failed to fetch 사례를 예시로 보여줍니다. 현재 오류가 해결되었는지 검사하지 않습니다.',
  report:{demo:true,live:false,analysis_mode:'dynamic-passive',sample_verdict:'FAIL (과거 데이터 로딩 오류)',resource_requests:2,resource_fulfilled:1,resource_pending:1,application_fetch_error_visible:true,render_fidelity:'incomplete',screenshot_saved:false,note:'This is a past diagnostic example, not a real Chrome screenshot or a live rerun.'},
  steps:['SAMPLE · approved navigation · completed','SAMPLE · application data fetch · unsettled'],network:['SAMPLE · document requested · fulfilled','SAMPLE · data request · unsettled'],shot:'error'
 }
};
const labels=[['rea-browser','Fixture · REA 샘플'],['static-html','Static HTML 샘플'],['dynamic-passive','Passive Browser 실패 사례']];
function text(id,value){const e=el(id);if(e)e.textContent=value;}
function fill(id,items){const p=el(id);p.replaceChildren();for(const s of items){const d=document.createElement('div');d.className='inspect-item';d.textContent=s;p.append(d)}}
function imagePreview(type){
 const panel=el('preview');panel.replaceChildren();
 if(type==='none'){const placeholder=document.createElement('div');placeholder.className='placeholder';placeholder.textContent='STATIC HTML ONLY · NO SCREENSHOT · SAMPLE';panel.append(placeholder);return}
 const screen=document.createElement('div');screen.className='demo-screen';
 if(type==='error'){screen.innerHTML='<div class="demo-kicker">PASSIVE BROWSER / ARCHIVED SAMPLE</div><div class="demo-error"><strong>보고서를 불러오지 못했습니다</strong>Failed to fetch</div><div class="demo-disclaimer">실제 캡처 아님 · 과거 오류 상태를 설명하는 예시입니다.</div>'}
 else{screen.innerHTML='<div class="demo-kicker">REA FIXTURE / ILLUSTRATION ONLY</div><h4>Sample Browser Evidence</h4><div class="demo-cards"><div class="demo-card"><span>SCENARIO</span><strong>7 / 7</strong></div><div class="demo-card"><span>NETWORK</span><strong>200</strong></div><div class="demo-card"><span>MODE</span><strong>REA</strong></div></div><div class="demo-bars"><i style="height:44%"></i><i style="height:70%"></i><i style="height:50%"></i><i style="height:91%"></i><i style="height:66%"></i><i style="height:78%"></i></div><div class="demo-disclaimer">UI 모형 · 실제 브라우저 화면 또는 증거 자료가 아닙니다.</div>'}
 panel.append(screen);
}
function render(mode){
 const key=examples[mode]?mode:'rea-browser',x=examples[key];
 el('analysis-mode').value=key;el('target').value=x.target;
 text('target-mode','● PUBLIC DEMO · no remote requests');
 text('approved-list','이 주소는 데모 표기용입니다. 실행·데이터 수집·분석 요청은 발생하지 않습니다.');
 text('status',x.status);text('time','LIVE ANALYSIS OFF · 샘플 화면');
 text('steps',x.steps);text('responses',x.responses);text('verdict','SAMPLE');
 text('result-title',x.name+' · 샘플 결과');
 text('report',JSON.stringify(x.report,null,2));text('error','');
 el('run-error').hidden=true;
 fill('inspector-steps',x.steps);fill('inspector-network',x.network);
 text('inspector-summary','샘플 화면 · 실제 네트워크 호출 0건 · 브라우저 실행 0회');
 text('static-summary',x.summary);el('static-summary').hidden=false;
 imagePreview(x.shot);
 document.querySelectorAll('.history button').forEach(b=>b.classList.toggle('selected-run',b.dataset.mode===key));
}
const history=el('history');history.replaceChildren();
for(const [mode,label] of labels){
 const b=document.createElement('button');b.type='button';b.dataset.mode=mode;
 const a=document.createElement('span');a.textContent='SAMPLE · '+label;
 const small=document.createElement('small');small.textContent='UI 체험용, 실제 실행 아님';
 b.append(a,small);b.addEventListener('click',()=>render(mode));history.append(b);
}
el('run-form').addEventListener('submit',e=>{e.preventDefault();render(el('analysis-mode').value)});
el('analysis-mode').addEventListener('change',e=>render(e.target.value));
render('rea-browser');
