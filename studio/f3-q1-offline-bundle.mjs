// Deterministic ZIP of exactly two already-accepted synthetic offline artifacts.
// Neither this function nor a GET using it performs a capture, Chrome replay, I/O or network request.
import {createHash} from 'node:crypto';
import {validAcceptanceReceipt} from './f3-q1-acceptance.mjs';

export const OFFLINE_ZIP_FILES=Object.freeze([
 'rea-verified-synthetic-offline-only.html',
 'rea-two-viewport-acceptance.json'
]);
const DIGEST=/^[a-f0-9]{64}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const denied=()=>Object.assign(Error('OFFLINE_BUNDLE_EVIDENCE_MISMATCH'),{code:'OFFLINE_BUNDLE_EVIDENCE_MISMATCH'});
const LIMIT=256*1024;
const CRC_TABLE=Array.from({length:256},(_,k)=>{
 let c=k;
 for(let i=0;i<8;i++)c=c&1?(0xedb88320^(c>>>1)):(c>>>1);
 return c>>>0;
});
function crc32(b){
 let crc=0xffffffff;
 for(const v of b)crc=CRC_TABLE[(crc^v)&255]^(crc>>>8);
 return (crc^0xffffffff)>>>0;
}
// ZIP32 STORE only, zero extra fields, no compression, zip64, links, directories or dynamic filenames.
// Fixed DOS timestamp 1980-01-01 and order permit identical binary across repeated GETs.
export function encodeFixedTwoFileZip(files){
 if(!Array.isArray(files)||files.length!==2||
  files.some((x,i)=>x?.name!==OFFLINE_ZIP_FILES[i]||!Buffer.isBuffer(x?.bytes)||
   x.bytes.length===0||x.bytes.length>LIMIT))
  throw denied();
 let size=0;const local=[],central=[];let offset=0;
 for(const {name,bytes} of files){
  const n=Buffer.from(name,'ascii'),crc=crc32(bytes),len=bytes.length;
  const hdr=Buffer.alloc(30+n.length);
  hdr.writeUInt32LE(0x04034b50,0);hdr.writeUInt16LE(20,4);
  hdr.writeUInt16LE(0,6);hdr.writeUInt16LE(0,8);
  hdr.writeUInt16LE(0,10);hdr.writeUInt16LE(33,12); // 1980-01-01
  hdr.writeUInt32LE(crc,14);hdr.writeUInt32LE(len,18);hdr.writeUInt32LE(len,22);
  hdr.writeUInt16LE(n.length,26);n.copy(hdr,30);
  local.push(hdr,bytes);
  const cd=Buffer.alloc(46+n.length);
  cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);
  cd.writeUInt16LE(20,6);cd.writeUInt16LE(0,8);cd.writeUInt16LE(0,10);
  cd.writeUInt16LE(0,12);cd.writeUInt16LE(33,14);
  cd.writeUInt32LE(crc,16);cd.writeUInt32LE(len,20);cd.writeUInt32LE(len,24);
  cd.writeUInt16LE(n.length,28);
  cd.writeUInt32LE(0,38);cd.writeUInt32LE(offset,42);n.copy(cd,46);
  central.push(cd);
  offset+=hdr.length+len;size+=cd.length;
 }
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);
 end.writeUInt16LE(2,8);end.writeUInt16LE(2,10);
 end.writeUInt32LE(size,12);end.writeUInt32LE(offset,16);
 const zip=Buffer.concat([...local,...central,end],offset+size+end.length);
 if(zip.length>LIMIT*2+4096)throw denied();
 return zip;
}
export function buildVerifiedOfflineBundle({receipt,preview,evidence_sha256}={}){
 if(!DIGEST.test(evidence_sha256??'')||
  !validAcceptanceReceipt(receipt,{preview,evidence_sha256})||
  preview?.status!=='OFFLINE_COARSE_GEOMETRY_PREVIEW'||
  typeof preview.html!=='string')throw denied();
 const html=Buffer.from(preview.html,'utf8');
 if(html.length!==preview.receipt.bytes||hash(html)!==receipt.html_sha256||
  html.length===0||html.length>LIMIT)throw denied();
 // Strict whitelist: no attacker-defined receipt properties, URLs, credentials or source labels.
 // The JSON inside the ZIP is canonical and includes only the accepted known-safe fields.
 const views=receipt.views.map(v=>({
  width:v.width,height:v.height,screenshot_width:v.screenshot_width,
  screenshot_height:v.screenshot_height,status:v.status,columns:v.columns,
  zones:v.zones,horizontal_overflow:v.horizontal_overflow,
  native_controls:v.native_controls,external_requests:v.external_requests,
  scripts_executed:v.scripts_executed
 }));
 const safe={
  schema_version:1,kind:'rea-anonymous-two-viewport-acceptance',
  status:'VERIFIED_SYNTHETIC_LAYOUT_ONLY',
  scope:'saved-anonymous-html-only',
  html_sha256:receipt.html_sha256,evidence_sha256,
  views,permission_status:'NOT_APPROVED',external_requests:0,actions_executed:0,
  original_site_refetched:false,original_site_parity_verified:false,
  original_mobile_layout_verified:false,product_ready:false,digitally_signed:false
 };
 const json=Buffer.from(JSON.stringify(safe,null,2)+'\n','utf8');
 if(json.length>LIMIT)throw denied();
 const bytes=encodeFixedTwoFileZip([
  {name:OFFLINE_ZIP_FILES[0],bytes:html},
  {name:OFFLINE_ZIP_FILES[1],bytes:json}
 ]);
 return {
  bytes,sha256:hash(bytes),html_sha256:hash(html),receipt_sha256:hash(json),
  file_count:2,verification_scope:'synthetic-offline-only'
 };
}
