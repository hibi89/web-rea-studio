import {createHash} from 'node:crypto';

const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const hex=s=>createHash('sha256').update(s).digest('hex');
const bounded=(s,max=90)=>typeof s==='string'?s.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,max):'';
const isSimpleColor=s=>typeof s==='string'&&(/^#[0-9a-f]{3,8}$/i.test(s)||/^rgba?\(\s*[\d., %]+\)$/.test(s))&&s.length<64;
const color=(s,fallback)=>isSimpleColor(s)?s:fallback;
const cssLength=s=>typeof s==='string'&&/^(?:\d{1,3}(?:\.\d{1,2})?px|0px)$/.test(s)?s:'0px';
const coord=n=>Number.isFinite(n)?Math.max(-100,Math.min(4000,Math.round(n))):0;
const size=n=>Number.isFinite(n)?Math.max(0,Math.min(4000,Math.round(n))):0;
const cspBase="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; form-action 'none'; object-src 'none'; frame-src 'self'; base-uri 'none'; frame-ancestors 'self'";
const searchScript=`(()=>{const input=document.getElementById('query');const table=document.getElementById('records');const tally=document.getElementById('count');const rows=[...table.tBodies[0].rows];let asc=true;function filter(){const value=input.value.toLocaleLowerCase();let count=0;for(const row of rows){row.hidden=!row.textContent.toLocaleLowerCase().includes(value);if(!row.hidden)count++}tally.textContent=String(count)}input.addEventListener('input',filter);for(const button of document.querySelectorAll('[data-sort]'))button.addEventListener('click',()=>{const index=Number(button.dataset.sort);asc=!asc;rows.sort((a,b)=>a.cells[index].textContent.localeCompare(b.cells[index].textContent,undefined,{numeric:true})*(asc?1:-1));table.tBodies[0].append(...rows);filter()});filter()})();`;
const sha256base64=s=>createHash('sha256').update(s).digest('base64');

export function normalizeMvpInput(body){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['theme','user_schema','sample_rows','requirements'].includes(k)))throw Error('INVALID_MVP_INPUT');
 const theme=body.theme??'midnight';
 if(!['midnight','paper','copper'].includes(theme))throw Error('INVALID_MVP_THEME');
 const requirements=body.requirements??'';
 if(typeof requirements!=='string'||requirements.length>300)throw Error('INVALID_MVP_REQUIREMENTS');
 const rawSchema=body.user_schema??{columns:[{name:'Item',type:'text'},{name:'Value',type:'number'}]};
 if(!rawSchema||typeof rawSchema!=='object'||Array.isArray(rawSchema)||Object.keys(rawSchema).some(k=>k!=='columns')||!Array.isArray(rawSchema.columns)||!rawSchema.columns.length||rawSchema.columns.length>10)throw Error('INVALID_MVP_SCHEMA');
 const names=new Set();
 const columns=rawSchema.columns.map(c=>{
  if(!c||typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['name','type'].includes(k))||typeof c.name!=='string'||c.name.trim().length<1||c.name.length>40||!['text','number','date'].includes(c.type))throw Error('INVALID_MVP_COLUMN');
  const name=bounded(c.name.trim(),40);if(names.has(name))throw Error('DUPLICATE_MVP_COLUMN');names.add(name);return {name,type:c.type};
 });
 const inputRows=body.sample_rows??[{'Item':'Sample A','Value':12},{'Item':'Sample B','Value':7}];
 if(!Array.isArray(inputRows)||inputRows.length>40)throw Error('INVALID_MVP_ROWS');
 const sample_rows=inputRows.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!names.has(k)))throw Error('INVALID_MVP_ROW');
  const result={};for(const c of columns){const v=row[c.name]??'';
   if(!['string','number','boolean'].includes(typeof v)||String(v).length>140||typeof v==='number'&&!Number.isFinite(v))throw Error('INVALID_MVP_CELL');
   result[c.name]=String(v);
  }return result;
 });
 return {theme,columns,sample_rows,requirements:bounded(requirements,300)};
}

export function buildSiteBlueprint(sanitizedGeometry){
 const g=sanitizedGeometry;
 if(!g||g.source!=='p4-geometry'||!Array.isArray(g.boxes)||!g.boxes.length||!g.viewport||!g.document)throw Error('MVP_GEOMETRY_REQUIRED');
 const viewport={width:size(g.viewport.width),height:size(g.viewport.height)};
 if(viewport.width<320||viewport.height<200)throw Error('MVP_VIEWPORT_INVALID');
 // Only the already sanitized, bounded observations are used. No source URL or remote assets.
 return {version:1,source_scope:'saved-static-visual-geometry-only',evidence_status:'observed-layout-only',viewport,
  document:{width:size(g.document.width),height:size(g.document.height)},
  tokens:{background:color(g.background,'#f7f8fa'),text:color(g.titles?.[0]?.color,'#1a2434')},
  boxes:g.boxes.slice(0,180).map(b=>({x:coord(b.x),y:coord(b.y),w:size(b.w),h:size(b.h),depth:size(b.depth),background:color(b.background,'transparent'),border:color(b.border_color,'transparent'),radius:cssLength(b.radius)})),
  titles:(g.titles||[]).slice(0,32).map(t=>({x:coord(t.x),y:coord(t.y),w:size(t.w),h:size(t.h),text:bounded(t.text,78),color:color(t.color,'#1a2434'),font_size:cssLength(t.font_size),weight:/^(normal|bold|[1-9]00)$/.test(t.font_weight)?t.font_weight:'normal'})),
  unknowns:['Original JavaScript and API behavior not verified','No live server or database integration','Layout based on saved script-disabled geometry']};
}

const palettes={midnight:{bg:'#10192a',card:'#1d2b42',ink:'#eef4ff',accent:'#68d4e7'},paper:{bg:'#f7f4ed',card:'#ffffff',ink:'#243149',accent:'#205ca6'},copper:{bg:'#281d1b',card:'#402b26',ink:'#fff4e5',accent:'#f0a66a'}};
function pageDoc(inner,style,title,script=''){
 const policy=cspBase+`; script-src ${script?`'sha256-${sha256base64(script)}'`:`'none'`}`;
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="'+escape(policy)+'"><title>'+escape(title)+'</title><style>'+style+'</style></head><body>'+inner+(script?'<script>'+script+'</script>':'')+'</body></html>';
}
function staticDoc(b,mode,theme){
 const pal=palettes[theme],remix=mode==='remix';
 const blocks=[...b.boxes].sort((a,c)=>a.depth-c.depth||c.w*c.h-a.w*a.h).map(x=>{
  const bg=remix?(x.w>140&&x.h>50?pal.card:pal.bg):x.background;
  const border=x.border!=='transparent'?'border:1px solid '+(remix?pal.accent:x.border)+';':'';
  return `<div class="region" aria-hidden="true" style="left:${x.x}px;top:${x.y}px;width:${x.w}px;height:${x.h}px;background:${bg};border-radius:${x.radius};${border}"></div>`;
 }).join('');
 const headings=b.titles.map(t=>`<div class="label" style="left:${t.x}px;top:${t.y}px;width:${t.w}px;height:${t.h}px;color:${remix?pal.ink:t.color};font-size:${t.font_size};font-weight:${t.weight}">${escape(t.text)}</div>`).join('');
 const bg=remix?pal.bg:b.tokens.background;
 const banner=remix?'Design remix · independent approximation':'Faithful layout · independent approximation';
 const css=`html,body{margin:0;min-height:100%;font-family:Arial,system-ui,sans-serif}body{background:${bg}}.page{position:relative;width:${b.document.width}px;min-height:${Math.max(b.document.height,b.viewport.height)}px;overflow:hidden}.region,.label{position:absolute;box-sizing:border-box}.label{line-height:1.45;overflow:hidden;white-space:nowrap}.scope{position:fixed;bottom:12px;right:12px;z-index:9999;padding:8px 12px;border-radius:8px;background:#151c2b;color:#fff;font:12px system-ui;box-shadow:0 3px 12px #0003}`;
 return pageDoc(`<main class="page" aria-label="저장된 도형 증거로 제작한 독립 화면">${blocks}${headings}</main><div class="scope">${banner} · original functions unverified</div>`,css,`REA MVP · ${mode}`);
}
function schemaDoc(b,input){
 const p=palettes[input.theme];
 const header=input.columns.map((c,i)=>`<th scope="col"><button type="button" data-sort="${i}" aria-label="${escape(c.name)} 정렬">${escape(c.name)} ↕</button></th>`).join('');
 const body=input.sample_rows.map(row=>'<tr>'+input.columns.map(c=>'<td>'+escape(row[c.name])+'</td>').join('')+'</tr>').join('');
 const subtitle=input.requirements?`<p class="hint">${escape(input.requirements)}</p>`:'';
 const markup=`<main class="shell"><aside class="side"><div class="logo">R / STUDIO</div><p>REFERENCE BLUEPRINT</p><h2>My Data</h2><small>Independent local preview</small></aside><section class="content"><header><small>SCHEMA-DRIVEN · LOCAL SAMPLE</small><h1>Data workspace</h1>${subtitle}</header><section class="stats"><article><small>FIELDS</small><strong>${input.columns.length}</strong></article><article><small>RECORDS</small><strong>${input.sample_rows.length}</strong></article><article><small>REFERENCE BLOCKS</small><strong>${b.boxes.length}</strong></article></section><section class="tablewrap"><div class="tabletop"><h2>Dataset records <span id="count">${input.sample_rows.length}</span></h2><label>검색 <input type="search" id="query" placeholder="표에서 검색" autocomplete="off"></label></div><div class="scroll"><table id="records"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div><p class="hint">이 화면은 입력된 로컬 데이터 또는 SAMPLE 데이터만 사용합니다. 원본 사이트의 API·동작은 미검증입니다.</p></section></section></main>`;
 const css=`:root{color-scheme:${input.theme==='paper'?'light':'dark'}}*{box-sizing:border-box}body{margin:0;background:${p.bg};color:${p.ink};font-family:system-ui,Arial,sans-serif}.shell{min-height:100vh;display:grid;grid-template-columns:240px minmax(0,1fr)}.side{padding:30px 22px;background:${p.card};border-right:1px solid ${p.accent}33}.side .logo{font-weight:800;letter-spacing:2px;color:${p.accent};margin-bottom:75px}.side p,.side small,header small,.hint{opacity:.74}.content{padding:40px;min-width:0}header h1{font-size:clamp(28px,4vw,44px);margin:12px 0 24px}.stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:26px}.stats article,.tablewrap{background:${p.card};border:1px solid ${p.accent}33;border-radius:16px;padding:22px}.stats article small{display:block;opacity:.7}.stats strong{font-size:32px;display:block;margin-top:10px}.tabletop{display:flex;gap:20px;align-items:center;justify-content:space-between}.tabletop h2{font-size:20px}.tabletop span{color:${p.accent}}input{border:1px solid ${p.accent}88;padding:11px;border-radius:9px;background:${p.bg};color:${p.ink}}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;text-align:left}th,td{padding:14px;border-bottom:1px solid ${p.accent}33;white-space:nowrap}th button{font:inherit;font-weight:700;color:${p.accent};background:none;border:0;cursor:pointer}tr[hidden]{display:none}.hint{font-size:12px}@media(max-width:750px){.shell{display:block}.side{padding:14px 24px}.side .logo{margin:0}.side p,.side h2,.side small{display:none}.content{padding:20px}.stats{gap:8px}.stats article{padding:14px}.tabletop{display:block}}`;
 return pageDoc(markup,css,'REA MVP · schema',searchScript);
}
export function buildMvpArtifacts(sanitizedGeometry,rawInput){
 const blueprint=buildSiteBlueprint(sanitizedGeometry),input=normalizeMvpInput(rawInput);
 const pages={faithful:staticDoc(blueprint,'faithful',input.theme),remix:staticDoc(blueprint,'remix',input.theme),schema:schemaDoc(blueprint,input)};
 const outputs=Object.fromEntries(Object.entries(pages).map(([mode,html])=>[mode,{html,sha256:hex(html),bytes:Buffer.byteLength(html)}]));
 if(Object.values(outputs).some(o=>o.bytes>250000))throw Error('MVP_OUTPUT_TOO_LARGE');
 return {blueprint,outputs,theme:input.theme,row_count:input.sample_rows.length,column_count:input.columns.length,unknowns:blueprint.unknowns};
}
export function mvpDocumentCsp(mode){return cspBase+`; script-src ${mode==='schema'?`'sha256-${sha256base64(searchScript)}'`:`'none'`}`;}
