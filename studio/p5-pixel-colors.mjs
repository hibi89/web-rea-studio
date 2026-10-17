import {sampleChromePng} from './p5-visual-diff.mjs';
import {sanitizeP4Geometry} from './p4-reconstruction.mjs';

// Pixel inference is deliberately restricted to large, nearly uniform,
// already-observed painted rectangles. Titles and overlapping children are
// not sampled. Never export source pixel buffers, text, URLs or raw image data.
const inside=(x,y,b)=>x>=b.x&&y>=b.y&&x<b.x+b.w&&y<b.y+b.h;
const parseRgb=s=>{
 if(typeof s!=='string')return null;
 const m=/^rgb\(\s*(\d{1,3}),\s*(\d{1,3}),\s*(\d{1,3})\s*\)$/.exec(s);
 if(!m)return null;
 const rgb=m.slice(1).map(Number);
 return rgb.every(n=>n>=0&&n<=255)?rgb:null;
};
const distance=(a,b)=>(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2]))/3;
function colorMode(samples){
 const histogram=new Map();
 for(const rgb of samples){
  const key=rgb.map(n=>n>>3).join(':');
  let bucket=histogram.get(key);
  if(!bucket){bucket={count:0,values:new Map()};histogram.set(key,bucket);}
  bucket.count++;
  const exact=rgb.join(',');
  bucket.values.set(exact,(bucket.values.get(exact)||0)+1);
 }
 const leading=[...histogram.values()].sort((a,b)=>b.count-a.count)[0];
 if(!leading)return null;
 const exact=[...leading.values.entries()].sort((a,b)=>b[1]-a[1])[0];
 return {rgb:exact[0].split(',').map(Number),fraction:leading.count/samples.length,count:samples.length};
}
export function proposeScreenshotRegionColor({referenceGeometry,currentGeometry,
 referencePng,baselinePng,stride=8}={}){
 if(!Buffer.isBuffer(referencePng)||!Buffer.isBuffer(baselinePng))
  throw Error('P5_PIXEL_INPUT_MISSING');
 if(![4,8,16].includes(stride))throw Error('P5_PIXEL_STRIDE_INVALID');
 const ref=sanitizeP4Geometry(referenceGeometry),cur=sanitizeP4Geometry(currentGeometry);
 if(!ref||!cur||ref.boxes.length!==cur.boxes.length||
   ref.document.width!==cur.document.width||ref.document.height!==cur.document.height||
   ref.viewport.width!==cur.viewport.width)
  throw Error('P5_PIXEL_GEOMETRY_MISMATCH');
 for(let i=0;i<ref.boxes.length;i++){
  const a=ref.boxes[i],b=cur.boxes[i];
  if(a.tag!==b.tag||a.depth!==b.depth||a.x!==b.x||a.y!==b.y||a.w!==b.w||a.h!==b.h)
   throw Error('P5_PIXEL_GEOMETRY_MISMATCH');
 }
 const a=sampleChromePng(referencePng,{stride});
 const b=sampleChromePng(baselinePng,{stride});
 if(a.width!==b.width||a.height!==b.height||
    a.width!==cur.document.width||a.height!==cur.document.height||
    a.sampleWidth!==b.sampleWidth||a.sampleHeight!==b.sampleHeight)
  return null;
 const ranked=ref.boxes.map((v,i)=>({v,i})).filter(({v})=>
  v.tag!=='body'&&v.background!=='transparent'&&v.w>=110&&v.h>=88&&
  parseRgb(v.background)!==null&&v.x>=0&&v.y>=0&&v.x+v.w<=a.width&&v.y+v.h<=a.height)
  .sort((x,y)=>x.v.w*x.v.h-y.v.w*y.v.h).slice(0,40);
 for(const {v,i} of ranked){
  const inset=Math.max(12,Math.floor(Math.min(v.w,v.h)*.12));
  const originals=[],replays=[];
  const others=ref.boxes.filter((o,j)=>j!==i&&
   (o.depth>v.depth||o.w*o.h<v.w*v.h)&&o.background!=='transparent');
  for(let sy=0;sy<a.sampleHeight;sy++){
   const y=sy*stride;
   if(y<v.y+inset||y>=v.y+v.h-inset)continue;
   for(let sx=0;sx<a.sampleWidth;sx++){
    const x=sx*stride;
    if(x<v.x+inset||x>=v.x+v.w-inset)continue;
    if(ref.titles.some(t=>inside(x,y,t))||others.some(o=>inside(x,y,o)))continue;
    const at=(sy*a.sampleWidth+sx)*3;
    originals.push([a.data[at],a.data[at+1],a.data[at+2]]);
    replays.push([b.data[at],b.data[at+1],b.data[at+2]]);
   }
  }
  if(originals.length<20)continue;
  const orig=colorMode(originals),prev=colorMode(replays);
  // Both reference and replay must have the SAME mostly uniform, unobscured
  // footprint. Otherwise this is not sufficient evidence to edit CSS.
  if(!orig||!prev||orig.fraction<.88||prev.fraction<.88||
    distance(orig.rgb,prev.rgb)<24)continue;
  const existing=parseRgb(cur.boxes[i].background);
  if(!existing||distance(orig.rgb,existing)<4)continue;
  const color='rgb('+orig.rgb.join(', ')+')';
  const boxes=cur.boxes.map((box,index)=>index===i?{...box,background:color}:box);
  return {
   patch:{kind:'screenshot-uniform-region-color',region_index:i,
    evidence:'local-original-vs-replay-uniform-interior',
    sampled_pixels:orig.count,
    reference_uniform_pct:Number((orig.fraction*100).toFixed(2)),
    replica_uniform_pct:Number((prev.fraction*100).toFixed(2)),
    measured_rgb_gap:Number(distance(orig.rgb,prev.rgb).toFixed(2))},
   geometry:{...cur,boxes}
  };
 }
 return null;
}
