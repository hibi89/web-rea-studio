import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {proposeScreenshotRegionColor} from '../studio/p5-pixel-colors.mjs';

const W=360,H=256;
const region={tag:'aside',depth:2,x:20,y:20,w:160,h:180,
 background:'rgb(0, 0, 0)',border_width:'0px',radius:'0px'};
function geometry(){
 return {source:'p4-geometry',viewport:{width:W,height:H},document:{height:H},
  background:'rgb(235, 235, 235)',boxes:[structuredClone(region)],titles:[]};
}
function png(color,{pattern=false}={}){
 const rows=[];
 for(let y=0;y<H;y++){
  const row=Buffer.alloc(1+W*3);
  for(let x=0;x<W;x++){
   const inside=x>=20&&x<180&&y>=20&&y<200;
   const rgb=inside?(pattern&&(x+y)%2===0?[18,190,200]:color):[235,235,235];
   for(let ch=0;ch<3;ch++)row[1+x*3+ch]=rgb[ch];
  }
  rows.push(row);
 }
 const chunk=(tag,b)=>{const header=Buffer.alloc(8);header.writeUInt32BE(b.length);header.write(tag,4);
  return Buffer.concat([header,b,Buffer.alloc(4)]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]);
}
const input=(overrides={})=>({referenceGeometry:geometry(),currentGeometry:geometry(),
 referencePng:png([55,170,215]),baselinePng:png([0,0,0]),...overrides});
test('strong uniform screenshot disagreement proposes a single bounded color edit',()=>{
 const p=proposeScreenshotRegionColor(input());
 assert.equal(p.patch.kind,'screenshot-uniform-region-color');
 assert.equal(p.patch.region_index,0);
 assert.ok(p.patch.sampled_pixels>=20);
 assert.ok(p.patch.reference_uniform_pct>=88);
 assert.ok(p.patch.replica_uniform_pct>=88);
 assert.equal(p.geometry.boxes[0].background,'rgb(55, 170, 215)');
 assert.equal(geometry().boxes[0].background,'rgb(0, 0, 0)');
 assert.doesNotMatch(JSON.stringify(p),/http|token|password|pixel_buffer/);
});
test('rejects unchanged pixels, gradients and insufficient paint evidence',()=>{
 assert.equal(proposeScreenshotRegionColor(input({baselinePng:png([55,170,215])})),null);
 assert.equal(proposeScreenshotRegionColor(input({referencePng:png([55,170,215],{pattern:true})})),null);
 assert.equal(proposeScreenshotRegionColor(input({baselinePng:png([0,0,0],{pattern:true})})),null);
 const narrow=geometry();narrow.boxes[0].w=90;
 assert.equal(proposeScreenshotRegionColor(input({referenceGeometry:narrow,currentGeometry:narrow})),null);
 const blocked=geometry();
 blocked.titles=[{tag:'h1',x:20,y:20,w:160,h:180,text:'private',
  color:'rgb(0,0,0)',font_size:'14px',font_weight:'700'}];
 assert.equal(proposeScreenshotRegionColor(input({referenceGeometry:blocked,currentGeometry:blocked})),null);
});
test('fails closed on inconsistent geometry and crop without guessing',()=>{
 const bad=geometry();bad.boxes[0].x=40;
 assert.throws(()=>proposeScreenshotRegionColor(input({currentGeometry:bad})),/P5_PIXEL_GEOMETRY_MISMATCH/);
 const crop=png([0,0,0]);crop.writeUInt32BE(200,20);
 assert.throws(()=>proposeScreenshotRegionColor(input({baselinePng:crop})));
 assert.throws(()=>proposeScreenshotRegionColor(input({stride:3})),/P5_PIXEL_STRIDE_INVALID/);
});
