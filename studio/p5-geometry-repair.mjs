import {sanitizeP4Geometry,generateP4Reconstruction} from './p4-reconstruction.mjs';
import {compareP4Geometry} from './p5-geometry-diff.mjs';
import {compareChromeScreenshots,evaluateStaticVisualGate} from './p5-visual-diff.mjs';

// P4 rectangle geometry only. Color/DOM/JS/data corrections belong to
// separate modules. The caller must provide an independently captured PNG
// for every candidate, never just update an expected score.
const dimensions=['x','y','w','h'];
const visible=b=>b.background!=='transparent'&&
 !/^rgba?\(0,\s*0,\s*0,\s*0\)$/.test(b.background);
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&
 a.y<b.y+b.h&&a.y+a.h>b.y;
const contains=(outer,inner)=>outer.x<=inner.x&&outer.y<=inner.y&&
 outer.x+outer.w>=inner.x+inner.w&&outer.y+outer.h>=inner.y+inner.h;
const sameFrame=(a,b)=>a.source===b.source&&
 a.document.width===b.document.width&&a.document.height===b.document.height&&
 a.viewport.width===b.viewport.width&&a.viewport.height===b.viewport.height&&
 a.boxes.length===b.boxes.length;
function checkShapes(reference,starting){
 const a=sanitizeP4Geometry(reference),b=sanitizeP4Geometry(starting);
 if(!a||!b||!sameFrame(a,b)||!a.boxes.length)
  throw Error('P5_GEOMETRY_REPAIR_EVIDENCE_MISMATCH');
 if(a.background!==b.background||a.titles.length!==b.titles.length||
    JSON.stringify(a.titles)!==JSON.stringify(b.titles))
  throw Error('P5_GEOMETRY_REPAIR_CONTENT_MISMATCH');
 for(let i=0;i<a.boxes.length;i++){
  const x=a.boxes[i],y=b.boxes[i];
  if(x.tag!==y.tag||x.depth!==y.depth||x.background!==y.background||
     x.radius!==y.radius||x.border_color!==y.border_color||
     x.border_width!==y.border_width)
   throw Error('P5_GEOMETRY_REPAIR_CONTENT_MISMATCH');
 }
 return {reference:a,starting:b};
}
function validPosition(b,frame){
 return b.w>=110&&b.h>=88&&b.x>=0&&b.y>=0&&
  b.x+b.w<=frame.width&&b.y+b.h<=frame.height;
}
export function proposeGroundedP4GeometryPatch(referenceGeometry,currentGeometry,
 {maxDeltaPx=64}={}){
 if(!Number.isInteger(maxDeltaPx)||maxDeltaPx<1||maxDeltaPx>64)
  throw Error('P5_GEOMETRY_REPAIR_BAD_LIMIT');
 const {reference,starting}=checkShapes(referenceGeometry,currentGeometry);
 const differing=[];
 for(let i=0;i<reference.boxes.length;i++){
  if(dimensions.some(k=>reference.boxes[i][k]!==starting.boxes[i][k]))differing.push(i);
 }
 // Stable box identity requires the same number and order of observed regions;
 // never guess between two simultaneously misregistered boxes.
 if(differing.length!==1)return null;
 const index=differing[0],orig=reference.boxes[index],draft=starting.boxes[index];
 if(orig.tag==='body'||!visible(orig)||!validPosition(orig,reference.document)||
    !validPosition(draft,reference.document))return null;
 const diffs=dimensions.filter(k=>orig[k]!==draft[k]);
 if(diffs.length>2||diffs.some(k=>Math.abs(orig[k]-draft[k])>maxDeltaPx))
  return null;
 const field=diffs[0],candidate={...draft,[field]:orig[field]};
 // A change involving text, another painted peer, or a nested visible region
 // may alter unrelated content. Reject even if a screenshot score might rise.
 if([orig,draft,candidate].some(rect=>
    reference.titles.some(t=>intersects(rect,t))||
    reference.boxes.some((peer,i)=>{
     if(i===index||peer.tag==='body'||!visible(peer))return false;
     // A fully enclosing body/outer document wrapper isn't an independent
     // obstruction. A genuine peer or nested child is.
     if(contains(peer,orig)&&contains(peer,draft)&&contains(peer,candidate))return false;
     return intersects(rect,peer);
    })))return null;
 const boxes=starting.boxes.map((v,i)=>i===index?candidate:v);
 return {patch:{kind:'observed-rectangle-geometry',region_index:index,
  field,delta_px:orig[field]-draft[field],
  source:'matched-sanitized-P4-region',max_delta_px:maxDeltaPx},
  geometry:{...starting,boxes}};
}
const number=n=>Number.isFinite(n);
async function readVisual(referencePng,referenceGeometry,renderCandidate,html,attempt,viewport){
 const output=await renderCandidate(html,{attempt,viewport});
 if(!Buffer.isBuffer(output?.screenshot)||
    output?.geometry?.source!=='p4-geometry')
  throw Error('P5_GEOMETRY_REPLAY_INCOMPLETE');
 const visual=compareChromeScreenshots(referencePng,output.screenshot);
 visual.geometry=compareP4Geometry(referenceGeometry,output.geometry);
 const geo=visual.geometry;
 if(!visual.dimensions_equal||visual.coverage_pct!==100||
   visual.ignored_notice_area!==false||geo.status!=='measured-not-certified'||
   !number(visual.rgb_mae)||!number(visual.pixel_match_pct)||
   !number(geo.region_match_pct))
  throw Error('P5_GEOMETRY_REPLAY_MEASUREMENT_INCOMPLETE');
 return {rgb_mae:visual.rgb_mae,pixel_match_pct:visual.pixel_match_pct,
  region_match_pct:geo.region_match_pct,
  avg_geometry_error_px:geo.average_geometry_error_px,
  gate:evaluateStaticVisualGate(visual).status};
}
function improves(before,after,minImprovement){
 return after.rgb_mae<=before.rgb_mae-minImprovement&&
  after.pixel_match_pct>=before.pixel_match_pct&&
  after.region_match_pct>=before.region_match_pct&&
  (before.avg_geometry_error_px===null||
   after.avg_geometry_error_px===null||
   after.avg_geometry_error_px<=before.avg_geometry_error_px)&&
  !(before.gate==='VISUAL_THRESHOLD_MET_STATIC_ONLY'&&
     after.gate!=='VISUAL_THRESHOLD_MET_STATIC_ONLY');
}
function noRegression(before,after){
 return after.rgb_mae<=before.rgb_mae+0.05&&
  after.pixel_match_pct>=before.pixel_match_pct-0.01&&
  after.region_match_pct>=before.region_match_pct&&
  !(before.gate==='VISUAL_THRESHOLD_MET_STATIC_ONLY'&&
     after.gate!=='VISUAL_THRESHOLD_MET_STATIC_ONLY');
}
export async function runBoundedP4GeometryRepair({referenceGeometry,startingGeometry,
 referencePng,renderCandidate,maxAttempts=2,minMaeImprovement=0.3,
 regressionViews=[]}={}){
 if(![1,2].includes(maxAttempts)||!number(minMaeImprovement)||
  minMaeImprovement<=0||minMaeImprovement>20||
  !Buffer.isBuffer(referencePng)||typeof renderCandidate!=='function'||
  !Array.isArray(regressionViews)||regressionViews.length>2||
  new Set(regressionViews.map(v=>v?.name)).size!==regressionViews.length||
  regressionViews.some(v=>!v||typeof v.name!=='string'||
   !/^[a-z0-9-]{1,32}$/.test(v.name)||
   !Buffer.isBuffer(v.referencePng)||typeof v.renderCandidate!=='function'||
   v.referenceGeometry?.source!=='p4-geometry'||
   v.referenceGeometry.viewport?.width===referenceGeometry?.viewport?.width))
  throw Error('P5_GEOMETRY_REPAIR_INVALID_OPTIONS');
 const {reference,starting}=checkShapes(referenceGeometry,startingGeometry);
 let working=starting,accepted=0,renderings=0,secondaryRenderings=0;
 let html=generateP4Reconstruction(working);
 let primary;
 try{
  primary=await readVisual(referencePng,reference,renderCandidate,html,0,'primary');
  renderings++;
 }catch{return {schema_version:1,status:'STOPPED_BASELINE_NOT_VERIFIED',
  accepted:0,attempts:0,renderings,secondary_renderings:0,
  history:[],product_ready:false,functional_equivalence_verified:false};}
 const secondary=[];
 for(const view of regressionViews){
  try{
   const metric=await readVisual(view.referencePng,view.referenceGeometry,
    view.renderCandidate,html,0,view.name);
   secondary.push(metric);secondaryRenderings++;
  }catch{return {schema_version:1,status:'STOPPED_SECONDARY_BASELINE_UNVERIFIED',
   accepted:0,attempts:0,renderings,secondary_renderings:secondaryRenderings,
   history:[],product_ready:false,functional_equivalence_verified:false};}
 }
 const initial=primary,history=[];
 let status='NO_SAFE_GEOMETRY_PATCH';
 for(let i=1;i<=maxAttempts;i++){
  const proposal=proposeGroundedP4GeometryPatch(reference,working);
  if(!proposal)break;
  const candidateHtml=generateP4Reconstruction(proposal.geometry);
  if(Buffer.byteLength(candidateHtml)>250000)throw Error('P5_GEOMETRY_HTML_TOO_LARGE');
  let after;
  try{
   after=await readVisual(referencePng,reference,renderCandidate,candidateHtml,i,'primary');
   renderings++;
  }catch{
   history.push({iteration:i,patch:proposal.patch,accepted:false,
    reason:'primary_replay_failed'});
   status='STOPPED_REPLAY_FAILED';break;
  }
  let approved=improves(primary,after,minMaeImprovement);
  const reviews=[];
  if(approved)for(let k=0;k<regressionViews.length;k++){
   const view=regressionViews[k],before=secondary[k];let measured;
   try{
    measured=await readVisual(view.referencePng,view.referenceGeometry,
     view.renderCandidate,candidateHtml,i,view.name);
    secondaryRenderings++;
   }catch{
    reviews.push({name:view.name,status:'unverified'});approved=false;
    status='STOPPED_VIEWPORT_REGRESSION';break;
   }
   const safe=noRegression(before,measured);
   reviews.push({name:view.name,status:safe?'no-regression':'regressed',
    before,after:measured});
   if(!safe){approved=false;status='STOPPED_VIEWPORT_REGRESSION';break;}
  }
  history.push({iteration:i,patch:proposal.patch,accepted:approved,
   before:primary,after,secondary_views:reviews,
   reason:approved?'independently_replayed_improvement':
    status==='STOPPED_VIEWPORT_REGRESSION'?'secondary_viewport_regression':'no_verified_improvement'});
  if(!approved){
   if(status!=='STOPPED_VIEWPORT_REGRESSION')status='STOPPED_NO_IMPROVEMENT';
   break;
  }
  for(let k=0;k<reviews.length;k++)secondary[k]=reviews[k].after;
  working=proposal.geometry;html=candidateHtml;primary=after;accepted++;
  status='BOUNDED_STATIC_GEOMETRY_IMPROVEMENT';
 }
 return {schema_version:1,status,accepted,attempts:history.length,
  renderings,secondary_renderings:secondaryRenderings,history,
  baseline:initial,final:primary,candidate_html:html,
  rollback_on_nonimprovement:true,
  secondary_views_verified:regressionViews.length,
  original_site_refetched:false,additional_origins_approved:0,
  product_ready:false,functional_equivalence_verified:false,
  backend_equivalence_verified:false,independent_chrome_verified_by_module:false,
  limitations:['Only a single matched painted P4 rectangle and one x/y/w/h field per patch',
   'No title, painted sibling, nested region or large displacement',
   'Chrome measurement is proven only by an external browser-running caller',
   'No real-site layout, responsive behavior, JavaScript or API parity verified']};
}
