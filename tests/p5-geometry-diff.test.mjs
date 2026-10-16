import test from 'node:test';
import assert from 'node:assert/strict';
import {compareP4Geometry} from '../studio/p5-geometry-diff.mjs';

const geom=()=>{
 const rect=(tag,x,y,w,h,color)=>({tag,depth:3,x,y,w,h,
  background:color,border_width:'0px',radius:'0px'});
 return {source:'p4-geometry',viewport:{width:1440,height:900},document:{height:900},
  body_color:'rgb(250, 250, 250)',boxes:[
   rect('aside',0,0,200,900,'rgb(255, 255, 255)'),
   rect('section',225,160,390,300,'rgb(255, 255, 255)')],titles:[]};
};
test('P5 geometry similarity ignores source tags but verifies rectangle and color fidelity',()=>{
 const original=geom(),replica=geom();
 replica.boxes[0].tag='div';replica.boxes[1].tag='div';
 const result=compareP4Geometry(original,replica);
 assert.equal(result.region_match_pct,100);
 assert.equal(result.average_geometry_error_px,0);
 assert.equal(result.exact_background_match_pct,100);
 assert.equal(result.matched_regions,2);
 assert.equal(result.status,'measured-not-certified');
});
test('P5 geometry mismatch reveals one moved card and separately reports color difference',()=>{
 const original=geom(),replica=geom();
 replica.boxes[1].x+=100;
 replica.boxes[0].background='rgb(0, 0, 0)';
 const result=compareP4Geometry(original,replica);
 assert.equal(result.region_match_pct,50);
 assert.equal(result.matched_regions,1);
 assert.equal(result.exact_background_match_pct,0);
 assert.equal(result.original_regions,2);
});
test('P5 geometry comparator fails safely if evidence is missing or tolerance invalid',()=>{
 assert.equal(compareP4Geometry(geom(),null).status,'unavailable');
 assert.equal(compareP4Geometry(geom(),{source:'p4-geometry',boxes:[]}).status,'unavailable');
 assert.throws(()=>compareP4Geometry(geom(),geom(),{tolerancePx:0}),/P5_INVALID_TOLERANCE/);
});
