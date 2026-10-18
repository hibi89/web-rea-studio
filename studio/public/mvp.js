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
