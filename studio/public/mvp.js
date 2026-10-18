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
async function loadManifest(){manifest=null;const runId=$('run').value;if(!runId){render();return;}
 try{manifest=await get(`/api/runs/${runId}/mvp`);status('기존 빌드 결과를 읽었습니다. 원본 사이트 재방문 없음.');}
 catch(e){if(e.message!=='mvp_not_built')status(`결과 조회: ${e.message}`);else status('이 분석에는 아직 3모드 결과물이 없습니다.');}
 render();}
$('run').addEventListener('change',async()=>{const m=runs.find(r=>r.id===$('run').value);$('source').textContent=m?.target_url||'—';await loadManifest();});
$('build-form').addEventListener('submit',async e=>{e.preventDefault();$('build').disabled=true;try{
 const id=$('run').value;if(!id)throw Error('완료된 static-visual 분석을 먼저 선택하세요.');
 const parsed=JSON.parse($('data').value);const input={theme:$('theme').value,requirements:$('requirements').value,...parsed};
 status('저장된 분석에서 HTML 3종 생성 중…');const r=await fetch(`/api/runs/${id}/mvp-build`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
 const result=await r.json();if(!r.ok)throw Error(result.error||`HTTP ${r.status}`);manifest=result;status('HTML 3종 생성 완료. 미리보기 또는 다운로드로 확인하세요.');render();
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
  selected='faithful';render();
  status('URL 입력 → 시각 분석 저장 → HTML 3종 생성 완료. 원본 기능·디자인 일치율은 별도 검증이 필요합니다.');
  $('capture-status').textContent='완료 · HTML 3종 미리보기와 다운로드를 사용할 수 있습니다.';
 }catch(err){
  $('capture-status').textContent='작업 중단: '+err.message+
   (createdId?' · 분석 ID '+createdId+' (중복 자동 실행 없음; 저장된 결과를 기존 목록에서 확인 가능)':'');
 }finally{
  captureRunning=false;$('capture').disabled=false;$('build').disabled=false;$('run').disabled=false;
 }
});
