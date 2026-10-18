import {createHash} from 'node:crypto';
import {dimensionFilter} from '../skills/dashboard/dimension-filter.mjs';
import {groupBySum} from '../skills/dashboard/group-by-sum.mjs';
import {chartCrossfilter} from '../skills/dashboard/chart-crossfilter.mjs';
import {parseCsvRows,normalizeDataset,parseDataset,suggestMapping} from './mechanism-data.mjs';

const jsonSafe=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
export function validateMapping(rows,mapping){
  const columns=Object.keys(rows[0]||{});
  if(!mapping||!['dimension','group','measure'].every(key=>typeof mapping[key]==='string'&&columns.includes(mapping[key]))||
     new Set([mapping.dimension,mapping.group,mapping.measure]).size!==3)throw Error('INVALID_MAPPING');
  chartCrossfilter(rows,mapping,null,dimensionFilter,groupBySum);
  return mapping;
}
export function buildMechanismSpec(rows,mapping){
  validateMapping(rows,mapping);
  const field=(key,type)=>({column:mapping[key],type,provenance:'template',confidence:'local CSV/JSON mapping only'});
  return {version:1,reference:{kind:'local-user-or-demo-data',provenance:'template',confidence:'No remote reference observation'},
    inputs:[field('dimension','category'),field('group','category'),field('measure','finite-number')],
    skills:['dimension-filter','group-by-sum','chart-crossfilter'].map(id=>({id,provenance:'template',confidence:'independent authored implementation'})),
    edges:[{from:'dimension-filter',to:'group-by-sum',provenance:'template',confidence:'local source code and tests'},
      {from:'group-by-sum',to:'chart-crossfilter',provenance:'template',confidence:'same selected rows and sums'},
      {from:'chart-crossfilter',to:'KPI+SVG-chart',provenance:'template',confidence:'runtime smoke acceptance required'}],
    filters:[{column:mapping.dimension,all_value:null,provenance:'template',confidence:'explicit local filter semantics'}],
    aggregates:[{group:mapping.group,measure:mapping.measure,operation:'sum',nonfinite:'reject',blank:'reject',provenance:'template',confidence:'authored local behavior'}],
    interactions:[{action:'filter-selection',results:['kpi-total','SVG bar chart'],provenance:'template',confidence:'local app only'}],
    api:{status:'not-observed',algorithm:'unknown',provenance:'unknown',confidence:'no verified external API evidence'},
    limitations:['No proprietary JS/API/SQL copied or inferred','Fixture is not real-site reverse engineering']};
}

/** Browser-only function serialized into an isolated, standalone local HTML. */
function browserMain(){
  const byId=id=>document.getElementById(id);
  const status=msg=>{byId('status').textContent=msg;};
  const safeData=value=>JSON.stringify(value).replace(/</g,'\\u003c');
  const keys=['dimension','group','measure'];
  let rows=normalizeDataset(JSON.parse(byId('initial-rows').textContent));
  let mapping=JSON.parse(byId('initial-mapping').textContent);
  let confirmed=false;
  const fmt=new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2});
  const option=(text,value)=>new Option(text,value);
  function updateFields(){
    const columns=Object.keys(rows[0]);
    for(const name of keys){
      const box=byId(name);
      box.replaceChildren(...columns.map(c=>option(c,c)));
      box.value=columns.includes(mapping[name])?mapping[name]:columns[0];
    }
  }
  function updateCategories(){
    const box=byId('region');
    box.replaceChildren(option('전체 / ALL','__ALL__'));
    for(const value of new Set(rows.map(r=>String(r[mapping.dimension]??''))))box.add(option(value||'(blank)','v:'+value));
  }
  function paint(){
    if(!confirmed)return;
    const selected=byId('region').value==='__ALL__'?null:byId('region').value.slice(2);
    const data=chartCrossfilter(rows,mapping,selected,dimensionFilter,groupBySum);
    byId('total').textContent=fmt.format(data.total);
    byId('count').textContent=String(data.count);
    byId('trace').textContent='dimension-filter '+(selected??'ALL')+' → '+data.count+' records → group-by-sum('+mapping.group+','+mapping.measure+') → KPI + chart';
    const svg=byId('chart');svg.replaceChildren();
    const width=Math.max(640,data.chart.length*84+120),baseline=157;
    const max=Math.max(1,...data.chart.map(item=>Math.abs(item.total)));
    svg.setAttribute('viewBox','0 0 '+width+' 320');
    function node(tag,attrs,value){
      const element=document.createElementNS('http://www.w3.org/2000/svg',tag);
      for(const [key,val] of Object.entries(attrs))element.setAttribute(key,String(val));
      if(value!==undefined)element.textContent=String(value);
      svg.appendChild(element);
    }
    node('line',{x1:25,x2:width-12,y1:baseline,y2:baseline,stroke:'#adc6d4','stroke-width':2});
    for(const [i,item] of data.chart.entries()){
      const height=110*Math.abs(item.total)/max, x=52+i*84, y=item.total>=0?baseline-height:baseline;
      node('rect',{x,y,width:44,height:Math.max(1,height),rx:5,fill:item.total>=0?'#168e9c':'#c65d58'});
      node('text',{x:x+22,y:item.total>=0?Math.max(18,y-7):Math.min(305,y+height+17),'text-anchor':'middle','font-size':13,fill:'#12354e'},fmt.format(item.total));
      node('text',{x:x+22,y:295,'text-anchor':'middle','font-size':12,fill:'#48667c'},item.key.slice(0,14));
    }
    if(!data.chart.length)node('text',{x:width/2,y:165,'text-anchor':'middle'},'선택된 데이터 없음');
    svg.setAttribute('aria-label','group totals: '+data.chart.map(item=>item.key+'='+item.total).join(', '));
  }
  function apply(){
    try{
      const candidate=Object.fromEntries(keys.map(k=>[k,byId(k).value]));
      if(new Set(Object.values(candidate)).size!==3)throw Error('서로 다른 3개 컬럼이 필요합니다');
      chartCrossfilter(rows,candidate,null,dimensionFilter,groupBySum);
      mapping=candidate;confirmed=true;
      byId('initial-mapping').textContent=safeData(mapping);
      updateCategories();paint();byId('export').disabled=false;status('매핑 적용 완료. 지역 선택 시 KPI와 차트가 함께 갱신됩니다.');
    }catch(e){confirmed=false;byId('export').disabled=true;status('매핑 오류: '+e.message);}
  }
  byId('apply').addEventListener('click',apply);
  byId('region').addEventListener('change',()=>{try{paint();}catch(e){status('필터 오류: '+e.message);}});
  for(const name of keys)byId(name).addEventListener('change',()=>{confirmed=false;byId('export').disabled=true;status('컬럼을 변경했으면 매핑 적용을 누르세요.');});
  byId('upload').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      if(file.size>300000)throw Error('300KB 한도 초과');
      const format=/\.csv$/i.test(file.name)?'csv':/\.json$/i.test(file.name)?'json':null;
      if(!format)throw Error('CSV 또는 JSON만 지원');
      const proposed=parseDataset(await file.text(),format);
      rows=proposed;mapping=suggestMapping(rows);confirmed=false;
      byId('initial-rows').textContent=safeData(rows);
      updateFields();byId('region').replaceChildren();byId('chart').replaceChildren();
      byId('total').textContent='—';byId('count').textContent='—';byId('export').disabled=true;
      status('내 파일 '+file.name+' 로드 완료. 컬럼 자동 제안을 검토한 후 매핑 적용을 누르세요.');
    }catch(e){status('파일 거절: '+e.message);}
  });
  byId('export').addEventListener('click',()=>{
    if(!confirmed)return;
    byId('initial-rows').textContent=safeData(rows);
    byId('initial-mapping').textContent=safeData(mapping);
    const html='<!doctype html>\n'+document.documentElement.outerHTML;
    const url=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='mechanism-dashboard.html';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  updateFields();apply();
}

export function generateMechanismDashboard(sourceRows,sourceMapping){
  const rows=normalizeDataset(sourceRows);
  const mapping=validateMapping(rows,sourceMapping);
  const js=[dimensionFilter,groupBySum,chartCrossfilter,parseCsvRows,normalizeDataset,parseDataset,suggestMapping].map(fn=>fn.toString()).join('\n')+'\n('+browserMain.toString()+')();';
  const hash=createHash('sha256').update(js).digest('base64');
  const csp="default-src 'none'; connect-src 'none'; font-src 'none'; img-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; style-src 'unsafe-inline'; script-src 'sha256-"+hash+"'";
  const css='*{box-sizing:border-box}body{margin:0;background:#f3f7fa;color:#16334b;font:16px system-ui,sans-serif}.wrap{max-width:1080px;margin:auto;padding:30px 22px}h1{font-size:clamp(26px,4vw,38px);margin:12px 0}p,small{color:#597086}header{display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px}.tag{font-size:12px;letter-spacing:.1em;color:#18788a;font-weight:800}.card{background:#fff;border:1px solid #d6e3ea;border-radius:16px;padding:22px;margin:16px 0}.controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.controls label{display:grid;gap:6px;font-size:13px}select,input{width:100%;padding:10px;border:1px solid #c5d5df;border-radius:8px;background:#fff}button{border:0;border-radius:8px;background:#18788a;color:#fff;padding:11px 16px;cursor:pointer}button:disabled{opacity:.5}.metrics{display:grid;grid-template-columns:230px minmax(0,1fr);gap:14px}.metrics strong{display:block;font-size:40px;margin:20px 0}.metrics svg{width:100%;height:auto}.trace{font-size:12px;overflow-wrap:anywhere}.status{min-height:23px;color:#914f20}.foot{font-size:12px;color:#597086}@media(max-width:700px){.controls{grid-template-columns:1fr 1fr}.metrics{grid-template-columns:1fr}}@media(max-width:430px){.controls{grid-template-columns:1fr}}';
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><title>REA Mechanism Lab</title><style>'+css+'</style></head><body><main class="wrap"><header><div><div class="tag">REA / MECHANISM SKILLS · LOCAL TEMPLATE</div><h1>메커니즘 대시보드</h1><p>참고 사이트를 복제하지 않는 독립 로컬 집계·시각화</p></div><button type="button" id="export">현재 HTML 저장</button></header><div class="card"><label>내 CSV/JSON 파일 (300KB / 2,000행 제한) <input id="upload" type="file" accept=".csv,.json"></label><p><small>파일 내용은 서버에 업로드하지 않습니다. 자동 매핑은 명시적으로 확인해야 합니다.</small></p></div><div class="card controls"><label>필터 컬럼<select id="dimension"></select></label><label>그룹 컬럼<select id="group"></select></label><label>숫자 컬럼<select id="measure"></select></label><button id="apply" type="button">매핑 적용</button></div><div class="card"><label>지역/차원 필터 <select id="region"></select></label></div><p id="status" role="status" class="status"></p><div class="metrics"><section class="card"><div class="tag">합계 KPI</div><strong id="total">—</strong><small>선택 레코드: <b id="count">—</b></small></section><section class="card"><div class="tag">GROUP BY + SUM</div><h2>그룹별 합계</h2><svg id="chart" role="img"></svg><p id="trace" class="trace"></p></section></div><p class="foot">스킬 3종 결합 · 출처: template · 원본 API/서버 알고리즘: unknown</p></main><script type="application/json" id="initial-rows">'+jsonSafe(rows)+'</script><script type="application/json" id="initial-mapping">'+jsonSafe(mapping)+'</script><script>'+js+'</script></body></html>';
}
