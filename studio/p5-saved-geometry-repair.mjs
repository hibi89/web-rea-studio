import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {generateP4Reconstruction,sanitizeP4Geometry} from './p4-reconstruction.mjs';
import {readIndependentDraftReceipt} from './independent-draft.mjs';
import {runObservedP4GeometryRepair} from './p5-observed-alignment.mjs';
import {runDynamicAnalysis} from './dynamic-browser.mjs';

// The renderer NEVER receives the original URL. Generated scriptless HTML
// is intercepted in memory at a constant, synthetic document address.
const REPLAY_URL='https://p5-saved-geometry-offline.example.org/';
const sha256=text=>createHash('sha256').update(text).digest('hex');
const invalid=code=>Object.assign(Error(code),{code});

export async function reviewSavedP5GeometryRepair({store,id,browserPath,
 replayExecutor=runDynamicAnalysis}={}){
 if(!store||typeof replayExecutor!=='function')
  throw invalid('P5_GEOMETRY_OPTIONS_INVALID');
 const meta=await store.get(id);
 if(meta?.mode!=='static-visual'||meta.status!=='completed')
  throw invalid('P5_GEOMETRY_RUN_NOT_ELIGIBLE');
 const [receipt,report,inspection,comparison,originalPng]=await Promise.all([
  readIndependentDraftReceipt(store,id),store.getReport(id),store.getInspection(id),
  store.getComparison(id),store.getScreenshot(id)
 ]);
 if(receipt?.status!=='STORED_UNVERIFIED'||
    report?.reconstruction_available!==true||report?.screenshot_saved!==true||
    inspection?.mode!=='static-visual'||
    comparison?.schema_version!==2||comparison?.ignored_notice_area!==false||
    !Buffer.isBuffer(originalPng))
  throw invalid('P5_GEOMETRY_EVIDENCE_MISSING');
 const reference=sanitizeP4Geometry(inspection.page?.reconstruction_blueprint);
 if(!reference?.boxes?.length)throw invalid('P5_GEOMETRY_SOURCE_INVALID');
 const runDir=store.pathFor(id);
 const [document,rawGeometry]=await Promise.all([
  readFile(join(runDir,'independent-draft.html'),'utf8'),
  readFile(join(runDir,'independent-draft-geometry.json'),'utf8')
 ]);
 let supplied;
 try{supplied=JSON.parse(rawGeometry);}catch{
  throw invalid('P5_GEOMETRY_DRAFT_INVALID');
 }
 const draft=sanitizeP4Geometry(supplied);
 if(!draft||!draft.boxes?.length||
    draft.viewport.width!==reference.viewport.width||
    draft.viewport.height!==reference.viewport.height||
    draft.document.width!==reference.document.width||
    draft.document.height!==reference.document.height||
    generateP4Reconstruction(draft)!==document||
    sha256(document)!==receipt.html_sha256||
    receipt.bytes!==Buffer.byteLength(document)||Buffer.byteLength(document)>250000)
  throw invalid('P5_GEOMETRY_DRAFT_INTEGRITY_FAILED');
 const dir=join(runDir,'p5-geometry-review-'+randomUUID());
 await mkdir(dir,{mode:0o700});
 let captures=0;
 async function capture(html,{attempt}={}){
  if(captures>=6||Buffer.byteLength(html)>250000||
     !html.includes('script-src &#39;none&#39;')||
     /<script\b|<iframe\b|https?:\/\//i.test(html))
   throw invalid('P5_GEOMETRY_REPLAY_BOUNDARY');
  const index=captures++;
  const destination=join(dir,'capture-'+index);
  await mkdir(destination,{mode:0o700});
  const observed=await replayExecutor({
   target:REPLAY_URL,browserPath,dir:destination,scriptsDisabled:true,
   relay:async url=>{
    if(url!==REPLAY_URL)throw invalid('P5_GEOMETRY_OFF_SCOPE');
    return {status:200,contentType:'text/html; charset=utf-8',
     body:Buffer.from(html,'utf8')};
   }
  });
  if(observed?.report?.verdict!=='PASS'||
     observed?.report?.screenshot_saved!==true||
     observed?.inspection?.page?.reconstruction_blueprint?.source!=='p4-geometry')
   throw invalid('P5_GEOMETRY_REPLAY_UNVERIFIED');
  return {screenshot:await readFile(join(destination,'screenshot.png')),
   geometry:observed.inspection.page.reconstruction_blueprint};
 }
 try{
  const freshDraft=await capture(document,{attempt:'saved-draft'});
  // Actual observed draft PNG and geometry are separate evidence from the
  // user's unverified submitted P4 geometry; no invented discrepancy.
  const result=await runObservedP4GeometryRepair({
   referenceGeometry:reference,draftGeometry:freshDraft.geometry,
   referencePng:originalPng,draftPng:freshDraft.screenshot,
   renderCandidate:capture,maxAttempts:2,minMaeImprovement:0.3
  });
  const improved=result.accepted>0&&
   typeof result.candidate_html==='string'&&
   result.candidate_html.includes('script-src &#39;none&#39;')&&
   Buffer.byteLength(result.candidate_html)<=250000;
  const summary={
   schema_version:1,kind:'saved-independent-p4-geometry-review',
   status:result.status,reason:result.reason??null,
   source:'saved-original-source-and-user-static-draft-independent-chrome-replays',
   stored_draft_sha256:receipt.html_sha256,
   independent_draft_chrome_captured:true,
   canonical_draft_preflight_verified:result.alignment?.canonical_draft_verified===true,
   alignment:result.alignment?{
    status:result.alignment.status,
    defect:result.alignment.defect??null,
    reference_regions:result.alignment.reference_regions??0,
    draft_regions:result.alignment.draft_regions??0,
    draft_pixel_match_pct:result.alignment.draft_pixel_match_pct??null,
    draft_rgb_mae:result.alignment.draft_rgb_mae??null}:null,
   attempts:result.attempts??0,accepted:result.accepted??0,
   chrome_replays:captures,baseline:result.baseline??null,final:result.final??null,
   history:result.history??[],
   downloadable_improved_html:improved,
   source_run_evidence_modified:false,stored_draft_modified:false,
   original_site_refetched:false,external_requests_issued:0,
   secondary_viewports_verified:0,
   functionality_verified:false,backend_equivalence_verified:false,
   product_ready:false,
   limitations:['Static P4 region alignment and x/y/w/h only',
    'Submitted draft authored by user; not evidence of source functional behavior',
    'Only the captured source viewport verified, not responsive variants',
    'Synthetic in-memory Chrome replay does not restore original API data']
  };
  if(improved)
   await writeFile(join(runDir,'geometry-repair.html'),result.candidate_html,
    {flag:'wx',mode:0o600});
  await writeFile(join(runDir,'geometry-repair.json'),JSON.stringify(summary,null,2),
   {flag:'wx',mode:0o600});
  return summary;
 }finally{
  await rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:120}).catch(()=>{});
 }
}
