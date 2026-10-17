import {sanitizeP4Geometry,generateP4Reconstruction} from './p4-reconstruction.mjs';
import {compareChromeScreenshots} from './p5-visual-diff.mjs';
import {runBoundedP4GeometryRepair} from './p5-geometry-repair.mjs';

// Match only visible, discrete paint blocks; never tag names or source DOM
// selectors. A generated P4 HTML uses 'div' even when original was 'aside'.
const rgbaClear=/^rgba?\(0,\s*0,\s*0,\s*0\)$/;
const fields=['x','y','w','h'];
const diff=(a,b)=>fields.map(k=>Math.abs(a[k]-b[k]));
const score=(a,b)=>diff(a,b).reduce((x,y)=>x+y,0);
const painted=(b,g)=>b.tag!=='body'&&
 b.background!=='transparent'&&!rgbaClear.test(b.background)&&
 b.background!==g.background&&b.w>=110&&b.h>=88&&
 b.x>=0&&b.y>=0&&b.x+b.w<=g.document.width&&
 b.y+b.h<=g.document.height&&b.w*b.h<=g.document.width*g.document.height*.6;
const identity=(a,b)=>a.background===b.background&&
 a.radius===b.radius&&a.border_width===b.border_width&&
 a.border_color===b.border_color;
const regionSet=g=>g.boxes.map((box,index)=>({box,index}))
 .filter(({box})=>painted(box,g)).slice(0,32);
const frameMatches=(a,b)=>a.viewport.width===b.viewport.width&&
 a.viewport.height===b.viewport.height&&
 a.document.width===b.document.width&&a.document.height===b.document.height;
const decline=(reason,referenceCount=0,draftCount=0)=>({
 schema_version:1,status:'REJECTED',reason,
 reference_regions:referenceCount,draft_regions:draftCount,
 observed_pairs:[],active_patch_available:false,
 product_ready:false
});
export function alignObservedP4Regions({referenceGeometry,draftGeometry,
 maxDeltaPx=64}={}){
 if(!Number.isInteger(maxDeltaPx)||maxDeltaPx<1||maxDeltaPx>64)
  throw Error('P5_ALIGNMENT_LIMIT_INVALID');
 const ref=sanitizeP4Geometry(referenceGeometry),draft=sanitizeP4Geometry(draftGeometry);
 if(!ref||!draft||!frameMatches(ref,draft))
  return decline('viewport_or_evidence_mismatch');
 if(ref.background!==draft.background)
  return decline('page_paint_mismatch');
 const sources=regionSet(ref),targets=regionSet(draft),count=sources.length;
 if(count<1||count>24||targets.length!==count)
  return decline('painted_region_count_mismatch',count,targets.length);
 const pairing=[];
 const maxTotal=maxDeltaPx*2;
 for(const source of sources){
  const candidates=targets.filter(target=>identity(source.box,target.box)&&
   diff(source.box,target.box).every(v=>v<=maxDeltaPx)&&
   score(source.box,target.box)<=maxTotal);
  // A nearby lookalike is still ambiguous even if one candidate scores a
  // little better; no heuristic greedy matching on duplicate cards.
  if(candidates.length!==1)return decline('ambiguous_or_unmatched_region',count,targets.length);
  pairing.push({reference_index:source.index,draft_index:candidates[0].index,
   source:source.box,observed:candidates[0].box});
 }
 if(new Set(pairing.map(p=>p.draft_index)).size!==count)
  return decline('competing_region_matches',count,targets.length);
 const changed=pairing.filter(p=>fields.some(k=>p.source[k]!==p.observed[k]));
 if(changed.length!==1)
  return decline(changed.length===0?'no_independent_geometry_defect':'multiple_independent_geometry_defects',
   count,targets.length);
 const p=changed[0],changedFields=fields.filter(k=>p.source[k]!==p.observed[k]);
 if(changedFields.length>2)
  return decline('too_many_changed_coordinates',count,targets.length);
 // Preserve the exact original P4 source schema expected by the bounded
 // repair engine, but replace only the one fully measured independent draft
 // rectangle. The other original coordinates remain identical to observed
 // counterparts; never invent an error to make the patch run.
 const projected={...ref,boxes:ref.boxes.map((v,i)=>i===p.reference_index?
  {...v,x:p.observed.x,y:p.observed.y,w:p.observed.w,h:p.observed.h}:v)};
 return {
  schema_version:1,status:'MATCHED_ONE_OBSERVED_DEFECT',
  reference_regions:count,draft_regions:targets.length,
  observed_pairs:pairing.map(row=>({reference_index:row.reference_index,
   draft_index:row.draft_index,geometry_error_l1_px:score(row.source,row.observed)})),
  defect:{reference_index:p.reference_index,draft_index:p.draft_index,
   fields:changedFields,
   measured_delta:changedFields.map(field=>({field,delta_px:p.source[field]-p.observed[field]}))},
  projected_starting_geometry:projected,
  active_patch_available:true,
  original_dom_identity_verified:false,
  product_ready:false
 };
}
// Verify that our canonical standalone HTML actually reproduces the observed
// independent draft screenshot before using the projected coordinates. This
// prevents applying a patch to a different layout merely because shapes match.
export async function validateObservedGeometryInput({referenceGeometry,draftGeometry,
 draftPng,renderCandidate,maxDeltaPx=64}={}){
 if(!Buffer.isBuffer(draftPng)||typeof renderCandidate!=='function')
  throw Error('P5_ALIGNMENT_RENDER_INPUT_INVALID');
 const match=alignObservedP4Regions({referenceGeometry,draftGeometry,maxDeltaPx});
 if(match.status!=='MATCHED_ONE_OBSERVED_DEFECT')return {
  ...match,canonical_draft_verified:false,replay_count:0};
 let html;
 try{html=generateP4Reconstruction(match.projected_starting_geometry);}
 catch{return {...decline('canonical_generation_failed',
   match.reference_regions,match.draft_regions),canonical_draft_verified:false,replay_count:0};}
 let candidate;
 try{candidate=await renderCandidate(html,{attempt:0,viewport:'alignment-preflight'});}
 catch{return {...decline('canonical_replay_failed',
   match.reference_regions,match.draft_regions),canonical_draft_verified:false,replay_count:1};}
 if(!Buffer.isBuffer(candidate?.screenshot))
  return {...decline('canonical_replay_incomplete',
   match.reference_regions,match.draft_regions),canonical_draft_verified:false,replay_count:1};
 let cmp;
 try{cmp=compareChromeScreenshots(draftPng,candidate.screenshot);}
 catch{return {...decline('canonical_comparison_failed',
   match.reference_regions,match.draft_regions),canonical_draft_verified:false,replay_count:1};}
 const ok=cmp.dimensions_equal===true&&cmp.coverage_pct===100&&
  cmp.ignored_notice_area===false&&cmp.rgb_mae<=2&&cmp.pixel_match_pct>=95;
 if(!ok)return {...decline('canonical_draft_not_visually_equivalent',
  match.reference_regions,match.draft_regions),
  canonical_draft_verified:false,replay_count:1,
  draft_pixel_match_pct:cmp.pixel_match_pct??null,
  draft_rgb_mae:cmp.rgb_mae??null};
 return {...match,canonical_draft_verified:true,replay_count:1,
  draft_pixel_match_pct:cmp.pixel_match_pct,
  draft_rgb_mae:cmp.rgb_mae};
}
export async function runObservedP4GeometryRepair({referenceGeometry,draftGeometry,
 referencePng,draftPng,renderCandidate,regressionViews=[],
 maxAttempts=2,minMaeImprovement=0.3}={}){
 if(!Buffer.isBuffer(referencePng)||!Buffer.isBuffer(draftPng)||
  typeof renderCandidate!=='function')
  throw Error('P5_ALIGNMENT_INPUT_INVALID');
 const proof=await validateObservedGeometryInput({
  referenceGeometry,draftGeometry,draftPng,renderCandidate
 });
 if(proof.status!=='MATCHED_ONE_OBSERVED_DEFECT')
  return {schema_version:1,status:'STOPPED_ALIGNMENT_UNVERIFIED',
   reason:proof.reason,alignment:proof,
   accepted:0,attempts:0,product_ready:false,
   independent_chrome_verified_by_module:false};
 const correction=await runBoundedP4GeometryRepair({
  referenceGeometry,startingGeometry:proof.projected_starting_geometry,
  referencePng,renderCandidate,maxAttempts,minMaeImprovement,regressionViews
 });
 return {
  ...correction,alignment:{
   status:proof.status,canonical_draft_verified:true,
   reference_regions:proof.reference_regions,draft_regions:proof.draft_regions,
   defect:proof.defect,draft_pixel_match_pct:proof.draft_pixel_match_pct,
   draft_rgb_mae:proof.draft_rgb_mae
  },
  alignment_preflight_replays:1,
  original_site_refetched:false,product_ready:false
 };
}
