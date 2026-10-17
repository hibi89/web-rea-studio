import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {encodeFixedTwoFileZip,OFFLINE_ZIP_FILES} from '../studio/f3-q1-offline-bundle.mjs';
import {verifyOfflineBundle} from '../scripts/verify-offline-bundle.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const html='<!doctype html><html lang="en"><head><title>REA Coarse Presence Zones — NOT A REPLICA</title></head><body>Anonymous coarse presence zones</body></html>';
function receipt(h=html){
 return {schema_version:1,kind:'rea-anonymous-two-viewport-acceptance',
  status:'VERIFIED_SYNTHETIC_LAYOUT_ONLY',scope:'saved-anonymous-html-only',
  html_sha256:sha(Buffer.from(h)),evidence_sha256:'a'.repeat(64),
  views:[{width:1440,height:900,screenshot_width:1440,screenshot_height:900,
   status:'PASS_GENERATED_OFFLINE_LAYOUT',columns:3,zones:9,horizontal_overflow:false,
   native_controls:0,external_requests:0,scripts_executed:false},
  {width:390,height:844,screenshot_width:390,screenshot_height:1087,
   status:'PASS_GENERATED_OFFLINE_LAYOUT',columns:1,zones:9,horizontal_overflow:false,
   native_controls:0,external_requests:0,scripts_executed:false}],
  permission_status:'NOT_APPROVED',external_requests:0,actions_executed:0,
  original_site_refetched:false,original_site_parity_verified:false,
  original_mobile_layout_verified:false,product_ready:false,digitally_signed:false};
}
function bundle(h=html,r=receipt(h)){
 return encodeFixedTwoFileZip([
  {name:OFFLINE_ZIP_FILES[0],bytes:Buffer.from(h)},
  {name:OFFLINE_ZIP_FILES[1],bytes:Buffer.from(JSON.stringify(r,null,2)+'\n')}
 ]);
}
const denied=(b,reason)=>assert.throws(()=>verifyOfflineBundle(b),
 e=>e?.code==='OFFLINE_ZIP_INVALID'&&e.reason===reason);

test('independent ZIP verifier accepts two entries, hashes and explicit synthetic-only scope',()=>{
 const b=bundle(),out=verifyOfflineBundle(b,{expectedBundleSha256:sha(b)});
 assert.equal(out.status,'VALID_SYNTHETIC_OFFLINE_BUNDLE');
 assert.equal(out.file_count,2);assert.equal(out.html_sha256,sha(Buffer.from(html)));
 assert.equal(out.source_authenticity_verified,false);
 assert.equal(out.original_site_parity_verified,false);
});
test('reject modified HTML CRC32 and modified receipt CRC32',()=>{
 const original=bundle(), first=Buffer.from(original);
 first[30+OFFLINE_ZIP_FILES[0].length+6]^=1;denied(first,'ZIP_CRC32_MISMATCH');
 const another=Buffer.from(original),index=another.indexOf('"NOT_APPROVED"');
 assert.ok(index>0);another[index]^=1;denied(another,'ZIP_CRC32_MISMATCH');
});
test('reject signed-off looking HTML with valid recalculated CRC but stale receipt SHA',()=>{
 const b=bundle(html+' ',receipt(html));denied(b,'RECEIPT_MISMATCH');
});
test('reject changed viewport, unexpected receipt field, active HTML',()=>{
 const r=receipt();r.views[1].columns=3;denied(bundle(html,r),'VIEWPORT_RECEIPT_MISMATCH');
 const r2=receipt();r2.unsafe='injected';denied(bundle(html,r2),'RECEIPT_MISMATCH');
 const h=html.replace('</body>','<script>alert(1)</script></body>');
 denied(bundle(h,receipt(h)),'HTML_NOT_ANONYMOUS_STATIC');
});
test('reject central/local mismatches, extra entries, compression and descriptor flags',()=>{
 const b=bundle(),n=Buffer.from(b);n.writeUInt16LE(3,n.length-22+10);denied(n,'ZIP_END_RECORD');
 const trail=Buffer.concat([b,Buffer.from([0])]);denied(trail,'ZIP_END_RECORD');
 const end=b.length-22,central=b.readUInt32LE(end+16);
 const compressed=Buffer.from(b);compressed.writeUInt16LE(8,central+10);
 denied(compressed,'ZIP_CENTRAL_FIELDS');
 const descriptor=Buffer.from(b);descriptor.writeUInt16LE(8,6);
 denied(descriptor,'ZIP_LOCAL_CENTRAL_CONFLICT');
 const path=Buffer.from(b);path.write('x',central+46);denied(path,'ZIP_UNEXPECTED_PATH');
 const offset=Buffer.from(b);offset.writeUInt32LE(1,central+42);
 denied(offset,'ZIP_LOCAL_ENTRY');
});
test('reject invalid bundle expected SHA, oversized input and ZIP comment',()=>{
 const b=bundle();
 assert.throws(()=>verifyOfflineBundle(b,{expectedBundleSha256:'b'.repeat(64)}),
  /EXPECTED_BUNDLE_SHA256_MISMATCH/);
 denied(Buffer.alloc(2*256*1024+4097),'BUNDLE_SIZE_OR_TYPE');
 const comment=Buffer.from(b);comment.writeUInt16LE(1,b.length-2);
 denied(comment,'ZIP_END_RECORD');
});
test('CLI reads on disk without source contact, reports valid JSON, exits nonzero on tampering',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'rea-zip-verify-'));
 try{
  const path=join(dir,'bundle.zip'),b=bundle();
  await writeFile(path,b);
  const cli=resolve('scripts/verify-offline-bundle.mjs');
  const good=JSON.parse(execFileSync(process.execPath,[cli,path,'--expected-zip-sha256',sha(b)],{encoding:'utf8'}));
  assert.equal(good.status,'VALID_SYNTHETIC_OFFLINE_BUNDLE');
  await writeFile(path,Buffer.concat([b,Buffer.from('tamper')]));
  assert.throws(()=>execFileSync(process.execPath,[cli,path],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
