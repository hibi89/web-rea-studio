import {sanitizeP4Geometry} from './p4-reconstruction.mjs';

// Compare evidence from two independent DOM captures, not source elements.
export function compareP4Geometry(reference,reconstruction,{tolerancePx=8}={}){
 const a=sanitizeP4Geometry(reference),b=sanitizeP4Geometry(reconstruction);
 if(!a||!b||!a.boxes.length||!b.boxes.length)return {
  status:'unavailable',reason:'geometry-evidence-missing'};
 if(!Number.isInteger(tolerancePx)||tolerancePx<1||tolerancePx>50)throw Error('P5_INVALID_TOLERANCE');
 const used=new Set(),measure=[],color=[];
 // Largest painted shapes first; tag names are intentionally ignored because
 // the independent HTML uses safe div regions instead of source DOM elements.
 const shapes=[...a.boxes].sort((x,y)=>y.w*y.h-x.w*x.h);
 for(const original of shapes){
  let best=null;
  for(let i=0;i<b.boxes.length;i++){
   if(used.has(i))continue;
   const next=b.boxes[i],distance=(Math.abs(original.x-next.x)+Math.abs(original.y-next.y)+
    Math.abs(original.w-next.w)+Math.abs(original.h-next.h))/4;
   if(best===null||distance<best.distance)best={index:i,distance};
  }
  if(best&&best.distance<=tolerancePx){
   used.add(best.index);
   measure.push(best.distance);
   const replica=b.boxes[best.index];
   color.push(original.background===replica.background?1:0);
  }
 }
 return {
  status:'measured-not-certified',tolerance_px:tolerancePx,
  original_regions:a.boxes.length,reconstructed_regions:b.boxes.length,
  matched_regions:measure.length,
  region_match_pct:Number((measure.length/a.boxes.length*100).toFixed(2)),
  average_geometry_error_px:measure.length?
   Number((measure.reduce((x,y)=>x+y,0)/measure.length).toFixed(2)):null,
  exact_background_match_pct:color.length?
   Number((color.reduce((x,y)=>x+y,0)/color.length*100).toFixed(2)):null,
  comparison_basis:'bounded rectangle positions/sizes and exact computed background colors, without original element identity',
  limitations:['DOM tags, nesting, text wrapping and interaction semantics are not matched']
 };
}
