const el=id=>document.getElementById(id);
const state={id:null,timer:null};
async function api(url,options){const res=await fetch(url,{cache:'no-store',...options});const body=await res.json();if(!res.ok)throw Error(body.error||`HTTP ${res.status}`);return body;}
function show(msg){el('error').textContent=msg||'';}
function diagnostic(run){const area=el('run-error');if(run.status==='failed'||run.status==='interrupted'){area.hidden=false;area.textContent=`분석 실패 · ${run.error_code||'CHECK_LOG'} · ${run.error||'실행 기록을 확인하십시오'}`+(run.diagnostic_path?` · 진단 로그: ${run.diagnostic_path}`:'');}else{area.hidden=true;area.textContent='';}}
function summarizeNetworkEntry(n){
 const kind=String(n.kind||'event').toUpperCase();
 const dest=n.path||(n.host?`[external] ${n.host}`:n.scope||'—');
 const state=n.reason||n.status||'—';
 return `${kind} · ${n.resource_type||'resource'} · ${dest} · ${state}`;
}
function fillList(id,rows,empty){const container=el(id);container.replaceChildren();if(!rows?.length){container.textContent=empty;return;}for(const entry of rows){const item=document.createElement('div');item.className='inspect-item';item.textContent=entry;container.append(item);}}
function showBlueprint(data){
 const node=el('frontend-blueprint');
 if(!data){node.hidden=true;node.textContent='';return;}
 const lines=[];
 if(data.source==='html-only'){
  lines.push('정적 HTML · 화면 실행 전 구조 단서 (원본 디자인 재현 아님)');
  lines.push('HTML 요소: '+Object.entries(data.tags||{}).filter(([,n])=>n>0).map(([tag,n])=>tag+' '+n).join(' · '));
  lines.push('스크립트 '+(data.scripts?.total??0)+'개 · inline '+(data.scripts?.inline??0)+'개');
  lines.push('JS 단서: fetch '+(data.scripts?.fetch_markers??0)+'회 · 이벤트 '+(data.scripts?.event_markers??0)+'회');
  if(data.scripts?.chart_markers?.length)lines.push('차트 코드 이름 단서: '+data.scripts.chart_markers.join(', '));
  lines.push('스타일: 내장 CSS '+(data.css?.style_blocks??0)+'블록 · 규칙 '+(data.css?.rule_groups??0)+'그룹');
  if(data.css?.colors?.length)lines.push('스타일 내 색상: '+data.css.colors.join(' · '));
  if(data.resources?.length)lines.push('리소스 참조: '+data.resources.slice(0,12).map(d=>d.kind+' '+(d.path||d.host||'—')).join(' / '));
  lines.push('API 재생: 미실행. API 응답 구조와 접근 권한 확인 전에는 모의 결과를 만들지 않습니다.');
 }else if(data.source==='computed-dom'&&Array.isArray(data.components)){
  lines.push('Chrome 화면에서 읽은 레이아웃 · '+(data.viewport?.w??0)+'×'+(data.viewport?.h??0)+' px');
  lines.push('분석한 요소 '+data.components.length+'개 · canvas '+(data.canvas_count??0)+' · svg '+(data.svg_count??0));
  for(const c of data.components.slice(0,28)){
   const r=c.rect||{},s=c.style||{};
   lines.push(c.tag+' · '+r.x+','+r.y+' · '+r.w+'×'+r.h+' · '+(s.display||'—')+
    ' · 글자 '+(s.font_size||'—')+' · 색 '+(s.color||'—')+' · 배경 '+(s.background||'—'));
  }
  lines.push('주의: 화면이 Failed to fetch 상태라면 이 위치와 스타일은 오류 화면 기준입니다.');
 }else lines.push('요소 좌표 수집 불가. 기존 DOM/스크린샷 증거는 보존됩니다.');
 node.textContent=lines.join('\n');node.hidden=false;
}

function showExploration(x){
 const f1=el('f1-summary'),f2=el('f2-summary');
 const inventory=x.exploration?.inventory||x.page?.interaction_inventory;
 const fixture=x.exploration?.source==='controlled-fixture-scenario'?x.exploration:null;
 if(fixture){
  const permissions=fixture.permission_policy;
  f1.textContent=(x.mode==='fixture-causal'||x.mode?.startsWith('fixture-generic-')?'실제 Chrome 합성 테스트':'통제된 REA 로컬 테스트')+' · 실행 단계 '+fixture.actions_observed+
   '개 · 완료 '+fixture.successful_steps+'개'+
   (permissions?.source==='controlled-action-audit'?
    ' · 허가 버튼 '+permissions.authorized_controls+'개 · 거부 요소 '+permissions.denied_controls+
    '개 · 무허가 실행 '+permissions.unauthorized_actions_executed+'회':'')+
   ' (외부 사이트 자동 탐색 아님)';
  fillList('f1-controls',(fixture.steps||[]).slice(0,28).map(s=>s.step_id+
   ' · '+s.action+' · '+s.status),'테스트 행동 없음');
  const transitions=fixture.state_transitions;
  f2.textContent='통제된 테스트의 화면 변화 '+(transitions?.observed_state_changes??0)+
   '건 · 변화 감지 단계 '+(transitions?.changed_steps??0)+'개 · '+
   (x.mode==='fixture-causal'||x.mode?.startsWith('fixture-generic-')
     ?'실제 Chrome에서 행동 → API 호출 검증 '+(fixture.verified_action_api_links??0)+'건 (합성 사이트 한정)'
     :'개별 API 인과관계는 별도 증거 필요');
  const stateLines=(transitions?.steps||[]).filter(step=>step.changed?.length)
    .slice(0,30).map(step=>step.step_id+' · '+step.changed
     .map(c=>c.field+' '+c.from+' → '+c.to).join(' / '));
  const requestLines=(x.mode==='fixture-causal'||x.mode?.startsWith('fixture-generic-'))?(transitions?.steps||[])
    .filter(step=>step.network_requests>0)
    .map(step=>step.step_id+' · API GET '+step.network_requests+'회 · 통제 실험 검증'):[];
  const relationships=fixture.feature_graph_summary?.relationships||[];
  fillList('feature-graph-relations',relationships.map(r=>
   r.action+' → 상태 {'+(r.changed_fields||[]).join(', ')+'}'+
   ((r.api_paths||[]).length?' · API '+r.api_paths.join(', '):' · API 없음')+
   ' · 관찰 '+r.observed_transitions+'회'), '관찰된 기능 연결 없음');
  fillList('f2-dependencies',[
   ...stateLines,...requestLines,
   ...(fixture.observed_endpoint_paths||[]).map(s=>'관찰된 네트워크 경로 · '+s)
  ],'관찰된 변화·요청 없음');
  return;
 }
 if(inventory?.source==='passive-controls'&&inventory.counts){
  const counts=inventory.counts;
  f1.textContent='읽기 전용 DOM 식별 '+counts.total+'개 · 버튼 '+counts.buttons+
   ' · 링크 '+counts.links+' · 입력 '+counts.inputs+' · 탭 '+counts.tabs+
   ' · 선택 '+counts.selects+' · 조작 실행 0회';
  fillList('f1-controls',(inventory.controls||[]).slice(0,35).map(c=>c.id+' · '+
   c.kind+(c.label?' · '+c.label:'')+(c.navigation?' · '+c.navigation:'')+
   ' · '+c.rect.x+','+c.rect.y+' / '+c.rect.width+'×'+c.rect.height),
   '식별된 요소 없음');
 }else if(x.mode==='static-html'){
  const controls=x.page?.controls||[];
  f1.textContent='정적 HTML 태그 '+controls.length+'개 · 실제 화면 노출·동작 미검증';
  fillList('f1-controls',controls.slice(0,30).map(c=>c.kind+' · '+(c.id||'(id 없음)')+' · '+(c.type||'')),
   '정적 HTML에서 식별된 컨트롤 없음');
 }else{
  f1.textContent='읽기 전용 조작 요소 정보 없음 (추출 실패 또는 기존 분석 기록)';
  fillList('f1-controls',[],'확인 가능한 요소 없음');
 }
 const map=x.exploration?.dependencies;
 if(map?.source==='read-only-network-evidence'){
  f2.textContent=map.mode==='static-visual'
   ?'JavaScript 미실행 · API 작동 원인 추론 불가'
   :'수동적 네트워크 요청 관찰 · 버튼 → API 인과관계 미확인';
  fillList('f2-dependencies',(map.dependencies||[]).map(d=>d.scope+
   (d.host?' '+d.host:'')+' · 이벤트 '+d.events+' · fetch 시도 '+
   d.fetch_attempts+' · 거부 '+d.fetch_rejections+' · 리소스 수신 '+d.loaded),
   '관찰된 요청 없음');
 }else{
  f2.textContent='API 관련 실행 증거 없음';
  fillList('f2-dependencies',[],'확인 가능한 요청 없음');
 }
}

async function inspect(id){try{const x=await api(`/api/runs/${id}/inspection`);showExploration(x);fillList('inspector-steps',x.steps?.map(s=>`${s.step_id} · ${s.action} · ${s.status} · ${s.elapsed_ms??'—'}ms`),'행동 없음');fillList('inspector-network',x.network?.map(summarizeNetworkEntry),'네트워크 이벤트 없음');if(x.mode==='static-html'){
   el('inspector-summary').textContent=`STATIC HTML · ${x.completeness} · 단일 HTTPS 요청 (브라우저 실행 없음)`;
   const page=x.page||{}, summary=page.summary||{};
   const lines=[`제목: ${page.title||'—'}`,`버튼 ${summary.buttons??0} · 입력 ${summary.inputs??0} · 폼 ${summary.forms??0} · 링크 ${summary.links??0} · 스크립트 ${summary.scripts??0}`,
    '주요 제목: '+(page.headings||[]).map(h=>`H${h.level} ${h.text}`).join(' / '),
    '내부 경로: '+(page.same_origin_paths||[]).join(', '),'주의: 서버 HTML만 분석. 실제 화면·JS 동작·API 통신은 미검증'];
   el('static-summary').hidden=false;el('static-summary').textContent=lines.join('\n');
   showBlueprint(page.frontend_blueprint);
  }else if(x.mode==='dynamic-passive'||x.mode==='static-visual'){
   showBlueprint(x.page?.frontend_blueprint);
   el('static-summary').hidden=false;el('static-summary').textContent=`${x.mode==='static-visual'?'JS 없이 그린 HTML 제목':'렌더링된 제목'}: ${x.page?.title||'—'}\n버튼 ${x.page?.counts?.buttons??0} · 입력 ${x.page?.counts?.inputs??0} · 링크 ${x.page?.counts?.links??0}\n${x.mode==='static-visual'?'JavaScript 미실행 HTML 화면입니다. 실제 데이터·동작·정상 브라우저 결과와 동일함을 증명하지 않습니다.':'차단된 외부 리소스는 화면 완성도에 영향을 줄 수 있습니다. 클릭/폼 제출은 실행하지 않습니다.'}`;
   el('inspector-summary').textContent=`${x.mode==='static-visual'?'Static Visual · JS 차단':'Passive Chrome'} · ${x.completeness} · 미완료 ${x.network_diagnostics?.pending_requests??'—'}개 · 브라우저 통신 실패 ${x.network_diagnostics?.browser_failures??'—'}건`;
  }else{showBlueprint(null);el('static-summary').hidden=true;el('static-summary').textContent='';el('inspector-summary').textContent=`${x.browser?.product||'Browser'} ${x.browser?.version||''} · 증거 ${x.completeness} · 버튼/입력 ${x.page?.controls?.map(c=>c.id).join(', ')||'—'}`;}}catch{showBlueprint(null);showExploration({});el('static-summary').hidden=true;fillList('inspector-steps',[],'구조화된 증거 없음');fillList('inspector-network',[],'검증 가능한 네트워크 자료 없음');el('inspector-summary').textContent='증거 요약을 사용할 수 없습니다.';}}

async function loadDiagnosis(id){
 const panel=el('diagnosis-panel');
 try {
  const x=await api('/api/runs/'+id+'/diagnosis');
  if(state.id!==id)return;
  const p=x.passive_browser;
  const link=el('download-dependencies');
  link.hidden=!p;
  if(p)link.href='/api/runs/'+id+'/dependencies';
  else link.removeAttribute('href');
  const lines=['진단 코드: '+(x.diagnosis||'UNKNOWN'), '상태: '+x.status+' / 방식: '+(x.mode||'—')];
  if(p){
   lines.push('브라우저 판정: '+(p.verdict||'UNKNOWN'));
   lines.push('요청 '+(p.requested??'—')+' · 성공 '+(p.fulfilled??'—')+' · 차단 '+(p.blocked??'—')+' · 미완료 '+(p.pending??'—')+' · 네트워크 오류 '+(p.browser_failures??'—'));
   if(p.fetch_attempts!==null&&p.fetch_attempts!==undefined)lines.push('앱 JS fetch 시도 '+p.fetch_attempts+' · 거부 '+(p.fetch_rejections??'—')+' · XHR open '+(p.xhr_attempts??'—'));
   if(p.synthetic_favicons!==null&&p.synthetic_favicons!==undefined)lines.push('파비콘 로컬 처리 '+p.synthetic_favicons+'건 (실제 사이트 요청 아님)');
   if(p.critical_resource_blocks!==null&&p.critical_resource_blocks!==undefined)lines.push('핵심 문서·스크립트·API 차단 '+p.critical_resource_blocks+'건');
   if(p.external_permission_review?.requires_explicit_approval){
    lines.push('외부 호스트 승인 검토 후보 (자동 허용 없음): '+p.external_permission_review.candidate_hosts.join(', '));
    lines.push('주의: 호스트 관찰만으로 원인·API 필요성·접근 권한은 확인되지 않습니다.');
   }
   lines.push('오류 분류: '+(p.failures||[]).join(', '));
   lines.push('최근 요청 경로/호스트 (쿼리 제외):');
   for(const n of p.recent_network_events||[])lines.push('  '+n.kind+' · '+(n.path||n.external_host||'—')+' · '+(n.reason||n.status||'—'));
  }
  if(p){
   try{
    const review=await api('/api/runs/'+id+'/dependencies');
    const packetLink=el('download-support-packet');
    packetLink.href='/api/runs/'+id+'/support-packet';
    packetLink.hidden=false;
    if(state.id!==id)return;
    lines.push('저장된 API 의존성: 네트워크 이벤트 '+review.summary.events_saved+'개 · 대상 그룹 '+review.summary.dependencies+'개');
    for(const dep of review.dependencies.slice(0,10)){
     const label=dep.scope==='external'?'외부 호스트 '+dep.host:'승인된 사이트 경로 '+dep.path;
     lines.push('  '+label+' · fetch '+dep.fetch_attempts+' / 거부 '+dep.fetch_rejections+' · 차단 '+dep.blocked+' · '+dep.assessment);
    }
    if(review.summary.missing_fetch_details)lines.push('누락된 요청 증거가 있어 실제 서버/API 작동 원인을 확정할 수 없습니다.');
    lines.push('이 요약은 저장된 기록만 읽으며 새로운 외부 요청을 하지 않습니다.');
   }catch{lines.push('저장된 API 의존성 정보를 불러오지 못했습니다. 기존 진단은 유지됩니다.');}
  }
  if(p){
   try{
    const gate=await api('/api/runs/'+id+'/permission-preflight');
    if(state.id!==id)return;
    const exportLink=el('download-permission-preflight');
    exportLink.href='/api/runs/'+id+'/permission-preflight';
    exportLink.hidden=false;
    lines.push('Q1 외부 연결 사전 점검: '+gate.decision+' (권한 자동 승인 0건)');
    lines.push('호스트 후보 '+gate.host_candidates.length+'개 · 미충족 조건 '+gate.blockers.length+'개');
    lines.push('연결 전에 필요한 증거: 소유자 권한, 정확한 경로·메서드, 요청 상한, 인증·CORS·보안 정책');
    lines.push('주의: 읽기 전용 사전 점검은 연결 승인이나 실제 서버 검증이 아닙니다.');
   }catch{lines.push('Q1 권한 사전 점검 자료가 없습니다. 외부 연결은 계속 금지됩니다.');}
  }
  lines.push('다음 단계: '+(x.next_action||'실패 단계 확인'));
  lines.push('주의: 원본 로그, 인증정보, 쿼리 문자열은 표시하지 않습니다.');
  el('diagnosis-details').textContent=lines.join('\n');
  el('diagnosis-copy-status').textContent='';
  panel.hidden=false;
 } catch {
  if(state.id!==id)return;
  el('diagnosis-details').textContent='진단 자료를 읽지 못했습니다. npm run diagnose 명령을 사용하세요.';
  el('diagnosis-copy-status').textContent='';
  panel.hidden=false;
 }
}
el('copy-diagnosis').addEventListener('click',async()=>{
 try{
  if(!navigator.clipboard?.writeText)throw Error('clipboard_unavailable');
  await navigator.clipboard.writeText(el('diagnosis-details').textContent);
  el('diagnosis-copy-status').textContent='진단 요약을 복사했습니다.';
 }catch{el('diagnosis-copy-status').textContent='자동 복사 불가. 위 텍스트를 선택해 복사하세요.';}
});

function setCurrent(run){
 state.id=run.id;
 el('open-screenshot').hidden=true;
 el('open-screenshot').removeAttribute('href');
 el('p4-panel').hidden=true;
 el('control-map-actions').hidden=true;
 for(const linkId of ['open-control-map','download-control-map','download-control-contract']){
  el(linkId).hidden=true;el(linkId).removeAttribute('href');
 }
 el('feature-graph-panel').hidden=true;
 el('download-passive-blueprint').hidden=true;
 el('download-passive-blueprint').removeAttribute('href');
 el('download-feature-graph').hidden=true;
 el('download-feature-graph').removeAttribute('href');
 el('f3-panel').hidden=true;
 el('f4-panel').hidden=true;
 for(const linkId of ['open-behavior','download-behavior','open-generic','download-generic']){
  el(linkId).hidden=true;el(linkId).removeAttribute('href');
 }
 for(const linkId of ['download-manifest','download-reconstruction']){
  el(linkId).hidden=true;el(linkId).removeAttribute('href');
 }
 el('open-reconstruction').hidden=true;
 el('open-reconstruction').removeAttribute('href');
 el('p5-comparison').hidden=true;
 for(const key of ['p5-original','p5-replica'])el(key).removeAttribute('src');
 el('diagnosis-panel').hidden=true;
 el('download-dependencies').hidden=true;
 el('download-dependencies').removeAttribute('href');
 el('download-support-packet').hidden=true;
 el('download-support-packet').removeAttribute('href');
 el('download-permission-preflight').hidden=true;
 el('download-permission-preflight').removeAttribute('href');
 el('diagnosis-copy-status').textContent='';
 el('status').textContent=run.status.toUpperCase();
 el('time').textContent=new Date(run.created_at).toLocaleString('ko-KR');
 el('run').disabled=['queued','running'].includes(run.status);
 el('result-title').textContent=`분석 ID: ${run.id} · ${run.mode==='static-html'?'STATIC HTML':run.mode==='dynamic-passive'?'PASSIVE CHROME':run.mode==='static-visual'?'STATIC VISUAL':run.mode==='fixture-causal'?'F2 SYNTHETIC CHROME':run.mode?.startsWith('fixture-generic-')?'F4 GENERIC SYNTHETIC':'REA BROWSER'}`;
 if(run.status==='failed'||run.status==='interrupted')show(run.error);
 else show('');
}
async function list(){
 const {runs}=await api('/api/runs');const holder=el('history');holder.replaceChildren();
 if(!runs.length){holder.textContent='아직 분석 이력이 없습니다.';return;}
 for(const run of runs){const b=document.createElement('button');b.type='button';b.className=run.id===state.id?'selected-run':'';
 const a=document.createElement('span');a.textContent=`${run.status.toUpperCase()} · ${run.id.slice(0,8)}`;
 const date=document.createElement('small');date.textContent=new Date(run.created_at).toLocaleString('ko-KR');b.append(a,date);b.addEventListener('click',()=>select(run.id));holder.append(b);}
}
async function select(id){
 clearTimeout(state.timer);
 try{
  const run=await api(`/api/runs/${id}`);
  setCurrent(run);diagnostic(run);
  const active=['queued','running'].includes(run.status);
  if(active){el('inspector-summary').textContent='분석 중...';el('report').textContent=(run.mode==='static-html'?'HTTPS HTML 분석 중...':run.mode==='fixture-causal'?'합성 Chrome 행동/API 검증 중...':'REA 브라우저 분석 실행 중...')+' 완료 후 자동으로 결과를 표시합니다.';el('preview').replaceChildren();state.timer=setTimeout(()=>select(id),1100);return;}
  let screenshotSaved=false,reconstructionAvailable=false,comparisonAvailable=false,manifestAvailable=false,behaviorAvailable=false,genericAvailable=false,controlMapAvailable=false,controlMapCount=0,featureGraphAvailable=false,featureGraphStates=0,featureGraphRoutes=0;
  if(run.status==='completed'||run.status==='failed'){
   try{const report=await api(`/api/runs/${id}/report`);el('report').textContent=JSON.stringify(report,null,2);screenshotSaved=report.screenshot_saved===true;reconstructionAvailable=report.reconstruction_available===true;comparisonAvailable=report.visual_comparison_available===true;manifestAvailable=report.evidence_manifest_available===true;behaviorAvailable=report.behavior_reconstruction_available===true;genericAvailable=report.generic_prototype_available===true;controlMapAvailable=report.control_map_available===true;controlMapCount=report.control_map_count??0;featureGraphAvailable=report.feature_graph_available===true;featureGraphStates=report.feature_graph_states??0;featureGraphRoutes=report.feature_graph_routes??0;el('steps').textContent=`${report.completed_steps??'—'} / ${report.step_count??'—'}`;el('responses').textContent=String(report.api_responses_200??'—');el('verdict').textContent=report.verdict||'—';}catch{el('report').textContent='검증 리포트가 저장되지 않았습니다.';}
  }else el('report').textContent='분석을 완료하지 못했습니다.';
  await inspect(id);
  if(run.mode==='dynamic-passive'&&!active){
   const link=el('download-passive-blueprint');
   link.href=`/api/runs/${id}/passive-blueprint`;
   link.hidden=false;
  }
  if(manifestAvailable&&!active){
   el('f3-panel').hidden=false;
   const link=el('download-manifest');link.href=`/api/runs/${id}/manifest`;link.hidden=false;
  }
  if(run.mode?.startsWith('fixture-generic-')&&featureGraphAvailable&&!active){
   el('feature-graph-panel').hidden=false;
   el('feature-graph-status').textContent='관찰된 상태 '+featureGraphStates+'개 · Chrome 검증 탐색 경로 '+featureGraphRoutes+'개 · 실제 외부 API 호출 0건';
   const link=el('download-feature-graph');
   link.href=`/api/runs/${id}/feature-graph`;link.hidden=false;
  }
  if(run.mode==='fixture-causal'&&!active){
   el('f4-panel').hidden=false;
   el('f4-status').textContent=behaviorAvailable
    ?'Chrome 실험과 독립 앱의 4개 행동이 일치했습니다. 실제 API 요청은 0건입니다.'
    :'검증된 독립 앱이 없습니다. F2 실험 기록은 별도로 확인할 수 있습니다.';
   if(behaviorAvailable){
    const preview=el('open-behavior'),download=el('download-behavior');
    preview.href=`/api/runs/${id}/behavior-prototype`;preview.hidden=false;
    download.href=`/api/runs/${id}/behavior-prototype-download`;download.hidden=false;
   }
  }
  if(run.mode?.startsWith('fixture-generic-')&&!active){
   el('f4-panel').hidden=false;
   el('f4-status').textContent=genericAvailable
    ?'두 분기 경로의 3개 행동을 Chrome에서 재생성·검증했습니다. 실제 API 요청 0건.'
    :'범용 재생성 검증을 통과한 결과물이 없습니다.';
   el('f4-caveat').textContent='상품 목록/분석 대시보드의 합성 행동만 재생합니다. 임의의 외부 웹사이트 복원은 아닙니다.';
   if(genericAvailable){
    const p=el('open-generic'),d=el('download-generic');
    p.href=`/api/runs/${id}/generic-prototype`;p.hidden=false;
    d.href=`/api/runs/${id}/generic-prototype-download`;d.hidden=false;
   }
  }else el('f4-caveat').textContent='통제된 합성 테스트에서 검증한 행동만 재생합니다. API는 로컬 시뮬레이션이며 실제 웹사이트의 기능 복제나 데이터 복원을 의미하지 않습니다.';
  if(run.mode==='static-visual'&&!active){
   el('p4-panel').hidden=false;
   el('p4-status').textContent=reconstructionAvailable
    ?'측정된 레이아웃으로 독립형 HTML/CSS를 생성했습니다. 클릭해서 비교할 수 있습니다.'
    :'P4 영역 증거가 없거나 재구성하지 못했습니다. 기존 화면 캡처는 보존됩니다.';
   if(reconstructionAvailable){
    const link=el('open-reconstruction');
    link.href=`/api/runs/${id}/reconstruction`;
    link.hidden=false;
    const exportLink=el('download-reconstruction');
    exportLink.href=`/api/runs/${id}/reconstruction-download`;
    exportLink.hidden=false;
   }
   if(controlMapAvailable){
    el('control-map-actions').hidden=false;
    el('control-map-summary').textContent='화면 위치 '+controlMapCount+'개 확인. 버튼과 링크의 실행 기능은 모두 비활성입니다.';
    for(const [id,suffix] of [['open-control-map','control-map'],['download-control-map','control-map-download'],['download-control-contract','control-contract']]){
     const link=el(id);link.href=`/api/runs/${id}/${suffix}`;link.hidden=false;
    }
   }
  }
  if(comparisonAvailable&&run.mode==='static-visual'){
   try{
    const metrics=await api(`/api/runs/${id}/comparison`);
    if(state.id===id){
     el('p5-comparison').hidden=false;
     const qualityGate=metrics.quality_gate;
     el('p5-status').textContent=!qualityGate
      ?'과거 비교 기록: 신규 전체 화면 품질 관문으로 검증되지 않았습니다.'
      :qualityGate.status==='VISUAL_THRESHOLD_MET_STATIC_ONLY'
       ?'정적 화면 품질 관문 충족 · 동작/API/데이터 동일성은 미검증'
       :'정적 화면 품질 관문 미충족 · '+(qualityGate.reasons||[]).join(', ')+
        ' · 잘린 영역은 불일치로 계산';
     el('p5-mae').textContent=String(metrics.rgb_mae)+' / 255 (낮을수록 유사)';
     el('p5-match').textContent=String(metrics.pixel_match_pct)+'% (높을수록 유사)';
     el('p5-overlap').textContent=metrics.coverage_pct===undefined
      ?String(metrics.overlap_area_pct)+'% (구버전 겹침 측정, 미검증)'
      :String(metrics.coverage_pct)+'% (전체 비교 범위 · 겹침 '+metrics.overlap_area_pct+'%)';
     const geometry=metrics.geometry;
     el('p5-geometry').textContent=geometry?.status==='measured-not-certified'
      ?'영역 '+geometry.matched_regions+'/'+geometry.original_regions+' 일치 ('+geometry.region_match_pct+
       '%) · 좌표 평균 오차 '+geometry.average_geometry_error_px+'px · 배경색 동일 '+geometry.exact_background_match_pct+'%'
       +(geometry.ignored_same_color_wrappers?' · 동일 배경 구조 컨테이너 '+geometry.ignored_same_color_wrappers+'개 별도':'')
       +(geometry.unmatched_reference_regions?.length
         ?'\n매칭되지 않은 원본 영역: '+geometry.unmatched_reference_regions.slice(0,6)
           .map(r=>r.tag+' ['+r.x+','+r.y+'] '+r.width+'×'+r.height).join(' / ')
         :'')
      :'영역 비교 데이터 없음';
     el('p5-original').src=`/api/runs/${id}/screenshot`;
     el('p5-replica').src=`/api/runs/${id}/reconstruction-screenshot`;
    }
   }catch{
    el('p5-comparison').hidden=true;
   }
  }
  if(['failed','interrupted'].includes(run.status))await loadDiagnosis(id);
  el('preview').replaceChildren();
  if((run.status==='completed'||run.status==='failed')&&run.mode!=='static-html'&&screenshotSaved){
   const link=el('open-screenshot');
   link.href=`/api/runs/${id}/screenshot`;
   link.hidden=false;
   const img=document.createElement('img');img.alt='REA 최종 화면 캡처';img.src=`/api/runs/${id}/screenshot`;img.onerror=()=>{img.remove();const placeholder=document.createElement('div');placeholder.className='placeholder';placeholder.textContent='SCREENSHOT UNAVAILABLE';el('preview').append(placeholder);};el('preview').append(img);
  }
  if(run.status==='completed'&&run.mode==='static-html'){const placeholder=document.createElement('div');placeholder.className='placeholder';placeholder.textContent='STATIC HTML ONLY · NO SCREENSHOT';el('preview').append(placeholder);}
  await list();
 }catch(e){show(e.message);}
}
el('run-form').addEventListener('submit',async e=>{
 e.preventDefault();el('run').disabled=true;
 try{const run=await api('/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target_url:el('target').value,...((approvedTargets.includes(el('target').value)||el('target').value===fixtureUrl)?{analysis_mode:el('analysis-mode').value}:{})})});
  el('report').textContent='새 분석 작업을 등록했습니다.';el('steps').textContent='—';el('responses').textContent='—';el('verdict').textContent='—';await list();await select(run.id);
 }catch(err){show(err.message);el('run').disabled=false;}
});
list().then(async()=>{const {runs}=await api('/api/runs');if(runs.length)await select(runs[0].id);}).catch(e=>show(e.message));

let approvedTargets=[],fixtureUrl='';
api('/api/targets').then(x=>{
 approvedTargets=x.approved_urls||[];fixtureUrl=x.fixture;
 if(approvedTargets.length && el('target').value===x.fixture) el('target').value=approvedTargets[0];
 el('approved-list').textContent=approvedTargets.length?`승인된 HTTPS 사이트: ${approvedTargets.join(' · ')}`:'외부 사이트는 시작 전 WEB_REA_ALLOWED_URLS 환경변수에 정확한 HTTPS URL을 등록해야 합니다.';
 const update=()=>{
  const target=el('target').value,yes=approvedTargets.includes(target),fixture=target===x.fixture;
  const control=el('analysis-mode');
  const acceptable=fixture?['rea-browser','fixture-causal','fixture-generic-catalog','fixture-generic-analytics']:['static-html','dynamic-passive','static-visual'];
  if((yes||fixture)&&!acceptable.includes(control.value))control.value=fixture?'rea-browser':'static-html';
  control.disabled=!(yes||fixture);
  for(const o of control.options)o.hidden=!acceptable.includes(o.value);
  el('target-mode').textContent=fixture
   ?(control.value==='fixture-causal'?'● Isolated synthetic Chrome: 4 fixed actions':control.value.startsWith('fixture-generic-')?'● Isolated synthetic Chrome: branching app':'● REA controlled browser')
   :yes?(control.value==='static-html'?'● Approved HTTPS · static HTML':
    control.value==='static-visual'?'● Approved HTTPS · no JS, visual only':'● Approved HTTPS · passive Chrome, no clicks'):'● Not approved';
 };
 el('target').addEventListener('input',update);el('analysis-mode').addEventListener('change',update);update();
}).catch(e=>show(e.message));
