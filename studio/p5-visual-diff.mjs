import {inflateSync} from 'node:zlib';

// Offline pixel sampling only. No browser, dependencies or remote data.
// Chrome headless screenshot PNG: 8-bit non-interlaced RGB/RGBA.
export function sampleChromePng(png,{stride=8,maxPixels=6000000}={}){
 if(!Number.isInteger(stride)||stride<1||stride>64)throw Error('P5_INVALID_STRIDE');
 if(!Buffer.isBuffer(png)||png.length<32||png.length>6*1024*1024||
  !png.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')))throw Error('P5_INVALID_PNG');
 let width=0,height=0,channels=0,interlace=0;const idat=[];
 let i=8,haveHeader=false,haveEnd=false;
 while(i+12<=png.length){
  const len=png.readUInt32BE(i);const end=i+12+len;
  if(len>6*1024*1024||end>png.length)throw Error('P5_INVALID_CHUNK');
  const tag=png.toString('ascii',i+4,i+8);
  if(tag==='IHDR'){
   if(haveHeader||len!==13)throw Error('P5_INVALID_IHDR');
   haveHeader=true;width=png.readUInt32BE(i+8);height=png.readUInt32BE(i+12);
   const depth=png[i+16],type=png[i+17];interlace=png[i+20];
   if(depth!==8||![2,6].includes(type)||interlace!==0)throw Error('P5_UNSUPPORTED_PNG');
   channels=type===6?4:3;
  }else if(tag==='IDAT'){if(!haveHeader)throw Error('P5_INVALID_PNG');idat.push(png.subarray(i+8,i+8+len));}
  else if(tag==='IEND'){haveEnd=true;break;}
  i=end;
 }
 if(!haveHeader||!haveEnd||!idat.length||width<1||height<1||width*height>maxPixels)throw Error('P5_INVALID_DIMENSIONS');
 const rowBytes=width*channels,expected=(rowBytes+1)*height;
 const bytes=inflateSync(Buffer.concat(idat),{maxOutputLength:expected+1});
 if(bytes.length!==expected)throw Error('P5_INVALID_SCANLINES');
 const sampleWidth=Math.ceil(width/stride),sampleHeight=Math.ceil(height/stride);
 const data=new Uint8Array(sampleWidth*sampleHeight*3),prior=new Uint8Array(rowBytes),curr=new Uint8Array(rowBytes);
 let cursor=0,out=0;
 for(let y=0;y<height;y++){
  const filter=bytes[cursor++];
  if(filter>4)throw Error('P5_UNSUPPORTED_FILTER');
  for(let x=0;x<rowBytes;x++){
   const raw=bytes[cursor++],left=x>=channels?curr[x-channels]:0,above=prior[x],
    upperLeft=x>=channels?prior[x-channels]:0;
   let predictor=0;
   if(filter===1)predictor=left;
   else if(filter===2)predictor=above;
   else if(filter===3)predictor=Math.floor((left+above)/2);
   else if(filter===4){
    const p=left+above-upperLeft,a=Math.abs(p-left),b=Math.abs(p-above),c=Math.abs(p-upperLeft);
    predictor=a<=b&&a<=c?left:b<=c?above:upperLeft;
   }
   curr[x]=(raw+predictor)&255;
  }
  if(y%stride===0){
   for(let x=0;x<width;x+=stride){
    const at=x*channels;
    data[out++]=curr[at];data[out++]=curr[at+1];data[out++]=curr[at+2];
   }
  }
  prior.set(curr);
 }
 return {width,height,stride,sampleWidth,sampleHeight,data};
}
export function compareChromeScreenshots(reference,replica,{stride=8}={}){
 const original=sampleChromePng(reference,{stride}),generated=sampleChromePng(replica,{stride});
 const width=Math.min(original.width,generated.width),height=Math.min(original.height,generated.height);
 let sum=0,matches=0,overlapSamples=0;
 // All captured pixels are part of fidelity. Never silently exclude a hard-coded
 // area (including our own notice). If either image is cropped, the missing
 // portion counts as maximally different, not as 100% matched overlap.
 for(let y=0;y<height;y+=stride){
  for(let x=0;x<width;x+=stride){
   const ia=((y/stride)*original.sampleWidth+x/stride)*3,
    ib=((y/stride)*generated.sampleWidth+x/stride)*3;
   const delta=(Math.abs(original.data[ia]-generated.data[ib])+
    Math.abs(original.data[ia+1]-generated.data[ib+1])+
    Math.abs(original.data[ia+2]-generated.data[ib+2]))/3;
   sum+=delta;matches+=delta<=18?1:0;overlapSamples++;
  }
 }
 const totalSamples=Math.max(original.sampleWidth,generated.sampleWidth)*
  Math.max(original.sampleHeight,generated.sampleHeight);
 if(overlapSamples===0||totalSamples<=0)throw Error('P5_NO_SAMPLES');
 const missingSamples=totalSamples-overlapSamples;
 sum+=missingSamples*255;
 return {
  schema_version:2,method:'downsampled-rgb-mae-union-penalized',
  status:'measured-not-certified',
  source:'original-static-visual-vs-scriptless-reconstruction',
  original:{width:original.width,height:original.height},
  reconstructed:{width:generated.width,height:generated.height},
  dimensions_equal:original.width===generated.width&&original.height===generated.height,
  overlap_area_pct:Number((width*height/
   Math.max(original.width*original.height,generated.width*generated.height)*100).toFixed(2)),
  coverage_pct:Number((overlapSamples/totalSamples*100).toFixed(2)),
  rgb_mae:Number((sum/totalSamples).toFixed(2)),
  pixel_match_pct:Number((matches/totalSamples*100).toFixed(2)),
  sample_count:totalSamples,overlap_sample_count:overlapSamples,
  missing_sample_count:missingSamples,
  missing_area_rgb_penalty:255,
  match_rgb_threshold:18,downsample_stride:stride,
  ignored_notice_area:false,
  interpretation:'Full canvas static pixel comparison. Missing/cropped areas incur maximum mismatch. No chart data, JS interactions, API functionality or full reconstruction verified'
 };
}

/**
 * Quality gate for visual evidence, NOT a product completion certificate.
 * A good screenshot cannot establish data, behavior, server or UI equivalence.
 */
export function evaluateStaticVisualGate(comparison,{minMatchPct=90,maxRgbMae=20,
 minCoveragePct=100,minRegionMatchPct=70}={}){
 const config=[minMatchPct,maxRgbMae,minCoveragePct,minRegionMatchPct];
 if(config.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>100))
  throw Error('P5_INVALID_QUALITY_THRESHOLD');
 const reasons=[];
 if(comparison?.status!=='measured-not-certified')
  reasons.push('visual_measurement_unavailable');
 else {
  if(comparison.dimensions_equal!==true)reasons.push('canvas_dimensions_differ');
  if(!Number.isFinite(comparison.coverage_pct)||comparison.coverage_pct<minCoveragePct)
   reasons.push('canvas_coverage_incomplete');
  if(!Number.isFinite(comparison.pixel_match_pct)||comparison.pixel_match_pct<minMatchPct)
   reasons.push('pixel_similarity_below_threshold');
  if(!Number.isFinite(comparison.rgb_mae)||comparison.rgb_mae>maxRgbMae)
   reasons.push('color_error_above_threshold');
  if(comparison.ignored_notice_area!==false)
   reasons.push('unverified_region_exclusion');
  const geometry=comparison.geometry;
  if(geometry?.status!=='measured-not-certified'||
     !Number.isFinite(geometry.region_match_pct)||geometry.region_match_pct<minRegionMatchPct)
   reasons.push('geometry_evidence_or_match_insufficient');
 }
 return {
  schema_version:1,
  status:reasons.length?'VISUAL_GATE_BLOCKED':'VISUAL_THRESHOLD_MET_STATIC_ONLY',
  reasons,thresholds:{min_pixel_match_pct:minMatchPct,max_rgb_mae:maxRgbMae,
   min_canvas_coverage_pct:minCoveragePct,min_region_match_pct:minRegionMatchPct},
  independent_chrome_measurement_required:true,
  functional_equivalence_verified:false,
  backend_equivalence_verified:false,
  autonomous_repair_verified:false,
  product_ready:false,
  note:'Passing static screenshot and geometry thresholds is not evidence of behavior, API, data or autonomous repair parity'
 };
}
