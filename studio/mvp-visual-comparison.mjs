// Explicit, saved-evidence-only Chrome comparison of the MVP faithful output.
// GET routes never run Chrome, re-capture, rebuild or modify source evidence.
import {createHash} from 'node:crypto';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {compareChromeScreenshots} from './p5-visual-diff.mjs';
import {screenshotPngDimensions} from './dynamic-browser.mjs';

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const OFFLINE='https://mvp-faithful-offline.example.org/';
const MAX_PNG=6*1024*1024;
const response=(respond,res,code,error)=>respond(res,code,{error});

export async function handleMvpVisualComparison({req,res,path,store,respond,studioPort,
  isBusy=()=>false,replayExecutor,browserPath}){
 const m=/^\/api\/runs\/([a-f0-9-]+)\/(mvp-compare|mvp-comparison|mvp-replica-screenshot)$/.exec(path);
 if(!m)return false;
 const [,id,kind]=m;
 if(!ID.test(id))return response(respond,res,400,'invalid_id'),true;
 const meta=await store.get(id);
 if(!meta)return response(respond,res,404,'not_found'),true;
 if(meta.mode!=='static-visual'||meta.status!=='completed')
  return response(respond,res,409,'completed_static_visual_required'),true;
 const building=kind==='mvp-compare';
 if(building){
  if(req.method!=='POST')return response(respond,res,405,'method_not_allowed'),true;
  if(req.headers.origin!=='http://127.0.0.1:'+studioPort)
   return response(respond,res,403,'origin_not_allowed'),true;
  // Empty-body opt-in; request is a stateful Chrome operation, never a GET.
  if(Number(req.headers['content-length']||0)!==0||
    (req.headers['transfer-encoding']!==undefined))
   return response(respond,res,400,'empty_body_required'),true;
  if(isBusy())return response(respond,res,409,'local_analysis_busy'),true;
 }else if(req.method!=='GET')return response(respond,res,405,'method_not_allowed'),true;
 const base=join(store.pathFor(id),'mvp');
 let manifest,html;
 try{
  manifest=JSON.parse(await readFile(join(base,'manifest.json'),'utf8'));
  html=await readFile(join(base,'faithful.html'));
 }catch(e){
  if(e.code==='ENOENT')return response(respond,res,404,'mvp_not_built'),true;
  return response(respond,res,409,'mvp_evidence_invalid'),true;
 }
 if(manifest.version!==1||manifest.run_id!==id||
   manifest.scope!=='saved-static-visual-offline-only'||
   manifest.modes?.faithful?.sha256!==digest(html)||
   manifest.modes?.faithful?.bytes!==html.byteLength)
  return response(respond,res,409,'mvp_artifact_changed'),true;
 const report=await store.getReport(id);
 if(report?.reconstruction_available!==true||report?.screenshot_saved!==true)
  return response(respond,res,409,'original_screenshot_unavailable'),true;
 const source=await store.getScreenshot(id);
 if(!Buffer.isBuffer(source)||source.byteLength>MAX_PNG||!screenshotPngDimensions(source))
  return response(respond,res,409,'original_screenshot_unavailable'),true;
 const sourceHash=digest(source);
 if(report.screenshot_sha256&&report.screenshot_sha256!==sourceHash)
  return response(respond,res,409,'original_screenshot_changed'),true;
 const filename=join(base,'faithful-comparison.json');
 const replicaName=join(base,'faithful-comparison.png');
 // Always verify saved artifacts against the current source and HTML.
 async function readVerified(){
  let receipt,png;
  try{receipt=JSON.parse(await readFile(filename,'utf8'));png=await readFile(replicaName);}
  catch(e){return {error:e.code==='ENOENT'?'comparison_not_run':'comparison_receipt_invalid',code:e.code==='ENOENT'?404:409};}
  const src=screenshotPngDimensions(source),view=screenshotPngDimensions(png);
  if(receipt?.schema_version!==1||receipt?.run_id!==id||receipt?.mode!=='faithful'||
     receipt?.original?.sha256!==sourceHash||receipt?.html_sha256!==digest(html)||
     receipt?.generated?.sha256!==digest(png)||!view||!src||
     receipt?.original?.width!==src.width||receipt?.original?.height!==src.height||
     receipt?.generated?.width!==view.width||receipt?.generated?.height!==view.height||
     !['MEASURED','DIMENSIONS_DIFFER'].includes(receipt.status)||
     (receipt.status==='MEASURED'&&(src.width!==view.width||src.height!==view.height||
      !Number.isFinite(receipt.metrics?.pixel_match_pct)||!Number.isFinite(receipt.metrics?.rgb_mae)))||
     (receipt.status==='DIMENSIONS_DIFFER'&&(src.width===view.width&&src.height===view.height||
      receipt.metrics!==null)))
    return {error:'comparison_evidence_changed',code:409};
  return {receipt,png};
 }
 if(!building){
  const saved=await readVerified();
  if(saved.error)return response(respond,res,saved.code,saved.error),true;
  if(kind==='mvp-replica-screenshot')return respond(res,200,saved.png,'image/png'),true;
  return respond(res,200,saved.receipt),true;
 }
 try{await readFile(filename);return response(respond,res,409,'comparison_already_exists'),true;}
 catch(e){if(e.code!=='ENOENT')return response(respond,res,409,'comparison_receipt_invalid'),true;}
 if(typeof replayExecutor!=='function'||!browserPath)
  return response(respond,res,503,'comparison_browser_unavailable'),true;
 const lock=join(base,'.comparison-busy');
 try{await mkdir(lock);}
 catch(e){if(e.code==='EEXIST')return response(respond,res,409,'comparison_in_progress'),true;throw e;}
 const work=join(lock,'offline-render');
 try{
  await mkdir(work);
  const evidence=await replayExecutor({target:OFFLINE,browserPath,dir:work,
   scriptsDisabled:true,offlineViewport:{width:1440,height:900},
   relay:async url=>{
    if(url!==OFFLINE)throw Error('MVP_OFFLINE_ONLY');
    return {status:200,contentType:'text/html; charset=utf-8',body:html};
   }});
  if(evidence?.report?.verdict!=='PASS'||evidence?.report?.screenshot_saved!==true||
     evidence?.report?.scripts_executed!==false)
   return response(respond,res,409,'offline_render_unverified'),true;
  const png=await readFile(join(work,'screenshot.png'));
  const sourceSize=screenshotPngDimensions(source),renderSize=screenshotPngDimensions(png);
  if(!renderSize||png.byteLength>MAX_PNG||!sourceSize)
   return response(respond,res,409,'offline_screenshot_invalid'),true;
  // P5 penalizes missing pixels; mismatched dimensions are NOT scored.
  const comparison=compareChromeScreenshots(source,png);
  const same=comparison.dimensions_equal;
  const receipt={
   schema_version:1,run_id:id,mode:'faithful',scope:'saved-source-and-offline-generated-only',
   status:same?'MEASURED':'DIMENSIONS_DIFFER',
   source_site_refetched:false,source_site_functionality_verified:false,
   html_sha256:digest(html),
   original:{sha256:sourceHash,width:sourceSize.width,height:sourceSize.height},
   generated:{sha256:digest(png),width:renderSize.width,height:renderSize.height},
   metrics:same?{method:comparison.method,pixel_match_pct:comparison.pixel_match_pct,
    rgb_mae:comparison.rgb_mae,coverage_pct:comparison.coverage_pct,
    sample_count:comparison.sample_count,match_rgb_threshold:comparison.match_rgb_threshold,
    downsample_stride:comparison.downsample_stride}:null,
   limitations:['Pixel comparison is not real-site JS/API/DB functional parity',
    'Saved script-disabled original may show incomplete or failed application rendering',
    'Screenshot score only applies to the exact saved evidence and generated faithful HTML']
  };
  await writeFile(replicaName,png,{flag:'wx',mode:0o600});
  try{await writeFile(filename,JSON.stringify(receipt),{flag:'wx',mode:0o600});}
  catch(e){await rm(replicaName,{force:true});throw e;}
  return respond(res,201,receipt),true;
 }catch{
  return response(respond,res,409,'offline_visual_comparison_failed'),true;
 }finally{
  await rm(lock,{recursive:true,force:true}).catch(()=>{});
 }
}
