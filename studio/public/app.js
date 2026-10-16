const el=id=>document.getElementById(id);
const state={id:null,timer:null};
async function api(url,options){const res=await fetch(url,{cache:'no-store',...options});const body=await res.json();if(!res.ok)throw Error(body.error||`HTTP ${res.status}`);return body;}
function show(msg){el('error').textContent=msg||'';}
function diagnostic(run){const area=el('run-error');if(run.status==='failed'||run.status==='interrupted'){area.hidden=false;area.textContent=`분석 실패 · ${run.error_code||'CHECK_LOG'} · ${run.error||'실행 기록을 확인하십시오'} · 진단 로그: ${run.diagnostic_path||'results/studio/runs/<분석 ID>/rea-stderr.log'}`;}else{area.hidden=true;area.textContent='';}}
function fillList(id,rows,empty){const container=el(id);container.replaceChildren();if(!rows?.length){container.textContent=empty;return;}for(const entry of rows){const item=document.createElement('div');item.className='inspect-item';item.textContent=entry;container.append(item);}}
async function inspect(id){try{const x=await api(`/api/runs/${id}/inspection`);fillList('inspector-steps',x.steps?.map(s=>`${s.step_id} · ${s.action} · ${s.status} · ${s.elapsed_ms??'—'}ms`),'행동 없음');fillList('inspector-network',x.network?.map(n=>`${n.kind.toUpperCase()} · ${n.method||'—'} ${n.path||'—'} ${n.status||''}`),'네트워크 이벤트 없음');el('inspector-summary').textContent=`${x.browser?.product||'Browser'} ${x.browser?.version||''} · 증거 ${x.completeness} · 버튼/입력 ${x.page?.controls?.map(c=>c.id).join(', ')||'—'}`;}catch{fillList('inspector-steps',[],'구조화된 증거 없음');fillList('inspector-network',[],'검증 가능한 네트워크 자료 없음');el('inspector-summary').textContent='증거 요약을 사용할 수 없습니다.';}}
function setCurrent(run){
 state.id=run.id;
 el('status').textContent=run.status.toUpperCase();
 el('time').textContent=new Date(run.created_at).toLocaleString('ko-KR');
 el('run').disabled=['queued','running'].includes(run.status);
 el('result-title').textContent=`분석 ID: ${run.id}`;
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
  if(active){el('inspector-summary').textContent='분석 중...';el('report').textContent='REA 분석 실행 중... 완료 후 자동으로 결과를 표시합니다.';el('preview').replaceChildren();state.timer=setTimeout(()=>select(id),1100);return;}
  if(run.status==='completed'||run.status==='failed'){
   try{const report=await api(`/api/runs/${id}/report`);el('report').textContent=JSON.stringify(report,null,2);el('steps').textContent=`${report.completed_steps??'—'} / ${report.step_count??'—'}`;el('responses').textContent=String(report.api_responses_200??'—');el('verdict').textContent=report.verdict||'—';}catch{el('report').textContent='검증 리포트가 저장되지 않았습니다.';}
  }else el('report').textContent='분석을 완료하지 못했습니다.';
  await inspect(id);
  el('preview').replaceChildren();
  if(run.status==='completed'){
   const img=document.createElement('img');img.alt='REA 최종 화면 캡처';img.src=`/api/runs/${id}/screenshot`;img.onerror=()=>{img.remove();const placeholder=document.createElement('div');placeholder.className='placeholder';placeholder.textContent='SCREENSHOT UNAVAILABLE';el('preview').append(placeholder);};el('preview').append(img);
  }
  await list();
 }catch(e){show(e.message);}
}
el('run-form').addEventListener('submit',async e=>{
 e.preventDefault();el('run').disabled=true;
 try{const run=await api('/api/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target_url:el('target').value})});
  el('report').textContent='새 분석 작업을 등록했습니다.';el('steps').textContent='—';el('responses').textContent='—';el('verdict').textContent='—';await list();await select(run.id);
 }catch(err){show(err.message);el('run').disabled=false;}
});
list().then(async()=>{const {runs}=await api('/api/runs');if(runs.length)await select(runs[0].id);}).catch(e=>show(e.message));
