// Offline-only, independent verifier for the fixed REA two-entry ZIP32 bundle.
// No imports from the ZIP writer, no browser, external network or file extraction.
import {createHash} from 'node:crypto';
import {open,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const NAMES=['rea-verified-synthetic-offline-only.html','rea-two-viewport-acceptance.json'];
const LIMIT=256*1024, MAX=2*LIMIT+4096, HASH=/^[0-9a-f]{64}$/;
const TOP=['schema_version','kind','status','scope','html_sha256','evidence_sha256','views',
 'permission_status','external_requests','actions_executed','original_site_refetched',
 'original_site_parity_verified','original_mobile_layout_verified','product_ready','digitally_signed'];
const VIEW=['width','height','screenshot_width','screenshot_height','status','columns',
 'zones','horizontal_overflow','native_controls','external_requests','scripts_executed'];
const digest=v=>createHash('sha256').update(v).digest('hex');
const reject=(reason)=>{throw Object.assign(new Error(reason),{code:'OFFLINE_ZIP_INVALID',reason});};
const eqKeys=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===keys.length&&keys.every((k,i)=>Object.keys(o)[i]===k);
const same=(v,x)=>v===x;
const CRC_TABLE=Array.from({length:256},(_,i)=>{let c=i;for(let j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=CRC_TABLE[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
function readString(b,start,len){
 try{return new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(start,start+len));}
 catch{return reject('NON_UTF8_PAYLOAD');}
}
function checkReceipt(r,raw,html){
 if(!eqKeys(r,TOP)||raw!==JSON.stringify(r,null,2)+'\n'||
  r.schema_version!==1||r.kind!=='rea-anonymous-two-viewport-acceptance'||
  r.status!=='VERIFIED_SYNTHETIC_LAYOUT_ONLY'||r.scope!=='saved-anonymous-html-only'||
  !HASH.test(r.html_sha256)||r.html_sha256!==digest(html)||
  !HASH.test(r.evidence_sha256)||r.permission_status!=='NOT_APPROVED'||
  r.external_requests!==0||r.actions_executed!==0||r.original_site_refetched!==false||
  r.original_site_parity_verified!==false||r.original_mobile_layout_verified!==false||
  r.product_ready!==false||r.digitally_signed!==false||
  !Array.isArray(r.views)||r.views.length!==2)reject('RECEIPT_MISMATCH');
 for(let i=0;i<2;i++){
  const v=r.views[i],width=i===0?1440:390,height=i===0?900:844;
  if(!eqKeys(v,VIEW)||v.width!==width||v.height!==height||
   v.screenshot_width!==width||!Number.isSafeInteger(v.screenshot_height)||
   v.screenshot_height<height||v.screenshot_height>5000||
   v.status!=='PASS_GENERATED_OFFLINE_LAYOUT'||v.columns!==(i===0?3:1)||
   v.zones!==9||v.horizontal_overflow!==false||v.native_controls!==0||
   v.external_requests!==0||v.scripts_executed!==false)reject('VIEWPORT_RECEIPT_MISMATCH');
 }
}
export function verifyOfflineBundle(input,{expectedBundleSha256}={}){
 if(!Buffer.isBuffer(input)||input.length<22||input.length>MAX)reject('BUNDLE_SIZE_OR_TYPE');
 if(expectedBundleSha256!==undefined&&
  (!HASH.test(expectedBundleSha256)||digest(input)!==expectedBundleSha256))
  reject('EXPECTED_BUNDLE_SHA256_MISMATCH');
 const b=input, end=b.length-22, u16=p=>b.readUInt16LE(p),u32=p=>b.readUInt32LE(p);
 if(u32(end)!==0x06054b50||u16(end+4)!==0||u16(end+6)!==0||
  u16(end+8)!==2||u16(end+10)!==2||u16(end+20)!==0)
  reject('ZIP_END_RECORD');
 const centralSize=u32(end+12),centralStart=u32(end+16);
 if(centralStart===0||centralStart+centralSize!==end||centralSize>4096)
  reject('ZIP_CENTRAL_BOUNDS');
 let cursor=centralStart;const entries=[];
 for(let i=0;i<2;i++){
  if(cursor+46> end||u32(cursor)!==0x02014b50)reject('ZIP_CENTRAL_ENTRY');
  const nameLength=u16(cursor+28),extra=u16(cursor+30),comment=u16(cursor+32);
  const total=46+nameLength+extra+comment;
  if(cursor+total>end||nameLength!==Buffer.byteLength(NAMES[i],'ascii')||
   extra!==0||comment!==0||u16(cursor+4)!==20||u16(cursor+6)!==20||
   u16(cursor+8)!==0||u16(cursor+10)!==0||u16(cursor+12)!==0||
   u16(cursor+14)!==33||u16(cursor+34)!==0||
   u16(cursor+36)!==0||u32(cursor+38)!==0||
   u32(cursor+20)!==u32(cursor+24)||u32(cursor+24)===0||
   u32(cursor+24)>LIMIT)reject('ZIP_CENTRAL_FIELDS');
  const name=b.subarray(cursor+46,cursor+46+nameLength).toString('ascii');
  if(name!==NAMES[i])reject('ZIP_UNEXPECTED_PATH');
  entries.push({name,offset:u32(cursor+42),crc:u32(cursor+16),length:u32(cursor+24)});
  cursor+=total;
 }
 if(cursor!==end)reject('ZIP_CENTRAL_EXTRA_ENTRY');
 let local=0;const contents=[];
 for(let i=0;i<2;i++){
  const e=entries[i];
  if(e.offset!==local||local+30>centralStart||u32(local)!==0x04034b50)
   reject('ZIP_LOCAL_ENTRY');
  const nameLen=u16(local+26),extra=u16(local+28);
  const start=local+30+nameLen+extra,stop=start+e.length;
  if(u16(local+4)!==20||u16(local+6)!==0||u16(local+8)!==0||
   u16(local+10)!==0||u16(local+12)!==33||extra!==0||
   nameLen!==Buffer.byteLength(e.name,'ascii')||stop>centralStart||
   u32(local+14)!==e.crc||u32(local+18)!==e.length||
   u32(local+22)!==e.length||
   b.subarray(local+30,local+30+nameLen).toString('ascii')!==e.name)
   reject('ZIP_LOCAL_CENTRAL_CONFLICT');
  const bytes=b.subarray(start,stop);
  if(crc32(bytes)!==e.crc)reject('ZIP_CRC32_MISMATCH');
  contents.push(bytes);local=stop;
 }
 if(local!==centralStart)reject('ZIP_UNREFERENCED_DATA');
 const html=readString(contents[0],0,contents[0].length);
 if(!html.startsWith('<!doctype html><html lang="en">')||
  !html.includes('<title>REA Coarse Presence Zones — NOT A REPLICA</title>')||
  !html.includes('Anonymous coarse presence zones')||
  /<\s*(script|iframe|object|embed|form|button|input|select|textarea|a|link|img)\b/i.test(html)||
  /\bon[a-z]+\s*=|javascript:|https?:\/\//i.test(html))
  reject('HTML_NOT_ANONYMOUS_STATIC');
 const raw=readString(contents[1],0,contents[1].length);
 let receipt;try{receipt=JSON.parse(raw);}catch{reject('INVALID_RECEIPT_JSON');}
 checkReceipt(receipt,raw,contents[0]);
 return {status:'VALID_SYNTHETIC_OFFLINE_BUNDLE',file_count:2,
  bundle_sha256:digest(b),html_sha256:digest(contents[0]),
  evidence_sha256:receipt.evidence_sha256,verification_scope:'synthetic-offline-only',
  source_authenticity_verified:false,original_site_parity_verified:false,
  original_mobile_layout_verified:false,product_ready:false};
}
// Bound disk input before allocation and read only the inspected file descriptor.
// Reject directories, special files and symlinks; never follow untrusted ZIP paths.
async function readBoundedFile(path){
 const initial=await lstat(path);
 if(!initial.isFile())reject('BUNDLE_NOT_REGULAR_FILE');
 if(!Number.isSafeInteger(initial.size)||initial.size<22||initial.size>MAX)
  reject('BUNDLE_SIZE_OR_TYPE');
 const handle=await open(path,'r');
 try{
  const st=await handle.stat();
  if(!st.isFile())reject('BUNDLE_NOT_REGULAR_FILE');
  if(!Number.isSafeInteger(st.size)||st.size<22||st.size>MAX)
   reject('BUNDLE_SIZE_OR_TYPE');
  const bytes=Buffer.alloc(st.size);
  let offset=0;
  while(offset<bytes.length){
   const {bytesRead}=await handle.read(bytes,offset,bytes.length-offset,offset);
   if(bytesRead===0)reject('BUNDLE_CHANGED_WHILE_READING');
   offset+=bytesRead;
  }
  // Detect concurrent growth after the size check without allocating further.
  const extra=await handle.read(Buffer.alloc(1),0,1,offset);
  if(extra.bytesRead!==0)reject('BUNDLE_CHANGED_WHILE_READING');
  return bytes;
 }finally{await handle.close();}
}
async function main(args){
 const usage='Usage: node scripts/verify-offline-bundle.mjs <zip-path> [--expected-zip-sha256 <64-lowercase-hex>]';
 if(args.length!==1&&args.length!==3)throw Error(usage);
 if(args.length===3&&args[1]!=='--expected-zip-sha256')throw Error(usage);
 const options=args.length===3?{expectedBundleSha256:args[2]}:{};
 const bytes=await readBoundedFile(args[0]);
 return verifyOfflineBundle(bytes,options);
}
const invoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){
 main(process.argv.slice(2)).then(x=>{process.stdout.write(JSON.stringify(x,null,2)+'\n');})
 .catch(e=>{process.stderr.write(JSON.stringify({status:'REJECTED',reason:e.reason||e.code||'INVALID_INPUT'})+'\n');process.exitCode=1;});
}
