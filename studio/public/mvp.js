const $=id=>document.getElementById(id);
const sample={user_schema:{columns:[{name:'Item',type:'text'},{name:'Value',type:'number'},{name:'Region',type:'text'}]},sample_rows:[{Item:'Sample A',Value:120,Region:'KR'},{Item:'Sample B',Value:78,Region:'US'},{Item:'Sample C',Value:97,Region:'JP'}]};
$('data').value=JSON.stringify(sample,null,2);
let runs=[],selected='faithful',manifest=null;
const modes=['faithful','remix','schema'];
function status(message){$('status').textContent=message;}
function render(){for(const button of document.querySelectorAll('[data-mode]'))button.setAttribute('aria-selected',String(button.dataset.mode===selected));
 const artifact=manifest?.modes?.[selected];$('preview').removeAttribute('src');$('artifact').textContent=artifact?`${selected} · ${artifact.bytes.toLocaleString()} bytes · SHA-256 ${artifact.sha256.slice(0,16)}…`:'생성된 HTML 없음';$('download').hidden=!artifact;
 if(artifact){$('preview').src=artifact.preview_url;$('download').href=artifact.download_url;}
}
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>{selected=button.dataset.mode;render();});
async function get(url){const r=await fetch(url,{cache:'no-store'});const x=await r.json();if(!r.ok)throw Error(x.error||`HTTP ${r.status}`);return x;}
async function loadManifest(){manifest=null;const runId=$('run').value;if(!runId){render();await loadVisualReport();return;}
 try{manifest=await get(`/api/runs/${runId}/mvp`);status('기존 빌드 결과를 읽었습니다. 원본 사이트 재방문 없음.');}
 catch(e){if(e.message!=='mvp_not_built')status(`결과 조회: ${e.message}`);else status('이 분석에는 아직 3모드 결과물이 없습니다.');}
 render();await loadVisualReport();}
$('run').addEventListener('change',async()=>{const m=runs.find(r=>r.id===$('run').value);$('source').textContent=m?.target_url||'—';await loadManifest();});
$('build-form').addEventListener('submit',async e=>{e.preventDefault();$('build').disabled=true;try{
 const id=$('run').value;if(!id)throw Error('완료된 static-visual 분석을 먼저 선택하세요.');
 const parsed=JSON.parse($('data').value);const input={theme:$('theme').value,requirements:$('requirements').value,...parsed};
 status('저장된 분석에서 HTML 3종 생성 중…');const r=await fetch(`/api/runs/${id}/mvp-build`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
 const result=await r.json();if(!r.ok)throw Error(result.error||`HTTP ${r.status}`);manifest=result;status('HTML 3종 생성 완료. 미리보기 또는 다운로드로 확인하세요.');render();await loadVisualReport();
 }catch(err){status(`생성 실패: ${err.message}`);}finally{$('build').disabled=false;}});
(async()=>{try{const all=await get('/api/runs');runs=(all.runs||[]).filter(r=>r.mode==='static-visual'&&r.status==='completed');
 $('run').replaceChildren(new Option(runs.length?'완료된 분석을 선택하세요':'완료된 static-visual 분석 없음',''));
 for(const r of runs){const option=new Option(`${r.created_at} · ${r.target_url}`,r.id);$('run').add(option);}
 if(runs.length){$('run').value=runs[0].id;$('source').textContent=runs[0].target_url;await loadManifest();}
 else status('먼저 Analysis Console에서 허가된 사이트를 Static Visual 방식으로 분석하세요.');
 }catch(e){status(`이력 조회 실패: ${e.message}`);}})();



// One explicit user click: exact approved URL -> saved scriptless observation ->
// local three-mode build. Page load and refresh NEVER initiate an analysis.
let captureRunning=false;
async function refreshMvpRuns(chosenId){
 const data=await get('/api/runs');
 runs=(data.runs||[]).filter(r=>r.mode==='static-visual'&&r.status==='completed');
 $('run').replaceChildren(new Option(runs.length?'완료된 분석을 선택하세요':'완료된 static-visual 분석 없음',''));
 for(const item of runs)$('run').add(new Option(item.created_at+' · '+item.target_url,item.id));
 if(chosenId&&runs.some(r=>r.id===chosenId)){
  $('run').value=chosenId;$('source').textContent=runs.find(r=>r.id===chosenId).target_url;
 }else if(runs.length){$('run').value=runs[0].id;$('source').textContent=runs[0].target_url;}
 else {$('run').value='';$('source').textContent='—';}
}
get('/api/targets').then(targets=>{
 const approved=Array.isArray(targets.approved_urls)?targets.approved_urls:[];
 $('authorized-sites').replaceChildren();
 for(const url of approved)$('authorized-sites').append(new Option(url,url));
 if(approved.length&&!$('target-url').value)$('target-url').value=approved[0];
}).catch(err=>{$('capture-status').textContent='허가 URL 목록 조회 실패: '+err.message;});
$('capture-form').addEventListener('submit',async e=>{
 e.preventDefault();
 if(captureRunning)return;
 const target=$('target-url').value.trim();
 let input;
 try{
  // Validate input JSON BEFORE any source-site observation is scheduled.
  const schema=JSON.parse($('data').value);
  input={theme:$('theme').value,requirements:$('requirements').value,...schema};
  if(!schema||typeof schema!=='object'||Array.isArray(schema))throw Error('INVALID_SCHEMA_JSON');
 }catch(err){$('capture-status').textContent='입력 JSON 오류: '+err.message;return;}
 captureRunning=true;
 $('capture').disabled=true;$('build').disabled=true;$('run').disabled=true;
 let createdId=null;
 try{
  // UI preflight is not authorization: /api/runs repeats server-side allowlist checks.
  const approved=await get('/api/targets');
  if(!Array.isArray(approved.approved_urls)||!approved.approved_urls.includes(target))
   throw Error('승인된 정확한 HTTPS URL이 아닙니다. 사이트 허가 목록을 설정한 뒤 다시 실행하세요.');
  $('capture-status').textContent='허가 확인 완료 · 시각 분석 요청 중…';
  const request=await fetch('/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({target_url:target,analysis_mode:'static-visual'})});
  const scheduled=await request.json();
  if(!request.ok)throw Error(scheduled.error||'시각 분석 시작 실패: HTTP '+request.status);
  if(typeof scheduled.id!=='string'||!(/^[a-f0-9-]{36}$/.test(scheduled.id)))throw Error('분석 식별자 확인 실패');
  createdId=scheduled.id;
  const deadline=Date.now()+120000;
  let completed=false;
  while(Date.now()<deadline){
   const run=await get('/api/runs/'+createdId);
   if(run.status==='completed'){completed=true;break;}
   if(run.status==='failed'||run.status==='interrupted')
    throw Error('시각 분석이 완료되지 않았습니다: '+(run.error_code||run.error||run.status));
   $('capture-status').textContent='분석 '+(run.status||'진행 중')+' · 저장 완료를 기다리는 중…';
   await new Promise(resolve=>setTimeout(resolve,800));
  }
  if(!completed)throw Error('분석 대기 120초 초과. 기존 분석 목록에서 진행 상태를 확인하세요. 자동 재수집은 하지 않습니다.');
  const report=await get('/api/runs/'+createdId+'/report');
  if(report.reconstruction_available!==true)
   throw Error('저장된 도형 분석을 생성하지 못했습니다. 제한된 JS/외부 리소스로 화면 증거가 부족할 수 있습니다.');
  $('capture-status').textContent='분석 완료 · 저장된 도형에서 3모드 HTML 생성 중…';
  const build=await fetch('/api/runs/'+createdId+'/mvp-build',{method:'POST',
   headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  const generated=await build.json();
  if(!build.ok)throw Error(generated.error||'3모드 생성 실패: HTTP '+build.status);
  manifest=generated;
  await refreshMvpRuns(createdId);
  selected='faithful';render();await loadVisualReport();
  status('URL 입력 → 시각 분석 저장 → HTML 3종 생성 완료. 원본 기능·디자인 일치율은 별도 검증이 필요합니다.');
  $('capture-status').textContent='완료 · HTML 3종 미리보기와 다운로드를 사용할 수 있습니다.';
 }catch(err){
  $('capture-status').textContent='작업 중단: '+err.message+
   (createdId?' · 분석 ID '+createdId+' (중복 자동 실행 없음; 저장된 결과를 기존 목록에서 확인 가능)':'');
 }finally{
  captureRunning=false;$('capture').disabled=false;$('build').disabled=false;$('run').disabled=false;
 }
});



// Read-only on run selection/refresh; actual Chrome execution is opt-in POST.
async function loadVisualReport(){
 const id=$('run').value;
 $('visual-photos').hidden=true;
 $('comparison-source').removeAttribute('src');
 $('comparison-generated').removeAttribute('src');
 $('measure-faithful').disabled=!(id&&manifest?.modes?.faithful);
 await loadRefinement();
 if(!id||!manifest?.modes?.faithful){
  $('visual-status').textContent='원본형 HTML을 만든 후 저장된 원본과 비교할 수 있습니다.';
  return;
 }
 $('visual-status').textContent='저장된 비교 결과 조회 중 (원본 재방문 없음)…';
 try{
  const result=await get('/api/runs/'+id+'/mvp-comparison');
  if($('run').value!==id)return;
  $('visual-photos').hidden=false;
  $('comparison-source').src='/api/runs/'+id+'/screenshot';
  $('comparison-generated').src='/api/runs/'+id+'/mvp-replica-screenshot';
  $('measure-faithful').disabled=true; // successful measurements are immutable
  await loadRefinement();
  $('visual-status').textContent=result.status==='MEASURED'?
   '실측 픽셀 일치율 '+result.metrics.pixel_match_pct+'% · RGB 평균 오차 '+result.metrics.rgb_mae+
   ' · 화면 '+result.original.width+'×'+result.original.height+
   ' (8픽셀 간격 표본, RGB 차이 18 이하 일치 · 원본 기능 미검증)':
   '스크린샷 높이/폭 불일치 · 원본 '+result.original.width+'×'+result.original.height+
   ' / 생성 '+result.generated.width+'×'+result.generated.height+
   ' · 비교 이미지는 제공하지만 유사도 점수는 표시하지 않습니다.';
 }catch(e){
  if($('run').value===id)$('visual-status').textContent=
   e.message==='comparison_not_run'?'아직 비교하지 않았습니다. 버튼을 누르면 저장된 증거만 사용해 측정합니다.':
   '비교 미측정 · '+e.message+' (캡처가 없거나 원본·생성 증거가 유효하지 않을 수 있습니다)';
 }
}
$('measure-faithful').addEventListener('click',async()=>{
 const id=$('run').value;
 if(!id||!manifest?.modes?.faithful)return;
 $('measure-faithful').disabled=true;
 $('visual-status').textContent='저장된 원본과 원본형 HTML을 별도 Chrome에서 비교하는 중…';
 try{
  const r=await fetch('/api/runs/'+id+'/mvp-compare',{method:'POST'});
  const data=await r.json();
  if(!r.ok)throw Error(data.error||'HTTP '+r.status);
  await loadVisualReport();
 }catch(e){
  $('visual-status').textContent='비교 불가 · '+e.message+
   ' (이 작업은 원본을 다시 방문하거나 자동 재시도하지 않습니다)';
  $('measure-faithful').disabled=false;
 }
});


// Explicit, bounded CSS refinement; never called on page load unless reading receipt.
// Saved measured original remains immutable; a NO_IMPROVEMENT receipt never exposes HTML.
async function loadRefinement(){
 const id=$('run').value;
 $('refine-result').hidden=true;
 $('refined-download').hidden=true;
 $('refine-before').removeAttribute('src');
 $('refine-after').removeAttribute('src');
 $('refine-faithful').disabled=true;
 $('refine-status').textContent='유효한 원본형 비교가 필요합니다. 개선되지 않으면 HTML을 변경하지 않습니다.';
 if(!id||!manifest?.modes?.faithful)return;
 try{
  const existing=await get('/api/runs/'+id+'/mvp-refinement');
  if($('run').value!==id)return;
  if(existing.status==='IMPROVED'){
   $('refine-status').textContent='보정 성공 · 픽셀 일치율 '+existing.before.pixel_match_pct+'% → '+existing.after.pixel_match_pct+
    '% · RGB 오차 '+existing.before.rgb_mae+' → '+existing.after.rgb_mae+' (독립 오프라인 Chrome)';
   $('refine-result').hidden=false;
   $('refine-before').src='/api/runs/'+id+'/mvp-replica-screenshot';
   $('refine-after').src='/api/runs/'+id+'/mvp-refined-screenshot';
   $('refined-download').hidden=false;
   $('refined-download').href='/api/runs/'+id+'/mvp-refined-download';
  }else{
   $('refine-status').textContent='보정 후보 '+existing.candidate_count+
    '개 검증 · 모두 미개선으로 원본형 HTML 유지 (픽셀 '+existing.before.pixel_match_pct+'%, RGB 오차 '+existing.before.rgb_mae+')';
  }
 }catch(e){
  if($('run').value!==id)return;
  if(e.message==='refinement_not_run'){
   try{
    const baseline=await get('/api/runs/'+id+'/mvp-comparison');
    if(baseline.status==='MEASURED'){
     $('refine-faithful').disabled=false;
     $('refine-status').textContent='원본형 실측 완료 · 글자 4개와 주요 패널 최대 4개 위치 보정 후보를 Chrome에서 비교할 수 있습니다.';
    }else $('refine-status').textContent='원본·생성 해상도가 달라 보정 점수를 산출할 수 없습니다.';
   }catch(err){$('refine-status').textContent='보정 미실행 · '+err.message;}
  }else $('refine-status').textContent='보정 증거 조회 불가 · '+e.message;
 }
}
$('refine-faithful').addEventListener('click',async()=>{
 const id=$('run').value;
 if(!id||!manifest?.modes?.faithful)return;
 $('refine-faithful').disabled=true;
 $('refine-status').textContent='저장된 원본 기준 글자와 주요 패널 위치 수정안을 Chrome에서 평가 중…';
 try{
  const r=await fetch('/api/runs/'+id+'/mvp-refine',{method:'POST'});
  const data=await r.json();
  if(!r.ok)throw Error(data.error||'HTTP '+r.status);
  await loadRefinement();
 }catch(e){$('refine-status').textContent='보정 중단 · '+e.message+' (자동 재시도 없음)';}
});
