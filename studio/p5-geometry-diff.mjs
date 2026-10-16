import {sanitizeP4Geometry} from './p4-reconstruction.mjs';

// Compare evidence from two independent DOM captures, not source elements.
export function visuallyDistinctRegions(regions){
 return regions.filter((region,index)=>{
  // A flat same-color nested wrapper has no independently observable paint.
  // It is still part of the DOM, but cannot be called a missing visual card.
  if(parseFloat(region.border_width)>0||parseFloat(region.radius)>0)return true;
  if(region.background==='transparent'||/^rgba?\(0,\s*0,\s*0,\s*0\)$/.test(region.background))return false;
  return !regions.some((outer,j)=>j!==index&&outer.background===region.background&&
   outer.w*outer.h>region.w*region.h&&outer.x<=region.x&&outer.y<=region.y&&
   outer.x+outer.w>=region.x+region.w&&outer.y+outer.h>=region.y+region.h);
 });
}
export function compareP4Geometry(reference,reconstruction,{tolerancePx=8}={}){
 const a=sanitizeP4Geometry(reference),b=sanitizeP4Geometry(reconstruction);
 if(!a||!b||!a.boxes.length||!b.boxes.length)return {
  status:'unavailable',reason:'geometry-evidence-missing'};
 if(!Number.isInteger(tolerancePx)||tolerancePx<1||tolerancePx>50)throw Error('P5_INVALID_TOLERANCE');
 const referenceRegions=visuallyDistinctRegions(a.boxes),replayRegions=visuallyDistinctRegions(b.boxes);
 if(!referenceRegions.length||!replayRegions.length)return {status:'unavailable',reason:'no-visible-painted-regions'};
 const used=new Set(),measure=[],color=[],unmatched=[];
 // Largest painted shapes first; tag names are intentionally ignored because
 // the independent HTML uses safe div regions instead of source DOM elements.
 const shapes=[...referenceRegions].sort((x,y)=>y.w*y.h-x.w*x.h);
 for(const original of shapes){
  let best=null;
  for(let i=0;i<replayRegions.length;i++){
   if(used.has(i))continue;
   const next=replayRegions[i],distance=(Math.abs(original.x-next.x)+Math.abs(original.y-next.y)+
    Math.abs(original.w-next.w)+Math.abs(original.h-next.h))/4;
   if(best===null||distance<best.distance)best={index:i,distance};
  }
  if(best&&best.distance<=tolerancePx){
   used.add(best.index);
   measure.push(best.distance);
   const replica=replayRegions[best.index];
   color.push(original.background===replica.background?1:0);
  }else if(unmatched.length<12){
   // Only geometry and element category; no text, selector or source path.
   unmatched.push({tag:original.tag,x:original.x,y:original.y,
    width:original.w,height:original.h,nearest_error_px:best?Number(best.distance.toFixed(2)):null});
  }
 }
 return {
  status:'measured-not-certified',tolerance_px:tolerancePx,
  original_regions:referenceRegions.length,reconstructed_regions:replayRegions.length,
  original_dom_regions:a.boxes.length,reconstructed_dom_regions:b.boxes.length,
  ignored_same_color_wrappers:a.boxes.length-referenceRegions.length,
  matched_regions:measure.length,
  unmatched_reference_regions:unmatched,
  region_match_pct:Number((measure.length/referenceRegions.length*100).toFixed(2)),
  average_geometry_error_px:measure.length?
   Number((measure.reduce((x,y)=>x+y,0)/measure.length).toFixed(2)):null,
  exact_background_match_pct:color.length?
   Number((color.reduce((x,y)=>x+y,0)/color.length*100).toFixed(2)):null,
  comparison_basis:'visually distinct painted rectangles (nested same-color flat wrappers excluded), without original element identity',
  limitations:['Nested flat same-color wrappers are not counted as independently visible regions','DOM tags, text wrapping and interaction semantics are not matched']
 };
}
