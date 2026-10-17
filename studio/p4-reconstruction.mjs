/* Read-only visual geometry probe: no clicks, requests or input values. */
export const P4_GEOMETRY_PROBE="(()=>{\n const max=180,smallMax=48,nodes=[...document.querySelectorAll('body,header,nav,main,aside,section,article,footer,div,h1,h2,h3')].slice(0,1400);\n const boxes=[],titles=[],primitives=[];\n const asNum=n=>Number.isFinite(n)?Math.round(n):0;\n const bg=s=>s&&s!=='transparent'&&!/^rgba?\\(0,\\s*0,\\s*0,\\s*0\\)$/.test(s);\n const depth=n=>{let d=0;while(n.parentElement&&d<32){n=n.parentElement;d++;}return d;};\n for(const n of nodes){\n  const t=n.tagName.toLowerCase(),rect=n.getBoundingClientRect();\n  const s=getComputedStyle(n);\n  if(rect.width<4||rect.height<4||s.display==='none'||s.visibility==='hidden'||parseFloat(s.opacity)===0)continue;\n  const x=asNum(rect.left+scrollX),y=asNum(rect.top+scrollY),w=asNum(rect.width),h=asNum(rect.height);\n  if(x>6000||y>6000||x+w<0||y+h<0)continue;\n  const isTitle=/^h[123]$/.test(t);\n  if(isTitle&&titles.length<32){\n   titles.push({tag:t,x,y,w,h,text:String(n.textContent||'').trim().slice(0,100),\n    color:s.color,font_size:s.fontSize,font_weight:s.fontWeight,\n    white_space:s.whiteSpace,line_height:s.lineHeight,text_align:s.textAlign});\n  }\n  if(boxes.length>=max&&primitives.length>=smallMax)continue;\n  const p=n.parentElement,ps=p?getComputedStyle(p):null;\n  const colored=bg(s.backgroundColor);\n  const different=colored&&(!ps||s.backgroundColor!==ps.backgroundColor);\n  const curved=parseFloat(s.borderTopLeftRadius)>3;\n  const semantic=['body','aside','main','nav','section','article','header','footer'].includes(t);\n  const bordered=parseFloat(s.borderTopWidth)>0;\n  const shadowed=typeof s.boxShadow==='string'&&s.boxShadow!=='none';\n  const gradientPainted=typeof s.backgroundImage==='string'&&s.backgroundImage.startsWith('linear-gradient(');\n  if(t==='div'&&different&&primitives.length<smallMax&&w>=8&&h>=8&&\n     (w<80||h<36)&&w*h>=144&&w<=800&&h<=480){\n   primitives.push({x,y,w,h,background:s.backgroundColor,radius:s.borderTopLeftRadius});\n   continue;\n  }\n  if(!semantic&&!different&&!curved&&!bordered&&!shadowed&&!gradientPainted)continue;\n  if(boxes.length>=max||w<80||h<36)continue;\n  boxes.push({tag:t,depth:depth(n),x,y,w,h,\n   background:s.backgroundColor,border_color:s.borderTopColor,\n   border_width:s.borderTopWidth,radius:s.borderTopLeftRadius,box_shadow:s.boxShadow,\n   background_image:s.backgroundImage});\n }\n const body=getComputedStyle(document.body),root=getComputedStyle(document.documentElement);\n return {source:'p4-geometry',viewport:{width:innerWidth,height:innerHeight},\n   document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},\n   body_color:body.backgroundColor,root_color:root.backgroundColor,\n   candidates:nodes.length,boxes,titles,primitives};\n})()";
const clamp=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):0;
const palette=v=>typeof v==='string'&&v.length<=65&&/^(?:rgba?\([0-9.,\s%]+\)|#[0-9a-f]{3,8}|transparent)$/i.test(v)?v:'transparent';
const length=v=>typeof v==='string'&&/^(?:[0-9]{1,3}(?:\.[0-9]{1,2})?px|0px)$/.test(v)?v:'0px';

/** Strictly bounded single-layer, non-inset shadow from getComputedStyle.
 * CSS color and four pixel lengths only; no var(), URLs, filters, calc(),
 * nested commas/layers or browser-specific syntax from untrusted pages.
 * Computed Chrome colors are first in practice.
 */
const safeBoxShadow=v=>{
 if(typeof v!=='string'||v.length>110||v==='none')return null;
 const m=/^(rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0(?:\.\d{1,3})?|1(?:\.0{1,3})?))?\s*\)|#[0-9a-f]{3,8})\s+(-?\d{1,3}(?:\.\d{1,2})?px)\s+(-?\d{1,3}(?:\.\d{1,2})?px)\s+(\d{1,3}(?:\.\d{1,2})?px)\s+(-?\d{1,2}(?:\.\d{1,2})?px)$/i.exec(v.trim());
 if(!m)return null;
 const rgba=m[1].match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);
 if(rgba&&rgba.slice(1).some(c=>Number(c)>255))return null;
 const [x,y,blur,spread]=m.slice(2).map(Number.parseFloat);
 if(Math.abs(x)>64||Math.abs(y)>64||blur>80||Math.abs(spread)>32)return null;
 return m.slice(1).join(' ');
};
/** Strictly allow only a single two-RGB-stop gradient in computed CSS.
 * CSS functions with URLs, custom values, layers, alpha or injected statements
 * are not copied. Stored legacy geometry remains unchanged if field is absent.
 */
const safeLinearGradient=v=>{
 if(typeof v!=='string'||v.length>175)return null;
 const re=/^linear-gradient\(\s*(\d{1,3})deg\s*,\s*(rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))\s*(?:0%)?\s*,\s*(rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\))\s*(?:100%)?\s*\)$/i;
 const m=re.exec(v.trim());
 if(!m||Number(m[1])>360)return null;
 for(const color of [m[2],m[3]]){
  const channels=color.match(/\d+/g)?.map(Number)||[];
  if(channels.length!==3||channels.some(n=>n>255))return null;
 }
 return v.trim();
};
const headingWhiteSpace=v=>['normal','nowrap','pre-line'].includes(v)?v:null;
const headingTextAlign=v=>['start','end','left','right','center'].includes(v)?v:null;
const headingLineHeight=v=>typeof v==='string'&&
 (v==='normal'||/^(?:[0-9]{1,3}(?:\.[0-9]{1,2})?px|[1-3](?:\.[0-9]{1,2})?)$/.test(v))?v:null;
const titleText=v=>{
 if(typeof v!=='string')return '';
 return v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/https?:\/\/\S+/gi,'[URL]')
  .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[EMAIL]')
  .replace(/[A-Za-z0-9_-]{25,}/g,'[REDACTED]').slice(0,78).trim();
};
export function sanitizeP4Geometry(raw){
 if(!raw||raw.source!=='p4-geometry')return null;
 const w=clamp(raw.viewport?.width,320,4000),h=clamp(raw.document?.height,1,4000);
 const bounds={width:w,height:h};
 const boxes=(Array.isArray(raw.boxes)?raw.boxes:[]).slice(0,180).filter(v=>v&&
  ['body','div','header','nav','main','aside','section','article','footer'].includes(v.tag))
  .map(v=>({tag:v.tag,depth:clamp(v.depth,0,32),
    x:clamp(v.x,-100,4000),y:clamp(v.y,-100,4000),
    w:clamp(v.w,0,4000),h:clamp(v.h,0,4000),
    background:palette(v.background),border_color:palette(v.border_color),
    border_width:length(v.border_width),radius:length(v.radius),
    ...(safeBoxShadow(v.box_shadow)?{box_shadow:safeBoxShadow(v.box_shadow)}:{}),
    ...(safeLinearGradient(v.background_image)?{background_image:safeLinearGradient(v.background_image)}:{})}))
  .filter(v=>v.w>=80&&v.h>=36&&v.x<bounds.width&&v.y<bounds.height);
 const primitives=(Array.isArray(raw.primitives)?raw.primitives:[]).slice(0,48)
  .filter(v=>v&&!Array.isArray(v)&&['x','y','w','h'].every(k=>Number.isFinite(v[k]))&&
   typeof v.background==='string'&&Object.keys(v).every(k=>['x','y','w','h','background','radius'].includes(k)))
  .map(v=>({x:clamp(v.x,-100,4000),y:clamp(v.y,-100,4000),
   w:clamp(v.w,0,4000),h:clamp(v.h,0,4000),
   background:palette(v.background),radius:length(v.radius)}))
  .filter(v=>v.w>=8&&v.h>=8&&(v.w<80||v.h<36)&&v.w*v.h>=144&&
   v.w<=800&&v.h<=480&&v.x<bounds.width&&v.y<bounds.height&&
   v.background!=='transparent'&&!/^rgba?\\(0,\\s*0,\\s*0,\\s*0\\)$/.test(v.background));
 const titles=(Array.isArray(raw.titles)?raw.titles:[]).slice(0,32)
  .filter(v=>v&&['h1','h2','h3'].includes(v.tag))
  .map(v=>({tag:v.tag,x:clamp(v.x,-100,4000),y:clamp(v.y,-100,4000),
   w:clamp(v.w,0,4000),h:clamp(v.h,0,4000),text:titleText(v.text),
   color:palette(v.color),font_size:length(v.font_size),
   font_weight:typeof v.font_weight==='string'&&/^(?:normal|bold|[1-9]00)$/.test(v.font_weight)?v.font_weight:'normal',
   ...(headingWhiteSpace(v.white_space)?{white_space:headingWhiteSpace(v.white_space)}:{}),
   ...(headingLineHeight(v.line_height)?{line_height:headingLineHeight(v.line_height)}:{}),
   ...(headingTextAlign(v.text_align)?{text_align:headingTextAlign(v.text_align)}:{})}))
  .filter(v=>v.text&&v.x<bounds.width&&v.y<bounds.height);
 return {source:'p4-geometry',evidence_status:'static-html-css-only',
  viewport:{width:w,height:clamp(raw.viewport?.height,1,3000)},
  document:bounds,candidates:clamp(raw.candidates,0,1400),
  background:palette(raw.background)!=='transparent'?palette(raw.background):palette(raw.body_color)!=='transparent'?palette(raw.body_color):palette(raw.root_color),
  boxes,titles,...(primitives.length?{primitives}:{}),limitations:['Layout is reconstructed only from captured static geometry','No live backend data or original JavaScript','No interaction fidelity guarantee']};
}
const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function generateP4Reconstruction(raw){
 const data=sanitizeP4Geometry(raw);
 if(!data||data.boxes.length<1)throw Error('P4 geometry unavailable');
 const width=data.document.width,height=data.document.height;
 // Parents paint first, smaller descendants paint later. All CSS values are
 // sanitized. No user-supplied class names, URLs or executable scripts.
 const sorted=[...data.boxes].sort((a,b)=>a.depth-b.depth||b.w*b.h-a.w*a.h);
 const blocks=sorted.map((v,i)=>{
  const edge=parseFloat(v.border_width)>0?'border:1px solid '+v.border_color+';':'';
  const background=v.background==='transparent'?'':'background:'+v.background+';';
  const shadow=v.box_shadow?'box-shadow:'+v.box_shadow+';':'';
  const gradient=v.background_image?'background-image:'+v.background_image+';':'';
  return '<div class="region" aria-hidden="true" style="left:'+v.x+'px;top:'+v.y+'px;width:'+v.w+'px;height:'+v.h+
   'px;'+background+'border-radius:'+v.radius+';'+edge+shadow+gradient+'"></div>';
 }).join('\n');
 const primitiveBlocks=(data.primitives||[]).map(v=>'<div class="primitive" aria-hidden="true" style="left:'+
  v.x+'px;top:'+v.y+'px;width:'+v.w+'px;height:'+v.h+'px;background:'+v.background+
  ';border-radius:'+v.radius+';"></div>').join('\n');
 const labels=data.titles.map(t=>{
  const measured=(t.white_space?'white-space:'+t.white_space+';':'')+
   (t.line_height?'line-height:'+t.line_height+';':'')+
   (t.text_align?'text-align:'+t.text_align+';':'');
  return '<div class="label" style="left:'+t.x+'px;top:'+t.y+'px;width:'+t.w+'px;height:'+t.h+
   'px;color:'+t.color+';font-size:'+t.font_size+';font-weight:'+t.font_weight+';'+measured+'">'+
   escapeHtml(t.text)+'</div>';
 }).join('\n');
 const css='html,body{margin:0;padding:0}body{background:'+data.background+
  ';font-family:Arial,system-ui,sans-serif}.page{width:'+width+'px;height:'+height+
  'px;position:relative;overflow:hidden}.region,.label'+(data.primitives?.length?',.primitive':'')+'{box-sizing:border-box;position:absolute}'+
  '.label{overflow:hidden;white-space:nowrap;line-height:1.45}.notice{position:fixed;right:14px;bottom:14px;'+
  'z-index:10000;background:#131b2b;color:white;padding:10px 14px;border-radius:9px;font:12px system-ui;'+
  'box-shadow:0 1px 8px #0004}';
 const csp="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta http-equiv="Content-Security-Policy" content="'+escapeHtml(csp)+'">'+
  '<title>Web REA Studio · 독립형 레이아웃 청사진</title><style>'+css+'</style></head><body>'+
  '<main class="page" aria-label="증거 기반 UI 구조 미리보기">'+blocks+primitiveBlocks+labels+'</main>'+
  '<div class="notice">Web REA Studio · 구조 기반 재구성 · 실제 데이터/동작 없음</div></body></html>';
}
,'i');
 const matched=re.exec(v.trim());
 if(!matched||Number(matched[1])>360)return null;
 for(const color of [matched[2],matched[3]]){
  const channels=color.match(/\\d+/g)?.map(Number)||[];
  if(channels.length!==3||channels.some(x=>x>255))return null;
 }
 return v.trim();
};
// New optional heading properties preserve byte-for-byte legacy output when
// missing. Chrome-computed CSS is treated as untrusted until allowlisted.
const headingWhiteSpace=v=>['normal','nowrap','pre-line'].includes(v)?v:null;
const headingTextAlign=v=>['start','end','left','right','center'].includes(v)?v:null;
const headingLineHeight=v=>typeof v==='string'&&
 (v==='normal'||/^(?:[0-9]{1,3}(?:\.[0-9]{1,2})?px|[1-3](?:\.[0-9]{1,2})?)$/.test(v))?v:null;
const titleText=v=>{
 if(typeof v!=='string')return '';
 return v.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/https?:\/\/\S+/gi,'[URL]')
  .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[EMAIL]')
  .replace(/[A-Za-z0-9_-]{25,}/g,'[REDACTED]').slice(0,78).trim();
};
export function sanitizeP4Geometry(raw){
 if(!raw||raw.source!=='p4-geometry')return null;
 const w=clamp(raw.viewport?.width,320,4000),h=clamp(raw.document?.height,1,4000);
 const bounds={width:w,height:h};
 const boxes=(Array.isArray(raw.boxes)?raw.boxes:[]).slice(0,180).filter(v=>v&&
  ['body','div','header','nav','main','aside','section','article','footer'].includes(v.tag))
  .map(v=>({tag:v.tag,depth:clamp(v.depth,0,32),
    x:clamp(v.x,-100,4000),y:clamp(v.y,-100,4000),
    w:clamp(v.w,0,4000),h:clamp(v.h,0,4000),
    background:palette(v.background),border_color:palette(v.border_color),
    border_width:length(v.border_width),radius:length(v.radius),
    ...(safeBoxShadow(v.box_shadow)?{box_shadow:safeBoxShadow(v.box_shadow)}:{})}))
  .filter(v=>v.w>=80&&v.h>=36&&v.x<bounds.width&&v.y<bounds.height);
 const primitives=(Array.isArray(raw.primitives)?raw.primitives:[]).slice(0,48)
  .filter(v=>v&&!Array.isArray(v)&&['x','y','w','h'].every(k=>Number.isFinite(v[k]))&&
   typeof v.background==='string'&&Object.keys(v).every(k=>['x','y','w','h','background','radius'].includes(k)))
  .map(v=>({x:clamp(v.x,-100,4000),y:clamp(v.y,-100,4000),
   w:clamp(v.w,0,4000),h:clamp(v.h,0,4000),
   background:palette(v.background),radius:length(v.radius)}))
  .filter(v=>v.w>=8&&v.h>=8&&(v.w<80||v.h<36)&&v.w*v.h>=144&&
   v.w<=800&&v.h<=480&&v.x<bounds.width&&v.y<bounds.height&&
   v.background!=='transparent'&&!/^rgba?\\(0,\\s*0,\\s*0,\\s*0\\)$/.test(v.background));
 const titles=(Array.isArray(raw.titles)?raw.titles:[]).slice(0,32)
  .filter(v=>v&&['h1','h2','h3'].includes(v.tag))
  .map(v=>({tag:v.tag,x:clamp(v.x,-100,4000),y:clamp(v.y,-100,4000),
   w:clamp(v.w,0,4000),h:clamp(v.h,0,4000),text:titleText(v.text),
   color:palette(v.color),font_size:length(v.font_size),
   font_weight:typeof v.font_weight==='string'&&/^(?:normal|bold|[1-9]00)$/.test(v.font_weight)?v.font_weight:'normal',
   ...(headingWhiteSpace(v.white_space)?{white_space:headingWhiteSpace(v.white_space)}:{}),
   ...(headingLineHeight(v.line_height)?{line_height:headingLineHeight(v.line_height)}:{}),
   ...(headingTextAlign(v.text_align)?{text_align:headingTextAlign(v.text_align)}:{})}))
  .filter(v=>v.text&&v.x<bounds.width&&v.y<bounds.height);
 return {source:'p4-geometry',evidence_status:'static-html-css-only',
  viewport:{width:w,height:clamp(raw.viewport?.height,1,3000)},
  document:bounds,candidates:clamp(raw.candidates,0,1400),
  background:palette(raw.background)!=='transparent'?palette(raw.background):palette(raw.body_color)!=='transparent'?palette(raw.body_color):palette(raw.root_color),
  boxes,titles,...(primitives.length?{primitives}:{}),limitations:['Layout is reconstructed only from captured static geometry','No live backend data or original JavaScript','No interaction fidelity guarantee']};
}
const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
export function generateP4Reconstruction(raw){
 const data=sanitizeP4Geometry(raw);
 if(!data||data.boxes.length<1)throw Error('P4 geometry unavailable');
 const width=data.document.width,height=data.document.height;
 // Parents paint first, smaller descendants paint later. All CSS values are
 // sanitized. No user-supplied class names, URLs or executable scripts.
 const sorted=[...data.boxes].sort((a,b)=>a.depth-b.depth||b.w*b.h-a.w*a.h);
 const blocks=sorted.map((v,i)=>{
  const edge=parseFloat(v.border_width)>0?'border:1px solid '+v.border_color+';':'';
  const background=v.background==='transparent'?'':'background:'+v.background+';';
  const shadow=v.box_shadow?'box-shadow:'+v.box_shadow+';':'';
  return '<div class="region" aria-hidden="true" style="left:'+v.x+'px;top:'+v.y+'px;width:'+v.w+'px;height:'+v.h+
   'px;'+background+'border-radius:'+v.radius+';'+edge+shadow+'"></div>';
 }).join('\n');
 const primitiveBlocks=(data.primitives||[]).map(v=>'<div class="primitive" aria-hidden="true" style="left:'+
  v.x+'px;top:'+v.y+'px;width:'+v.w+'px;height:'+v.h+'px;background:'+v.background+
  ';border-radius:'+v.radius+';"></div>').join('\n');
 const labels=data.titles.map(t=>{
  const measured=(t.white_space?'white-space:'+t.white_space+';':'')+
   (t.line_height?'line-height:'+t.line_height+';':'')+
   (t.text_align?'text-align:'+t.text_align+';':'');
  return '<div class="label" style="left:'+t.x+'px;top:'+t.y+'px;width:'+t.w+'px;height:'+t.h+
   'px;color:'+t.color+';font-size:'+t.font_size+';font-weight:'+t.font_weight+';'+measured+'">'+
   escapeHtml(t.text)+'</div>';
 }).join('\n');
 const css='html,body{margin:0;padding:0}body{background:'+data.background+
  ';font-family:Arial,system-ui,sans-serif}.page{width:'+width+'px;height:'+height+
  'px;position:relative;overflow:hidden}.region,.label'+(data.primitives?.length?',.primitive':'')+'{box-sizing:border-box;position:absolute}'+
  '.label{overflow:hidden;white-space:nowrap;line-height:1.45}.notice{position:fixed;right:14px;bottom:14px;'+
  'z-index:10000;background:#131b2b;color:white;padding:10px 14px;border-radius:9px;font:12px system-ui;'+
  'box-shadow:0 1px 8px #0004}';
 const csp="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta http-equiv="Content-Security-Policy" content="'+escapeHtml(csp)+'">'+
  '<title>Web REA Studio · 독립형 레이아웃 청사진</title><style>'+css+'</style></head><body>'+
  '<main class="page" aria-label="증거 기반 UI 구조 미리보기">'+blocks+primitiveBlocks+labels+'</main>'+
  '<div class="notice">Web REA Studio · 구조 기반 재구성 · 실제 데이터/동작 없음</div></body></html>';
}
