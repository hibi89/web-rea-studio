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

async function inspect(id){try{const x=await api(`/api/runs/${id}/inspection`);fillList('inspector-steps',x.steps?.map(s=>`${s.step_id} · ${s.action} · ${s.status} · ${s.elapsed_ms??'—'}ms`),'행동 없음');fillList('inspector-network',x.network?.map(summarizeNetworkEntry),'네트워크 이벤트 없음');if(x.mode==='static-html'){
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
  }else{showBlueprint(null);el('static-summary').hidden=true;el('static-summary').textContent='';el('inspector-summary').textContent=`${x.browser?.product||'Browser'} ${x.browser?.version||''} · 증거 ${x.completeness} · 버튼/입력 ${x.page?.controls?.map(c=>c.id).join(', ')||'—'}`;}}catch{showBlueprint(null);el('static-summary').hidden=true;fillList('inspector-steps',[],'구조화된 증거 없음');fillList('inspector-network',[],'검증 가능한 네트워크 자료 없음');el('inspector-summary').textContent='증거 요약을 사용할 수 없습니다.';}}

async function loadDiagnosis(id){
 const panel=el('diagnosis-panel');
 try {
  const x=await api('/api/runs/'+id+'/diagnosis');
  if(state.id!==id)return;
  const p=x.passive_browser;
  const lines=['진단 코드: '+(x.diagnosis||'UNKNOWN'), '상태: '+x.status+' / 방식: '+(x.mode||'—')];
  if(p){
   lines.push('브라우저 판정: '+(p.verdict||'UNKNOWN'));
   lines.push('요청 '+(p.requested??'—')+' · 성공 '+(p.fulfilled??'—')+' · 차단 '+(p.blocked??'—')+' · 미완료 '+(p.pending??'—')+' · 네트워크 오류 '+(p.browser_failures??'—'));
   if(p.fetch_attempts!==null&&p.fetch_attempts!==undefined)lines.push('앱 JS fetch 시도 '+p.fetch_attempts+' · 거부 '+(p.fetch_rejections??'—')+' · XHR open '+(p.xhr_attempts??'—'));
   if(p.synthetic_favicons!==null&&p.synthetic_favicons!==undefined)lines.push('파비콘 로컬 처리 '+p.synthetic_favicons+'건 (실제 사이트 요청 아님)');
   lines.push('오류 분류: '+(p.failures||[]).join(', '));
   lines.push('최근 요청 경로/호스트 (쿼리 제외):');
   for(const n of p.recent_network_events||[])lines.push('  '+n.kind+' · '+(n.path||n.external_host||'—')+' · '+(n.reason||n.status||'—'));
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
 el('open-reconstruction').hidden=true;
 el('open-reconstruction').removeAttribute('href');
 el('p5-comparison').hidden=true;
 for(const key of ['p5-original','p5-replica'])el(key).removeAttribute('src');
 el('diagnosis-panel').hidden=true;
 el('diagnosis-copy-status').textContent='';
 el('status').textContent=run.status.toUpperCase();
 el('time').textContent=new Date(run.created_at).toLocaleString('ko-KR');
 el('run').disabled=['queued','running'].includes(run.status);
 el('result-title').textContent=`분석 ID: ${run.id} · ${run.mode==='static-html'?'STATIC HTML':run.mode==='dynamic-passive'?'PASSIVE CHROME':run.mode==='static-visual'?'STATIC VISUAL':'REA BROWSER'}`;
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
  if(active){el('inspector-summary').textContent='분석 중...';el('report').textContent=(run.mode==='static-html'?'HTTPS HTML 분석 중...':'REA 브라우저 분석 실행 중...')+' 완료 후 자동으로 결과를 표시합니다.';el('preview').replaceChildren();state.timer=setTimeout(()=>select(id),1100);return;}
  let screenshotSaved=false,reconstructionAvailable=false,comparisonAvailable=false;
  if(run.status==='completed'||run.status==='failed'){
   try{const report=await api(`/api/runs/${id}/report`);el('report').textContent=JSON.stringify(report,null,2);screenshotSaved=report.screenshot_saved===true;reconstructionAvailable=report.reconstruction_available===true;comparisonAvailable=report.visual_comparison_available===true;el('steps').textContent=`${report.completed_steps??'—'} / ${report.step_count??'—'}`;el('responses').textContent=String(report.api_responses_200??'—');el('verdict').textContent=report.verdict||'—';}catch{el('report').textContent='검증 리포트가 저장되지 않았습니다.';}
  }else el('report').textContent='분석을 완료하지 못했습니다.';
  await inspect(id);
  if(run.mode==='static-visual'&&!active){
   el('p4-panel').hidden=false;
   el('p4-status').textContent=reconstructionAvailable
    ?'측정된 레이아웃으로 독립형 HTML/CSS를 생성했습니다. 클릭해서 비교할 수 있습니다.'
    :'P4 영역 증거가 없거나 재구성하지 못했습니다. 기존 화면 캡처는 보존됩니다.';
   if(reconstructionAvailable){
    const link=el('open-reconstruction');
    link.href=`/api/runs/${id}/reconstruction`;
    link.hidden=false;
   }
  }
  if(comparisonAvailable&&run.mode==='static-visual'){
   try{
    const metrics=await api(`/api/runs/${id}/comparison`);
    if(state.id===id){
     el('p5-comparison').hidden=false;
     el('p5-status').textContent=metrics.dimensions_equal
      ?'두 Chrome 화면의 같은 좌표를 비교했습니다.'
      :'캡처 크기가 달라 겹치는 영역만 비교했습니다.';
     el('p5-mae').textContent=String(metrics.rgb_mae)+' / 255 (낮을수록 유사)';
     el('p5-match').textContent=String(metrics.pixel_match_pct)+'% (높을수록 유사)';
     el('p5-overlap').textContent=String(metrics.overlap_area_pct)+'%';
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
 try{const run=await api('/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target_url:el('target').value,...(approvedTargets.includes(el('target').value)?{analysis_mode:el('analysis-mode').value}:{})})});
  el('report').textContent='새 분석 작업을 등록했습니다.';el('steps').textContent='—';el('responses').textContent='—';el('verdict').textContent='—';await list();await select(run.id);
 }catch(err){show(err.message);el('run').disabled=false;}
});
list().then(async()=>{const {runs}=await api('/api/runs');if(runs.length)await select(runs[0].id);}).catch(e=>show(e.message));

let approvedTargets=[];
api('/api/targets').then(x=>{
 approvedTargets=x.approved_urls||[];
 if(approvedTargets.length && el('target').value===x.fixture) el('target').value=approvedTargets[0];
 el('approved-list').textContent=approvedTargets.length?`승인된 HTTPS 사이트: ${approvedTargets.join(' · ')}`:'외부 사이트는 시작 전 WEB_REA_ALLOWED_URLS 환경변수에 정확한 HTTPS URL을 등록해야 합니다.';
 const update=()=>{const target=el('target').value;const yes=approvedTargets.includes(target);el('analysis-mode').disabled=!yes;el('target-mode').textContent=target===x.fixture?'● REA controlled browser':yes?(el('analysis-mode').value==='static-html'?'● Approved HTTPS · static HTML':el('analysis-mode').value==='static-visual'?'● Approved HTTPS · no JS, visual only':'● Approved HTTPS · passive Chrome, no clicks'):'● Not approved';};
 el('target').addEventListener('input',update);el('analysis-mode').addEventListener('change',update);update();
}).catch(e=>show(e.message));
