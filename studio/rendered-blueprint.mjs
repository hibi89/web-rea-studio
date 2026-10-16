// Read-only layout snapshot evaluated inside an already scoped Chrome page.
export const LAYOUT_PROBE="(()=>{\n const tags='header,nav,main,aside,section,article,footer,h1,h2,h3,button,canvas,svg,table,[role=\"button\"],[role=\"table\"]';\n const list=[...document.querySelectorAll(tags)].slice(0,180);\n const parts=[];\n const rounded=n=>Number.isFinite(n)?Math.max(-10000,Math.min(10000,Math.round(n))):0;\n for(const node of list){\n  if(parts.length>=64)break;\n  const rect=node.getBoundingClientRect(),style=getComputedStyle(node);\n  if(rect.width<=0||rect.height<=0||style.display==='none'||style.visibility==='hidden')continue;\n  parts.push({tag:node.tagName.toLowerCase(),role:node.getAttribute('role'),\n    rect:{x:rounded(rect.x),y:rounded(rect.y),w:rounded(rect.width),h:rounded(rect.height)},\n    style:{display:style.display,font_size:style.fontSize,color:style.color,\n     background:style.backgroundColor,border_radius:style.borderRadius}});\n }\n return {source:'computed-dom',viewport:{w:rounded(innerWidth),h:rounded(innerHeight)},\n  candidates:list.length,components:parts,\n  canvas_count:document.querySelectorAll('canvas').length,\n  svg_count:document.querySelectorAll('svg').length};\n})()";
const bounded=(n,min=-10000,max=10000)=>typeof n==='number'&&Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):0;
const color=v=>typeof v==='string'&&v.length<=60&&/^(?:rgba?\([0-9.,\s%]+\)|#[0-9a-f]{3,8}|transparent)$/i.test(v)?v:'';
export function sanitizeRenderedLayout(raw){
 if(!raw||typeof raw!=='object')return null;
 const tags=['header','nav','main','aside','section','article','footer','h1','h2','h3','button','canvas','svg','table'];
 const components=(Array.isArray(raw.components)?raw.components:[]).slice(0,64)
  .filter(x=>x&&tags.includes(x.tag))
  .map(x=>({
   tag:x.tag,role:['button','table'].includes(x.role)?x.role:null,
   rect:{x:bounded(x.rect?.x),y:bounded(x.rect?.y),w:bounded(x.rect?.w,0),h:bounded(x.rect?.h,0)},
   style:{
    display:typeof x.style?.display==='string'&&/^[a-z-]{1,24}$/.test(x.style.display)?x.style.display:'',
    font_size:typeof x.style?.font_size==='string'&&/^[0-9.]{1,8}px$/.test(x.style.font_size)?x.style.font_size:'',
    color:color(x.style?.color),background:color(x.style?.background),
    border_radius:typeof x.style?.border_radius==='string'&&/^[0-9.%px\s]{1,40}$/.test(x.style.border_radius)?x.style.border_radius:''
   }}));
 return {source:'computed-dom',viewport:{w:bounded(raw.viewport?.w,0),h:bounded(raw.viewport?.h,0)},
  candidates:bounded(raw.candidates,0,180),components,
  canvas_count:bounded(raw.canvas_count,0),svg_count:bounded(raw.svg_count,0)};
}
