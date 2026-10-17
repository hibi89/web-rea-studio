// Fixed read-only layout measurement for in-memory anonymous geometry previews.
// Never applies to live targets; never reads original site content or URLs.
export const ANONYMOUS_LAYOUT_PROBE=String.raw`(()=>{
 const el=document.querySelector('.zones');
 const cells=Array.from(document.querySelectorAll('.zones > .zone'));
 const count=()=>document.querySelectorAll('button,a[href],input,textarea,select,form,[role="button"],[role="link"],[role="tab"]').length;
 const rect=n=>{
  if(!n)return null;
  const r=n.getBoundingClientRect();
  return [r.left,r.top,r.width,r.height].map(x=>Number.isFinite(x)?Math.round(x):null);
 };
 const root=document.documentElement,body=document.body;
 const style=el?getComputedStyle(el):null;
 return {kind:'anonymous-offline-grid-only',viewport:innerWidth,
  document_scroll_width:Math.max(root.scrollWidth,body.scrollWidth),
  document_client_width:root.clientWidth,grid_columns:style?style.gridTemplateColumns:'',
  grid:rect(el),zones:cells.slice(0,10).map(rect),zone_count:cells.length,
  native_controls:count()};
})()`;
const integer=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=hi*2?
 Math.max(lo,Math.min(hi,Math.round(n))):null;
const rect=a=>Array.isArray(a)&&a.length===4?
 a.map((x,i)=>integer(x,i<2?-10000:0,10000)):null;
export function sanitizeAnonymousLayoutProbe(raw){
 if(raw?.kind!=='anonymous-offline-grid-only'||typeof raw.grid_columns!=='string'||
  raw.grid_columns.length>180||!Array.isArray(raw.zones)||raw.zones.length>10)
  return null;
 const zones=raw.zones.map(rect);
 if(zones.some(x=>!x||x.some(v=>v===null)))return null;
 const grid=rect(raw.grid);
 if(!grid||grid.some(x=>x===null))return null;
 const cols=raw.grid_columns.trim().split(/\s+/).filter(Boolean);
 if(!cols.length||cols.length>9||cols.some(x=>!/^\d+(?:\.\d+)?px$/.test(x)))return null;
 const values={
  viewport:integer(raw.viewport,0,4000),
  document_scroll_width:integer(raw.document_scroll_width,0,10000),
  document_client_width:integer(raw.document_client_width,0,4000),
  computed_grid_columns:cols.length,
  grid,zones,zone_count:integer(raw.zone_count,0,100),
  native_controls:integer(raw.native_controls,0,100)
 };
 return Object.values(values).some(v=>v===null)?null:values;
}
const close=(a,b)=>Math.abs(a-b)<=2;
// This proves generated HTML layout only; it never proves source/mobile parity.
// Keep full measured pixel coordinates internal and return only bounded metrics.
export function assessAnonymousLayout({measurement,viewport}={}){
 const blocked=reason=>({status:'BLOCKED',reason,layout_verified:false,
  original_site_layout_verified:false,source_mobile_layout_verified:false,
  external_requests_verified_by_layout_probe:false});
 if(!measurement||!viewport||!Number.isInteger(viewport.width)||
  !Number.isInteger(viewport.height)||viewport.width<360||viewport.width>1440||
  viewport.height<400||viewport.height>900)
  return blocked('MEASUREMENT_OR_VIEWPORT_MISSING');
 const v=measurement,expectedCols=viewport.width<=640?1:3;
 if(v.viewport!==viewport.width||v.document_client_width!==viewport.width||
  v.zone_count!==9||v.zones.length!==9||v.native_controls!==0)
  return blocked('UNEXPECTED_DOCUMENT_PROVENANCE_OR_CONTROLS');
 if(v.document_scroll_width>viewport.width+1)
  return blocked('HORIZONTAL_DOCUMENT_OVERFLOW');
 if(v.computed_grid_columns!==expectedCols)
  return blocked('COMPUTED_GRID_COLUMNS_MISMATCH');
 if(!v.grid||v.grid[2]<200||v.grid[0]<-1||
  v.grid[0]+v.grid[2]>viewport.width+1)
  return blocked('GRID_BOUNDARY_OVERFLOW');
 for(let i=0;i<9;i++){
  const b=v.zones[i];
  if(!b||b[2]<=0||b[3]<40||b[0]<-1||
   b[0]+b[2]>viewport.width+1||b[1]<0)
   return blocked('ZONE_BOUNDARY_OR_SIZE_INVALID');
  if(i===0)continue;
  const previous=v.zones[i-1];
  if(expectedCols===3){
   if(i%3===0){
    if(b[1]<=previous[1]+2||b[0]>previous[0]+2)
     return blocked('DESKTOP_ROW_MAJOR_ORDER_MISMATCH');
   }else if(!close(b[1],previous[1])||b[0]<=previous[0]+2)
    return blocked('DESKTOP_COLUMN_ORDER_MISMATCH');
  }else if(b[1]<=previous[1]+2||!close(b[0],previous[0]))
   return blocked('MOBILE_STACK_ORDER_MISMATCH');
 }
 return {status:'PASS_GENERATED_OFFLINE_LAYOUT',layout_verified:true,
  measured_viewport_width:viewport.width,computed_columns:v.computed_grid_columns,
  checked_zones:9,horizontal_overflow:false,native_controls:0,
  generated_layout_scope:'synthetic-anonymous-html-only',
  original_site_layout_verified:false,source_mobile_layout_verified:false,
  external_requests_verified_by_layout_probe:false};
}
