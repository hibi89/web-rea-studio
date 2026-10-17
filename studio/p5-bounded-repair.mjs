import {sanitizeP4Geometry,generateP4Reconstruction} from './p4-reconstruction.mjs';
import {compareP4Geometry} from './p5-geometry-diff.mjs';
import {compareChromeScreenshots,evaluateStaticVisualGate} from './p5-visual-diff.mjs';
import {proposeScreenshotRegionColor} from './p5-pixel-colors.mjs';

// Offline, narrowly scoped P4 repair. No site navigation, network
// permissions, JavaScript, DOM selectors or remote resources are generated.
// The caller must supply an independent renderer; see the Chrome CI example.
const sameShape=(a,b)=>a&&b&&a.tag===b.tag&&a.depth===b.depth&&
 a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;
const rounded=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
function safeEvidence(reference,draft){
 const ref=sanitizeP4Geometry(reference),cur=sanitizeP4Geometry(draft);
 if(!ref||!cur||!ref.boxes.length||ref.document.width!==cur.document.width||
  ref.document.height!==cur.document.height||ref.boxes.length!==cur.boxes.length||
  ref.viewport.width!==cur.viewport.width||ref.viewport.height!==cur.viewport.height)
  throw Error('P5_REPAIR_EVIDENCE_MISMATCH');
 if(ref.boxes.some((box,i)=>!sameShape(box,cur.boxes[i])))
  throw Error('P5_REPAIR_LAYOUT_MISMATCH');
 return {ref,cur};
}
export function proposeSafeP4ColorRepair(reference,draft){
 const {ref,cur}=safeEvidence(reference,draft);
 if(ref.background!==cur.background){
  // In P4 a separate painted body rectangle may cover the CSS page color.
  // Treat these two representations of the same page background as one
  // semantic edit, otherwise a valid CSS-only patch can change zero pixels.
  const boxes=cur.boxes.map((box,i)=>box.tag==='body'&&ref.boxes[i].tag==='body'?
   {...box,background:ref.boxes[i].background}:box);
  return {patch:{kind:'page-background',region_index:null},
   geometry:{...cur,background:ref.background,boxes}};
 }
 for(let i=0;i<ref.boxes.length;i++){
  if(ref.boxes[i].background===cur.boxes[i].background)continue;
  const boxes=cur.boxes.map((v,j)=>j===i?{...v,background:ref.boxes[i].background}:v);
  return {patch:{kind:'painted-region-color',region_index:i},
   geometry:{...cur,boxes}};
 }
 return null;
}

export async function runBoundedP4ColorRepair({referenceGeometry,startingGeometry,
 referencePng,renderCandidate,maxAttempts=2,minMaeImprovement=0.1,
 enableScreenshotColorInference=false}={}){
 if(![1,2].includes(maxAttempts)||!Number.isFinite(minMaeImprovement)||
  minMaeImprovement<=0||minMaeImprovement>20||
  !Buffer.isBuffer(referencePng)||typeof renderCandidate!=='function'||
  typeof enableScreenshotColorInference!=='boolean')
  throw Error('P5_REPAIR_INVALID_OPTIONS');
 const {ref,cur}=safeEvidence(referenceGeometry,startingGeometry);
 const history=[];let accepted=0,renders=0,work=cur;
 const measure=async (geometry,attempt)=>{
  const html=generateP4Reconstruction(geometry);
  if(Buffer.byteLength(html)>250000)throw Error('P5_REPAIR_HTML_TOO_LARGE');
  const observed=await renderCandidate(html,{attempt});
  renders++;
  if(!Buffer.isBuffer(observed?.screenshot)||
   observed?.geometry?.source!=='p4-geometry')
   throw Error('P5_REPAIR_RENDER_INCOMPLETE');
  const visual=compareChromeScreenshots(referencePng,observed.screenshot);
  visual.geometry=compareP4Geometry(ref,observed.geometry);
  return {html,visual,screenshot:observed.screenshot,gate:evaluateStaticVisualGate(visual)};
 };
 let baseline;
 try{baseline=await measure(work,0);}
 catch{return {schema_version:1,status:'STOPPED_BASELINE_NOT_VERIFIED',
  attempts:0,accepted:0,renderings:renders,history:[],
  product_ready:false,functional_equivalence_verified:false,
  independent_chrome_verified_by_module:false};}
 let last=baseline,status='NO_SAFE_COLOR_PATCH';
 for(let i=1;i<=maxAttempts;i++){
  let next;
  try{
   next=enableScreenshotColorInference?
    proposeScreenshotRegionColor({referenceGeometry:ref,currentGeometry:work,
     referencePng,baselinePng:last.screenshot}):
    proposeSafeP4ColorRepair(ref,work);
  }catch{status='STOPPED_INFERENCE_UNAVAILABLE';break;}
  if(!next)break;
  let observed;
  try{observed=await measure(next.geometry,i);}
  catch{
   history.push({iteration:i,patch:next.patch,accepted:false,reason:'replay_failed'});
   status='STOPPED_RENDER_FAILURE';break;
  }
  const before=last.visual,after=observed.visual;
  const better=after.dimensions_equal===true&&after.coverage_pct===100&&
   after.ignored_notice_area===false&&
   after.visual_assertion_unsupported!==true&&
   rounded(after.rgb_mae)!==null&&rounded(before.rgb_mae)!==null&&
   before.rgb_mae-after.rgb_mae>=minMaeImprovement&&
   after.pixel_match_pct>=before.pixel_match_pct&&
   after.geometry?.status==='measured-not-certified'&&
   before.geometry?.status==='measured-not-certified'&&
   after.geometry.region_match_pct>=before.geometry.region_match_pct;
  history.push({iteration:i,patch:next.patch,accepted:better,
   before:{rgb_mae:before.rgb_mae,pixel_match_pct:before.pixel_match_pct},
   after:{rgb_mae:after.rgb_mae,pixel_match_pct:after.pixel_match_pct},
   reason:better?'independently_replayed_improvement':'no_verified_improvement'});
  if(!better){status='STOPPED_NO_IMPROVEMENT';break;}
  work=next.geometry;last=observed;accepted++;
  status='BOUNDED_STATIC_COLOR_IMPROVEMENT';
 }
 return {schema_version:1,status,attempts:history.length,accepted,
  renderings:renders,max_attempts:maxAttempts,history,
  baseline:{rgb_mae:baseline.visual.rgb_mae,pixel_match_pct:baseline.visual.pixel_match_pct,
   gate:baseline.gate.status},
  final:{rgb_mae:last.visual.rgb_mae,pixel_match_pct:last.visual.pixel_match_pct,
   gate:last.gate.status},
  candidate_html:last.html,
  rollback_on_nonimprovement:true,
  screenshot_inference_enabled:enableScreenshotColorInference,
  externally_authorized_actions:0,
  functional_equivalence_verified:false,
  backend_equivalence_verified:false,
  independent_chrome_verified_by_module:false,
  product_ready:false,
  limitations:['Only recorded P4 background and region colors may be changed',
   'Screenshot inference uses only high-confidence uniformly painted region interiors',
   'A callback must independently capture every proposed result',
   'No behavioral repair, API access, generic website repair or user Windows proof']
 };
}
