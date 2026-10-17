import {sanitizeP4Geometry,generateP4Reconstruction} from './p4-reconstruction.mjs';
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const num=(n,max)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.round(n))):0;
const label=s=>typeof s==='string'?s.replace(/https?:\/\/\S+/gi,'[URL]').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[EMAIL]').replace(/[A-Za-z0-9_-]{20,}/g,'[REDACTED]').replace(/[<>]/g,'').slice(0,64):'';
const kinds=['button','link','tab','input','select','textarea','interactive'];
export function buildObservedControlContract(geometry,inventory){
 const g=sanitizeP4Geometry(geometry);
 if(!g?.boxes?.length||inventory?.source!=='passive-controls'||inventory.verification!=='presence-only'||inventory.actions_executed!==0||!Array.isArray(inventory.controls))return null;
 const controls=[];const seen=new Set();
 for(const c of inventory.controls.slice(0,100)){
  if(controls.length>=60)break;
  if(!c||!kinds.includes(c.kind)||!/^control-\d{3}$/.test(c.id||'')||seen.has(c.id))continue;
  const r=c.rect||{};const x=num(r.x,g.document.width),y=num(r.y,g.document.height);
  const w=num(r.width,g.document.width),h=num(r.height,g.document.height);
  if(!w||!h||x>=g.document.width||y>=g.document.height)continue;
  seen.add(c.id);
  controls.push({id:c.id,kind:c.kind,
   label:['button','link','tab'].includes(c.kind)?label(c.label):'',
   x,y,width:Math.min(w,g.document.width-x),height:Math.min(h,g.document.height-y),
   evidence:'visible-only',behavior:'unverified',enabled:false});
 }
 return {source:'read-only-control-map',scope:'static-visual',version:1,
  behavior_verified:false,actions_executed:0,
  page:{width:g.document.width,height:g.document.height},
  total:controls.length,controls};
}
export function generateObservedControlMapHtml(geometry,contract){
 const g=sanitizeP4Geometry(geometry);
 if(!g?.boxes?.length||contract?.source!=='read-only-control-map'||contract.scope!=='static-visual'||
  contract.behavior_verified!==false||contract.actions_executed!==0||
  !Array.isArray(contract.controls)||contract.controls.length>60)throw Error('CONTROL_MAP_EVIDENCE_UNAVAILABLE');
 let overlay='<div class="map-note">관찰된 요소 위치 · 동작 미검증</div>';
 for(const c of contract.controls){
  if(!/^control-\d{3}$/.test(c.id||'')||!kinds.includes(c.kind)||c.enabled!==false)continue;
  const x=num(c.x,g.document.width),y=num(c.y,g.document.height);
  if(x>=g.document.width||y>=g.document.height)continue;
  const w=num(c.width,g.document.width-x),h=num(c.height,g.document.height-y);
  if(!w||!h)continue;
  const name=['input','textarea','select'].includes(c.kind)?'입력 위치':label(c.label)||c.kind;
  overlay+='<button type="button" disabled class="mapped" data-id="'+c.id+
   '" style="left:'+x+'px;top:'+y+'px;width:'+w+'px;height:'+h+'px">'+esc(name)+'</button>';
 }
 const style='.mapped{position:absolute!important;z-index:500;border:2px dashed #8b5cf6!important;background:rgba(139,92,246,.1)!important;font:600 11px Arial!important;pointer-events:none!important;overflow:hidden!important;color:#312e81!important}.map-note{position:fixed;top:8px;right:8px;background:#131b2b;color:white;padding:7px;z-index:9999;font:12px Arial}';
 return generateP4Reconstruction(g).replace('</style>',style+'</style>')
  .replace('</main>',overlay+'</main>');
}
