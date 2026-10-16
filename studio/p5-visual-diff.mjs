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
 let sum=0,matches=0,count=0;
 // The P4 independent output has a fixed explanatory notice in the bottom
 // right that is not part of the original website. Exclude that one area.
 for(let y=0;y<height;y+=stride){
  for(let x=0;x<width;x+=stride){
   if(generated.width>800&&generated.height>160&&x>=generated.width-400&&y>=generated.height-80)continue;
   const ia=((y/stride)*original.sampleWidth+x/stride)*3,
    ib=((y/stride)*generated.sampleWidth+x/stride)*3;
   const delta=(Math.abs(original.data[ia]-generated.data[ib])+
    Math.abs(original.data[ia+1]-generated.data[ib+1])+
    Math.abs(original.data[ia+2]-generated.data[ib+2]))/3;
   sum+=delta;matches+=delta<=18?1:0;count++;
  }
 }
 if(count===0)throw Error('P5_NO_SAMPLES');
 return {
  schema_version:1,method:'downsampled-rgb-mae',status:'measured-not-certified',
  source:'original-static-visual-vs-scriptless-reconstruction',
  original:{width:original.width,height:original.height},
  reconstructed:{width:generated.width,height:generated.height},
  dimensions_equal:original.width===generated.width&&original.height===generated.height,
  overlap_area_pct:Number((width*height/Math.max(original.width*original.height,generated.width*generated.height)*100).toFixed(2)),
  rgb_mae:Number((sum/count).toFixed(2)),
  pixel_match_pct:Number((matches/count*100).toFixed(2)),
  sample_count:count,match_rgb_threshold:18,downsample_stride:stride,
  ignored_notice_area:true,
  interpretation:'Pixel similarity of static evidence only; no chart data, JS interactions, API functionality or full reconstruction verified'
 };
}
