import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {sampleChromePng,compareChromeScreenshots,evaluateStaticVisualGate} from '../studio/p5-visual-diff.mjs';

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
 assert.equal(result.pixel_match_pct,66.67);
 assert.equal(result.coverage_pct,66.67);
 assert.equal(result.missing_sample_count,2);
 assert.equal(result.rgb_mae,85);
 assert.equal(result.ignored_notice_area,false);
});

test('P5 refuses to silently reward a truncated or missing screenshot region',()=>{
 const complete=samplePng({width:40,height:40,color:[240,245,255]});
 const cropped=samplePng({width:40,height:8,color:[240,245,255]});
 const compare=compareChromeScreenshots(complete,cropped);
 assert.equal(compare.dimensions_equal,false);
 assert.equal(compare.overlap_area_pct,20);
 assert.equal(compare.pixel_match_pct,20);
 assert.equal(compare.coverage_pct,20);
 assert.equal(compare.rgb_mae,204);
 assert.equal(compare.missing_sample_count,20);
 assert.equal(compare.sample_count,25);
});

test('P5 static quality gate requires complete canvas AND geometry evidence, never certifies product',()=>{
 const png=samplePng({width:32,height:32});
 const base=compareChromeScreenshots(png,png);
 const geometry={status:'measured-not-certified',region_match_pct:100};
 const good=evaluateStaticVisualGate({...base,geometry});
 assert.equal(good.status,'VISUAL_THRESHOLD_MET_STATIC_ONLY');
 assert.deepEqual(good.reasons,[]);
 assert.equal(good.product_ready,false);
 assert.equal(good.functional_equivalence_verified,false);
 assert.equal(good.autonomous_repair_verified,false);
 const cropped=compareChromeScreenshots(png,samplePng({width:32,height:8}));
 const blocked=evaluateStaticVisualGate({...cropped,geometry});
 assert.equal(blocked.status,'VISUAL_GATE_BLOCKED');
 assert.ok(blocked.reasons.includes('canvas_dimensions_differ'));
 assert.ok(blocked.reasons.includes('canvas_coverage_incomplete'));
 assert.ok(blocked.reasons.includes('pixel_similarity_below_threshold'));
 const noGeometry=evaluateStaticVisualGate(base);
 assert.equal(noGeometry.status,'VISUAL_GATE_BLOCKED');
 assert.ok(noGeometry.reasons.includes('geometry_evidence_or_match_insufficient'));
 const mask=evaluateStaticVisualGate({...base,geometry,ignored_notice_area:true});
 assert.ok(mask.reasons.includes('unverified_region_exclusion'));
 assert.throws(()=>evaluateStaticVisualGate({...base,geometry},{minMatchPct:101}),/P5_INVALID_QUALITY_THRESHOLD/);
});

test('P5 rejects corrupt PNG, malicious dimensions and unsupported pixel formats',()=>{
 assert.throws(()=>sampleChromePng(Buffer.from('invalid')),/P5_INVALID_PNG/);
 const huge=samplePng();huge.writeUInt32BE(1000000,16);
 assert.throws(()=>sampleChromePng(huge),/P5_INVALID_DIMENSIONS/);
 const indexed=samplePng();indexed[25]=3;
 assert.throws(()=>sampleChromePng(indexed),/P5_UNSUPPORTED_PNG/);
});
