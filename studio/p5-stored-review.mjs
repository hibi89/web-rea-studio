import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {runBoundedP4ColorRepair} from './p5-bounded-repair.mjs';
import {runDynamicAnalysis} from './dynamic-browser.mjs';

// Always use a fixed, synthetic document URL. The original target URL is
// never submitted to this replay adapter or its request interceptor.
const REPLAY_URL='https://p5-offline-replay.example.org/';
const REPLAY_CSP="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";

export async function reviewSavedP5ColorRepair({store,id,browserPath,
 replayExecutor=runDynamicAnalysis}={}){
 if(!store||typeof replayExecutor!=='function')throw Error('P5_REVIEW_OPTIONS_INVALID');
 const meta=await store.get(id);
 if(meta?.mode!=='static-visual'||meta.status!=='completed')
  throw Error('P5_REVIEW_NOT_ELIGIBLE');
 const [report,inspection,comparison,png]=await Promise.all([
  store.getReport(id),store.getInspection(id),store.getComparison(id),store.getScreenshot(id)]);
 if(report?.reconstruction_available!==true||report?.screenshot_saved!==true||
  inspection?.mode!=='static-visual'||inspection?.page?.reconstruction_blueprint?.source!=='p4-geometry'||
  comparison?.schema_version!==2||comparison?.ignored_notice_area!==false||
  !Buffer.isBuffer(png))
  throw Error('P5_REVIEW_EVIDENCE_MISSING');
 const geometry=inspection.page.reconstruction_blueprint;
 // A fresh P4 layout is derived from saved evidence. This is intentionally
 // not a mechanism to invent a bad patch or change the original run.
 const scratch=join(store.pathFor(id),'p5-color-review-'+randomUUID());
 await mkdir(scratch,{mode:0o700});
 let calls=0;
 try{
  const result=await runBoundedP4ColorRepair({
   referenceGeometry:geometry,startingGeometry:geometry,referencePng:png,
   enableScreenshotColorInference:true,
   renderCandidate:async(document,{attempt})=>{
    if(attempt!==calls++||attempt>2)throw Error('P5_REVIEW_BUDGET_EXCEEDED');
    const destination=join(scratch,'capture-'+attempt);
    await mkdir(destination,{mode:0o700});
    const replay=await replayExecutor({
     target:REPLAY_URL,browserPath,dir:destination,scriptsDisabled:true,
     relay:async requested=>{
      if(requested!==REPLAY_URL)throw Error('P5_REVIEW_OFF_SCOPE');
      return {status:200,contentType:'text/html; charset=utf-8',
       body:Buffer.from(document,'utf8')};
     }
    });
    if(replay?.report?.verdict!=='PASS'||replay?.report?.screenshot_saved!==true||
       replay?.inspection?.page?.reconstruction_blueprint?.source!=='p4-geometry')
      throw Error('P5_REVIEW_REPLAY_NOT_VERIFIED');
    return {screenshot:await readFile(join(destination,'screenshot.png')),
     geometry:replay.inspection.page.reconstruction_blueprint};
   }
  });
  // The engine returns HTML for its last measured candidate; release it only
  // after a real accepted improvement, never for unchanged/failed proposals.
  const improved=result.accepted>0&&result.status==='BOUNDED_STATIC_COLOR_IMPROVEMENT';
  const summary={
   schema_version:1,kind:'stored-static-p5-color-review',
   source:'saved-geometry-and-png-with-fresh-scriptless-replay',
   status:result.status,attempts:result.attempts,accepted:result.accepted,
   renderings:result.renderings,history:result.history,
   screenshot_inference_enabled:true,
   baseline:result.baseline??null,final:result.final??null,
   downloadable_improved_html:improved,
   original_capture_reexecuted:false,original_run_files_overwritten:false,
   external_requests_issued:0,additional_origins_approved:0,
   functional_equivalence_verified:false,product_ready:false,
   limitations:['Only static P4 background and painted region color fixes',
    'Starting geometry is currently generated from the same saved reference',
    'Pixel repair requires a large unobscured near-uniform region in both PNGs',
    'A passing screenshot does not prove API or interaction parity']
  };
  if(improved){
   if(!result.candidate_html?.includes('script-src &#39;none&#39;')||
      Buffer.byteLength(result.candidate_html)>250000)
    throw Error('P5_REVIEW_OUTPUT_INVALID');
   await writeFile(join(store.pathFor(id),'color-repair.html'),
    result.candidate_html,{flag:'wx',mode:0o600});
  }
  // The JSON receipt is the completion marker. It is never rewritten by GET.
  await writeFile(join(store.pathFor(id),'color-repair.json'),
   JSON.stringify(summary,null,2),{flag:'wx',mode:0o600});
  return summary;
 }finally{
  await rm(scratch,{recursive:true,force:true,maxRetries:3,retryDelay:120}).catch(()=>{});
 }
}
export const P5_REPAIR_REPLAY_CSP=REPLAY_CSP;
