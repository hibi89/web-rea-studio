// Opt-in, bounded, offline-only refinement of MODE1. Originals are immutable.
// A refinement only wins if BOTH full-canvas sampled pixel match rises and
// RGB MAE falls against the same verified saved source screenshot.
import {createHash} from 'node:crypto';
import {mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {compareChromeScreenshots} from './p5-visual-diff.mjs';
import {screenshotPngDimensions} from './dynamic-browser.mjs';
import {mvpDocumentCsp} from './mvp-builder.mjs';

const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const hash=b=>createHash('sha256').update(b).digest('hex');
const MAX_PNG=6*1024*1024;
const ORIGIN='https://mvp-faithful-offline.example.org/';
const candidates=Object.freeze([
 ['label-up-4','.label{transform:translateY(-4px)}'],
 ['label-down-4','.label{transform:translateY(4px)}'],
 ['label-left-4','.label{transform:translateX(-4px)}'],
 ['label-right-4','.label{transform:translateX(4px)}']
]);
export function generateBoundedFaithfulCandidates(original){
 if(typeof original!=='string'||original.length>250000||
    !original.startsWith('<!doctype html>')||
    !original.includes('<title>REA MVP · faithful</title>')||
    !original.includes('original functions unverified')||
    original.split('</style></head>').length!==2)throw Error('MVP_REFINEMENT_UNTRUSTED_HTML');
 return candidates.map(([id,css])=>({id,css,html:original.replace('</style></head>',
  '</style><style data-mvp-refinement="'+id+'">'+css+'</style></head>')}));
}
const err=(respond,res,status,name)=>(respond(res,status,{error:name}),true);

export async function handleMvpRefinement({req,res,path,store,respond,studioPort,isBusy=()=>false,
 replayExecutor,browserPath}){
 const m=/^\/api\/runs\/([a-f0-9-]+)\/(mvp-refine|mvp-refinement|mvp-refined|mvp-refined-screenshot|mvp-refined-download)$/.exec(path);
 if(!m)return false;
 const [,id,route]=m;
 if(!ID.test(id))return err(respond,res,400,'invalid_id');
 const meta=await store.get(id);
 if(!meta)return err(respond,res,404,'not_found');
 if(meta.status!=='completed'||meta.mode!=='static-visual')
  return err(respond,res,409,'completed_static_visual_required');
 const optIn=route==='mvp-refine';
 if(optIn){
  if(req.method!=='POST')return err(respond,res,405,'method_not_allowed');
  if(req.headers.origin!=='http://127.0.0.1:'+studioPort)
   return err(respond,res,403,'origin_not_allowed');
  if(Number(req.headers['content-length']||0)!==0||req.headers['transfer-encoding']!==undefined)
   return err(respond,res,400,'empty_body_required');
  if(isBusy())return err(respond,res,409,'local_analysis_busy');
 }else if(req.method!=='GET')return err(respond,res,405,'method_not_allowed');
 const base=join(store.pathFor(id),'mvp');
 let manifest,html,original,baseline,comparison,report,source;
 try{
  [manifest,html,original,baseline,comparison,report,source]=await Promise.all([
   readFile(join(base,'manifest.json'),'utf8').then(JSON.parse),
   readFile(join(base,'faithful.html')),
   readFile(join(base,'faithful-comparison.png')),
   readFile(join(base,'faithful-comparison.json'),'utf8').then(JSON.parse),
   store.getInspection(id),store.getReport(id),store.getScreenshot(id)
  ]);
 }catch(e){return err(respond,res,e.code==='ENOENT'?404:409,'measured_baseline_required');}
 if(manifest?.run_id!==id||manifest.version!==1||
    manifest.modes?.faithful?.sha256!==hash(html)||manifest.modes.faithful.bytes!==html.length||
    !Buffer.isBuffer(source)||source.length>MAX_PNG||original.length>MAX_PNG||
    !screenshotPngDimensions(source)||!screenshotPngDimensions(original)||
    report?.screenshot_saved!==true||report?.reconstruction_available!==true||
    (report.screenshot_sha256&&report.screenshot_sha256!==hash(source))||
    baseline?.status!=='MEASURED'||baseline.run_id!==id||
    baseline?.html_sha256!==hash(html)||baseline?.original?.sha256!==hash(source)||
    baseline?.generated?.sha256!==hash(original))
  return err(respond,res,409,'measured_baseline_invalid');
 let computed;
 try{computed=compareChromeScreenshots(source,original);}
 catch{return err(respond,res,409,'measured_baseline_invalid');}
 if(!computed.dimensions_equal||baseline.metrics?.rgb_mae!==computed.rgb_mae||
    baseline.metrics?.pixel_match_pct!==computed.pixel_match_pct)
  return err(respond,res,409,'measured_baseline_invalid');
 let patches;
 try{patches=generateBoundedFaithfulCandidates(html.toString('utf8'));}
 catch{return err(respond,res,409,'faithful_html_not_refinable');}
 const receiptFile=join(base,'faithful-refinement.json');
 const refinedFile=join(base,'faithful-refined.html');
 const imageFile=join(base,'faithful-refined.png');
 const hashes={source:hash(source),baseline:hash(original),html:hash(html)};
 const validRead=async()=>{
  let receipt;try{receipt=JSON.parse(await readFile(receiptFile,'utf8'));}
  catch(e){return {error:e.code==='ENOENT'?'refinement_not_run':'refinement_invalid',code:e.code==='ENOENT'?404:409};}
  if(receipt?.version!==1||receipt.run_id!==id||
     receipt?.evidence?.source_sha256!==hashes.source||
     receipt?.evidence?.baseline_sha256!==hashes.baseline||
     receipt?.evidence?.html_sha256!==hashes.html||
     !['IMPROVED','NO_IMPROVEMENT'].includes(receipt.status)||
     receipt.before?.pixel_match_pct!==computed.pixel_match_pct||
     receipt.before?.rgb_mae!==computed.rgb_mae)
   return {error:'refinement_evidence_changed',code:409};
  if(receipt.status==='IMPROVED'){
   let savedHtml,savedPng;
   try{[savedHtml,savedPng]=await Promise.all([readFile(refinedFile),readFile(imageFile)]);}
   catch{return {error:'refinement_artifact_missing',code:409};}
   if(!patches.some(p=>p.id===receipt.candidate_id&&p.html===savedHtml.toString('utf8'))||
      hash(savedHtml)!==receipt.after.html_sha256||
      hash(savedPng)!==receipt.after.png_sha256||!screenshotPngDimensions(savedPng)||
      savedPng.length>MAX_PNG||receipt.after.pixel_match_pct<=computed.pixel_match_pct||
      receipt.after.rgb_mae>=computed.rgb_mae)
     return {error:'refinement_evidence_changed',code:409};
   return {receipt,html:savedHtml,png:savedPng};
  }
  if(receipt.candidate_id!==null||receipt.after!==null)return {error:'refinement_evidence_changed',code:409};
  return {receipt};
 };
 if(!optIn){
  const read=await validRead();
  if(read.error)return err(respond,res,read.code,read.error);
  if(route==='mvp-refinement')return respond(res,200,read.receipt),true;
  if(read.receipt.status!=='IMPROVED')return err(respond,res,404,'no_improved_artifact');
  if(route==='mvp-refined-screenshot')return respond(res,200,read.png,'image/png'),true;
  const headers={'Content-Security-Policy':mvpDocumentCsp('faithful'),
   'X-Frame-Options':'SAMEORIGIN',
   ...(route==='mvp-refined-download'?{'Content-Disposition':'attachment; filename="rea-mvp-faithful-refined.html"'}:{})};
  return respond(res,200,read.html,'text/html; charset=utf-8',headers),true;
 }
 try{await readFile(receiptFile);return err(respond,res,409,'refinement_already_run');}
 catch(e){if(e.code!=='ENOENT')return err(respond,res,409,'refinement_invalid');}
 if(!browserPath||typeof replayExecutor!=='function')
  return err(respond,res,503,'refinement_browser_unavailable');
 const lock=join(base,'.refinement-busy');
 try{await mkdir(lock);}
 catch(e){if(e.code==='EEXIST')return err(respond,res,409,'refinement_in_progress');throw e;}
 try{
  let best=null;
  for(const patch of patches){
   const work=join(lock,patch.id);await mkdir(work);
   let result;
   try{
    result=await replayExecutor({target:ORIGIN,dir:work,browserPath,
     scriptsDisabled:true,offlineViewport:{width:1440,height:900},
     relay:async url=>{
      if(url!==ORIGIN)throw Error('MVP_REFINEMENT_OFFLINE_ONLY');
      return {status:200,contentType:'text/html; charset=utf-8',body:Buffer.from(patch.html)};
     }});
   }catch{return err(respond,res,409,'refinement_chrome_failed');}
   if(result?.report?.verdict!=='PASS'||result?.report?.scripts_executed!==false||
     result?.report?.screenshot_saved!==true)
    return err(respond,res,409,'refinement_chrome_unverified');
   const png=await readFile(join(work,'screenshot.png'));
   if(png.length>MAX_PNG||!screenshotPngDimensions(png))
    return err(respond,res,409,'refinement_screenshot_invalid');
   const metric=compareChromeScreenshots(source,png);
   if(!metric.dimensions_equal)return err(respond,res,409,'refinement_canvas_mismatch');
   if(metric.pixel_match_pct>computed.pixel_match_pct&&metric.rgb_mae<computed.rgb_mae&&
      (!best||metric.pixel_match_pct>best.metric.pixel_match_pct||
       (metric.pixel_match_pct===best.metric.pixel_match_pct&&metric.rgb_mae<best.metric.rgb_mae)))
    best={patch,png,metric};
  }
  const receipt={
   version:1,run_id:id,scope:'offline-saved-evidence-bounded-css-only',
   status:best?'IMPROVED':'NO_IMPROVEMENT',source_site_refetched:false,
   candidate_count:patches.length,candidate_id:best?.patch.id??null,
   evidence:{source_sha256:hashes.source,baseline_sha256:hashes.baseline,html_sha256:hashes.html},
   before:{pixel_match_pct:computed.pixel_match_pct,rgb_mae:computed.rgb_mae},
   after:best?{pixel_match_pct:best.metric.pixel_match_pct,rgb_mae:best.metric.rgb_mae,
    html_sha256:hash(best.patch.html),png_sha256:hash(best.png)}:null,
   limitations:['No original CSS/JS/backend cloning','No removal or masking of notice regions',
    'Only four bounded text-position offsets tested; no improvement means original retained',
    'Synthetic or script-disabled reference screenshots may not represent the live app']
  };
  if(best){
   await writeFile(refinedFile,best.patch.html,{flag:'wx',mode:0o600});
   await writeFile(imageFile,best.png,{flag:'wx',mode:0o600});
  }
  await writeFile(receiptFile,JSON.stringify(receipt),{flag:'wx',mode:0o600});
  return respond(res,201,receipt),true;
 }catch{
  await rm(refinedFile,{force:true}).catch(()=>{});
  await rm(imageFile,{force:true}).catch(()=>{});
  return err(respond,res,409,'refinement_failed');
 }finally{await rm(lock,{recursive:true,force:true}).catch(()=>{});}
}
