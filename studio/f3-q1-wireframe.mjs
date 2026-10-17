// Offline anonymized UI wireframe from one saved passive F3/Q1 work plan.
// This is NOT source HTML, functional reconstruction, UI layout parity or consent.
import {createHash} from 'node:crypto';
import {planF3Q1Work} from './f3-q1-work-plan.mjs';

export const PASSIVE_WIREFRAME_CSP=
 "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; "+
 "connect-src 'none'; img-src 'none'; font-src 'none'; media-src 'none'; "+
 "frame-src 'none'; object-src 'none'; form-action 'none'; "+
 "base-uri 'none'; navigate-to 'none'; sandbox";

const categories=new Set(['button','link','tab','select','textarea','input','interactive','unknown']);
const allowedPlans=new Set(['PLANNABLE_OFFLINE_ONLY','BLOCKED','REVIEW_REQUIRED']);
const categoryTitle={
 button:'Button outline',link:'Link outline',tab:'Tab outline',
 select:'Select outline',textarea:'Text-area outline',input:'Input outline',
 interactive:'Interactive outline',unknown:'Unclassified outline'
};
const safeCount=v=>Number.isSafeInteger(v)&&v>=0&&v<=100?v:null;
const sha256=html=>createHash('sha256').update(html,'utf8').digest('hex');

// HTML is fixed-format, with *only* literal allowed categories and integer counts.
// No source URL/text/coordinates, input values, scripts, links or even live controls.
function markup(groups){
 const sections=groups.map(({category,count})=>{
  const displayed=Math.min(count,12);
  const samples=Array.from({length:displayed},(_,i)=>
   '<div class="placeholder" aria-hidden="true"><span class="shape"></span><span class="hintbar"></span></div>').join('');
  return '<section class="group"><div class="group-heading"><h2>'+categoryTitle[category]+
   '</h2><span class="count">'+count+' observed</span></div>'+
   '<p>Anonymous category reference only. No original labels or action handlers.</p>'+
   '<div class="samples">'+samples+'</div>'+
   (count>12?'<p>Showing 12 of '+count+' generic outlines.</p>':'')+'</section>';
 }).join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width, initial-scale=1">'+
  '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; connect-src &#39;none&#39;; img-src &#39;none&#39;; font-src &#39;none&#39;; frame-src &#39;none&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;">'+
  '<title>REA Offline Presence Outline — NOT A REPLICA</title>'+
  '<style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#f4f6fa;color:#182235;font-family:system-ui,Arial,sans-serif}'+
  'main{max-width:970px;margin:0 auto;padding:36px 22px 56px}header{padding:20px 24px;background:#172841;color:#fff;border-radius:16px}'+
  'header p{color:#d3dded;margin:8px 0 0;line-height:1.6}h1{font-size:24px;margin:0}'+
  '.group{background:#fff;border:1px solid #dbe2ee;border-radius:14px;padding:18px 20px;margin-top:18px}'+
  '.group-heading{display:flex;gap:10px;justify-content:space-between;align-items:center}h2{font-size:18px;margin:0}'+
  '.count{font-size:13px;color:#3b4e68}.group p{font-size:13px;color:#5b6980;line-height:1.6}'+
  '.samples{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:16px}'+
  '.placeholder{display:flex;align-items:center;gap:10px;height:48px;padding:12px;border:1px dashed #93a3b9;border-radius:9px;'+
  'background:#f9fbff;user-select:none;pointer-events:none}.shape{width:16px;height:16px;border-radius:4px;background:#b0bfd4;flex:none}'+
  '.hintbar{width:65%;height:8px;border-radius:20px;background:#d5deeb}.notice{font-size:13px;line-height:1.6;color:#4b5a71;'+
  'margin-top:22px;padding:14px 18px;border-left:4px solid #8094b0;background:#ebf0f7}</style>'+
  '</head><body><main><header><h1>Offline presence outline — not a replica</h1>'+
  '<p>Derived solely from passive category counts. No source layout, labels, data, actions or original behavior.</p>'+
  '</header>'+sections+
  '<aside class="notice">Noninteractive, offline synthetic placeholder. Real website reconstruction, network access and functional parity remain blocked.</aside>'+
  '</main></body></html>';
}
export function buildPassiveWireframe({mode,inspection,report,diagnosis}={}){
 if(mode!=='dynamic-passive'||inspection?.mode!=='dynamic-passive'||
  (report?.analysis_mode!==undefined&&report.analysis_mode!=='dynamic-passive'))
  throw Error('F3_WIREFRAME_SCOPE_DENIED');
 const plan=planF3Q1Work({mode,inspection,report,diagnosis});
 const refusal={schema_version:1,kind:'rea-f3-q1-anonymous-wireframe-receipt',
  provenance:'same-saved-passive-run-only',source_site_parity:false,
  original_source_html_recovered:false,actions_executed:0,
  external_requests_issued:0,original_api_or_data_recovered:false,
  permission_status:'NOT_APPROVED',network_decision:'BLOCK_NETWORK_EXPANSION',
  privacy:{source_urls_included:false,labels_included:false,
   form_values_included:false,credentials_included:false,response_bodies_included:false},
  csp:'scripts-forms-navigation-network-denied',safety:'no-native-interactive-elements'};
 if(plan.status!=='UI_PRESENCE_PLANNING_ONLY'||plan.next_step!=='OUTLINE_NONINTERACTIVE_UI_CATEGORIES_ONLY'){
  return {status:'BLOCKED',html:null,receipt:{...refusal,status:'BLOCKED',
   reason:'F3_Q1_EVIDENCE_NOT_SUITABLE_FOR_OFFLINE_WIREFRAME',sha256:null,bytes:0,
   categories:[],observed_controls:0}};
 }
 const groups=[],ids=new Set();
 for(const item of plan.items){
  if(!allowedPlans.has(item.status))
   return {status:'BLOCKED',html:null,receipt:{...refusal,status:'BLOCKED',
    reason:'INVALID_PLAN_STATUS',sha256:null,bytes:0,categories:[],observed_controls:0}};
  if(item.area!=='ui-presence'||item.status!=='PLANNABLE_OFFLINE_ONLY')continue;
  const category=item.id.startsWith('presence-plan-')?item.id.slice(14):'';
  const count=safeCount(item.observed_controls);
  if(!categories.has(category)||ids.has(category)||!count||groups.length>=8){
   return {status:'BLOCKED',html:null,receipt:{...refusal,status:'BLOCKED',
    reason:'INVALID_OBSERVED_CATEGORY_COUNTS',sha256:null,bytes:0,categories:[],observed_controls:0}};
  }
  ids.add(category);groups.push({category,count});
 }
 const count=groups.reduce((n,g)=>n+g.count,0);
 if(groups.length!==plan.counts.plannable_offline||count!==plan.items
  .filter(x=>x.area==='ui-presence'&&x.status==='PLANNABLE_OFFLINE_ONLY')
  .reduce((n,x)=>n+x.observed_controls,0)||count===0||count>100)
  return {status:'BLOCKED',html:null,receipt:{...refusal,status:'BLOCKED',
   reason:'CATEGORY_EVIDENCE_MISMATCH',sha256:null,bytes:0,categories:[],observed_controls:0}};
 const html=markup(groups);
 const receipt={...refusal,status:'OFFLINE_NONINTERACTIVE_PREVIEW',
  sha256:sha256(html),bytes:Buffer.byteLength(html,'utf8'),
  categories:groups,observed_controls:count,
  original_site_look_and_feel_verified:false,chrome_render_verified_by_this_receipt:false,
  scripts_included:false,forms_included:false,active_controls_included:false};
 return {status:'OFFLINE_NONINTERACTIVE_PREVIEW',html,receipt};
}
