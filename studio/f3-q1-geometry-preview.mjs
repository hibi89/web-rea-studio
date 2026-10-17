// Coarse 3x3 offline presence zones. Not a source-layout or behavior replica.
// Requires independently stored passive controls, viewport and screenshot sizes.
import {createHash} from 'node:crypto';
import {buildPassiveWireframe,PASSIVE_WIREFRAME_CSP} from './f3-q1-wireframe.mjs';

const NAMES=Object.freeze({button:'Button',link:'Link',tab:'Tab',select:'Select',
 textarea:'Text-area',input:'Input',interactive:'Interactive',unknown:'Unknown'});
const safeInt=(n,a,b)=>Number.isSafeInteger(n)&&n>=a&&n<=b;
const refuse=(reason)=>({status:'BLOCKED',html:null,receipt:{
 schema_version:1,kind:'rea-f3-q1-coarse-geometry-receipt',status:'BLOCKED',
 reason,sha256:null,bytes:0,source_parity_verified:false,
 permission_status:'NOT_APPROVED',external_requests_issued:0,
 actionable_controls:0,geometry_reproduced:false}});
const css="*{box-sizing:border-box}html,body{margin:0;min-height:100%;font:14px system-ui,Arial,sans-serif;color:#192941;background:#f2f5fa;overflow-x:hidden}"+
 "main{max-width:1060px;margin:auto;padding:20px;min-width:0}header{background:#20344f;color:white;padding:20px;border-radius:12px}"+
 "h1{font-size:22px;margin:0}p{line-height:1.5}header p{color:#d9e2ed;font-size:13px;margin:9px 0 0}"+
 ".zones{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px;min-width:0}"+
 ".zone{border:1px solid #cbd6e5;background:#fff;border-radius:10px;padding:12px;min-width:0;min-height:110px}"+
 "h2{font-size:13px;color:#617088;margin:0 0 12px}"+
 ".token{padding:10px;margin:8px 0;min-width:0;max-width:100%;border:1px dashed #8ea1b8;border-radius:7px;background:#f7f9fd;pointer-events:none}"+
 ".glyph{display:block;width:24px;height:8px;border-radius:9px;background:#bac9df;margin-bottom:5px}"+
 ".token span{display:block;font-size:12px;color:#34445b;overflow-wrap:anywhere}"+
 ".size-narrow{width:45%}.size-medium{width:70%}.size-wide{width:100%}"+
 ".notice{padding:14px;margin-top:16px;background:#e7edf5;border-left:4px solid #899bb6;font-size:13px}"+
 "@media(max-width:640px){main{padding:12px}header{padding:16px}h1{font-size:19px}"+
 ".zones{grid-template-columns:minmax(0,1fr)}.zone{min-height:60px}.token{max-width:100%}}";
function render(zones,counts){
 const cells=zones.map((members,i)=>{
  const elements=members.map(({cat,size},k)=>'<div class="token size-'+size+
   '" aria-hidden="true"><i class="glyph"></i><span>'+NAMES[cat]+
   ' outline '+(k+1)+'</span></div>').join('');
  return '<section class="zone"><h2>Zone '+(i+1)+'</h2>'+elements+'</section>';
 }).join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
 '<meta name="viewport" content="width=device-width, initial-scale=1">'+
 '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; img-src &#39;none&#39;; font-src &#39;none&#39;; frame-src &#39;none&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;">'+
 '<title>REA Coarse Presence Zones — NOT A REPLICA</title><style>'+css+'</style></head>'+
 '<body><main><header><h1>Anonymous coarse presence zones</h1>'+
 '<p>3-by-3 bins of previously observed elements. No source positions, names, actions, data, or layout parity.</p>'+
 '<p>'+counts+' noninteractive placeholders</p></header><div class="zones">'+cells+'</div>'+
 '<aside class="notice">Offline sample only. Desktop zones adapt into a mobile stack. No original responsive-layout observations or original-site equivalence.</aside>'+
 '</main></body></html>';
}
export function buildAnonymousGeometryPreview({mode,inspection,report,diagnosis}={}){
 if(mode!=='dynamic-passive'||inspection?.mode!=='dynamic-passive'||
    (report?.analysis_mode!==undefined&&report.analysis_mode!=='dynamic-passive'))
  throw Error('F3_Q1_GEOMETRY_SCOPE_DENIED');
 const base=buildPassiveWireframe({mode,inspection,report,diagnosis});
 if(base.status!=='OFFLINE_NONINTERACTIVE_PREVIEW')return refuse('F3_Q1_WORK_PLAN_BLOCKED');
 const v=inspection.page?.frontend_blueprint;
 const sc=inspection.screen_capture;
 const cw=inspection.page?.interaction_inventory;
 if(v?.source!=='computed-dom'||!safeInt(v.viewport?.w,360,2000)||
  !safeInt(v.viewport?.h,400,1200)||!safeInt(sc?.width,360,2000)||
  sc.width!==v.viewport.w||!safeInt(sc?.height,400,5000)||
  sc.height<v.viewport.h||!safeInt(report?.screenshot_width,360,2000)||
  report.screenshot_width!==sc.width||report?.screenshot_height!==sc.height)
  return refuse('SAVED_VIEWPORT_SCREENSHOT_MISMATCH');
 const w=v.viewport.w,h=v.viewport.h;
 if(cw?.source!=='passive-controls'||cw.verification!=='presence-only'||
  cw.actions_executed!==0||!Array.isArray(cw.controls)||
  !safeInt(cw.counts?.total,1,48)||cw.controls.length!==cw.counts.total||
  base.receipt.observed_controls!==cw.counts.total)
  return refuse('PASSIVE_CONTROL_PROVENANCE_OR_COUNT_MISSING');
 const allowed=new Set(base.receipt.categories.map(x=>x.category));
 const seen=new Map(),zones=Array.from({length:9},()=>[]);
 for(const control of cw.controls){
  const cat=control?.kind;
  const r=control?.rect;
  if(!Object.hasOwn(NAMES,cat)||!allowed.has(cat)||
   !safeInt(r?.x,0,w-2)||!safeInt(r?.y,0,h-2)||
   !safeInt(r?.width,2,w)||!safeInt(r?.height,2,h)||
   r.x+r.width>w||r.y+r.height>h)
   return refuse('UNBOUNDED_OR_UNVERIFIED_PASSIVE_RECTANGLE');
  const column=Math.min(2,Math.floor((r.x+r.width/2)*3/w));
  const row=Math.min(2,Math.floor((r.y+r.height/2)*3/h));
  const ratio=r.width/w;
  const size=ratio<0.16?'narrow':ratio<0.36?'medium':'wide';
  zones[row*3+column].push({cat,size});
  seen.set(cat,(seen.get(cat)||0)+1);
 }
 if(base.receipt.categories.some(x=>seen.get(x.category)!==x.count))
  return refuse('F3_Q1_CATEGORY_RECTANGLE_CONFLICT');
 const html=render(zones,cw.controls.length);
 const distribution=zones.map((zone,i)=>({zone:i+1,count:zone.length}));
 const receipt={
  schema_version:1,kind:'rea-f3-q1-coarse-geometry-receipt',
  status:'OFFLINE_COARSE_GEOMETRY_PREVIEW',
  scope:'saved-passive-geometry-and-viewport-only',
  sha256:createHash('sha256').update(html).digest('hex'),
  bytes:Buffer.byteLength(html,'utf8'),observed_controls:cw.controls.length,
  coarse_distribution:distribution,
  geometry_source:'passive-controls-plus-viewport-plus-screenshot-consistency',
  geometry_precision:'3x3-bins-only-no-pixel-coordinates',
  mobile_layout:'synthetic-stacked-adaptation-not-original-responsive-evidence',
  original_visual_parity_verified:false,original_mobile_behavior_verified:false,
  original_data_or_api_recovered:false,source_parity_verified:false,
  permission_status:'NOT_APPROVED',network_decision:'BLOCK_NETWORK_EXPANSION',
  actionable_controls:0,scripts_included:false,forms_included:false,
  source_text_or_urls_included:false,source_coordinates_included:false,
  new_original_site_requests:0,chrome_capture_performed_on_get:false,
  real_chrome_verified_by_receipt:false,product_ready:false
 };
 return {status:receipt.status,html,receipt};
}
export {PASSIVE_WIREFRAME_CSP as COARSE_GEOMETRY_CSP};
