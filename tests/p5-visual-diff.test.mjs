import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {sampleChromePng,compareChromeScreenshots} from '../studio/p5-visual-diff.mjs';

function samplePng({width=24,height=16,channels=3,color=[240,245,255]}={}){
 const rows=[];
 for(let y=0;y<height;y++){
  const row=Buffer.alloc(width*channels+1);row[0]=0;
  for(let x=0;x<width;x++)for(let c=0;c<channels;c++)
   row[1+x*channels+c]=color[c]??255;
  rows.push(row);
 }
 const pngChunk=(name,body)=>{const header=Buffer.alloc(8);
  header.writeUInt32BE(body.length);header.write(name,4,4,'ascii');
  return Buffer.concat([header,body,Buffer.alloc(4)]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
 ihdr[8]=8;ihdr[9]=channels===3?2:6;
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),pngChunk('IHDR',ihdr),
  pngChunk('IDAT',deflateSync(Buffer.concat(rows))),pngChunk('IEND',Buffer.alloc(0))]);
}
test('P5 pixel comparison reports exact match separately from actual app fidelity',()=>{
 const img=samplePng();
 const outcome=compareChromeScreenshots(img,img);
 assert.equal(outcome.status,'measured-not-certified');
 assert.equal(outcome.pixel_match_pct,100);
 assert.equal(outcome.rgb_mae,0);
 assert.equal(outcome.dimensions_equal,true);
 assert.equal(outcome.source,'original-static-visual-vs-scriptless-reconstruction');
 assert.ok(outcome.sample_count>0);
 assert.match(outcome.interpretation,/no chart data/);
});
test('P5 pixel error and threshold correctly distinguish a large color difference',()=>{
 const bright=samplePng({color:[255,255,255]}),
  dark=samplePng({color:[0,0,0]});
 const m=compareChromeScreenshots(bright,dark);
 assert.equal(m.rgb_mae,255);
 assert.equal(m.pixel_match_pct,0);
});
test('P5 accepts Chrome RGBA and RGB 8-bit evidence',()=>{
 const rgb=samplePng({channels:3}),rgba=samplePng({channels:4,color:[240,245,255,255]});
 assert.deepEqual(sampleChromePng(rgb).data,sampleChromePng(rgba).data);
 assert.equal(compareChromeScreenshots(rgb,rgba).pixel_match_pct,100);
});
test('P5 correctly exposes screenshot size differences and overlap area',()=>{
 const small=samplePng({width:16,height:16}),large=samplePng({width:24,height:16});
 const result=compareChromeScreenshots(small,large);
 assert.equal(result.dimensions_equal,false);
 assert.equal(result.overlap_area_pct,66.67);
 assert.equal(result.pixel_match_pct,100);
});
test('P5 rejects corrupt PNG, malicious dimensions and unsupported pixel formats',()=>{
 assert.throws(()=>sampleChromePng(Buffer.from('invalid')),/P5_INVALID_PNG/);
 const huge=samplePng();huge.writeUInt32BE(100000,16);
 assert.throws(()=>sampleChromePng(huge),/P5_INVALID_DIMENSIONS/);
 const indexed=samplePng();indexed[25]=3;
 assert.throws(()=>sampleChromePng(indexed),/P5_UNSUPPORTED_PNG/);
});
