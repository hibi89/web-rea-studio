import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {sanitizeP4Geometry,generateP4Reconstruction} from './p4-reconstruction.mjs';

// Strict P4 "scriptless HTML + corresponding geometry" upload contract.
// Arbitrary user HTML, URLs, CSS, JavaScript and browser network are never
// interpreted or executed. The HTML must byte-match trusted P4 regeneration.
export const MAX_INDEPENDENT_DRAFT_BODY=320000;
const validKeys=(data,keys)=>data&&typeof data==='object'&&!Array.isArray(data)&&
 Object.keys(data).length===keys.length&&keys.every(k=>Object.hasOwn(data,k));
const error=code=>Object.assign(Error(code),{code});
export function validateIndependentDraftBundle(input,originalGeometry){
 if(!validKeys(input,['confirm','html','geometry'])||
  input.confirm!=='store-scriptless-p4-draft'||
  typeof input.html!=='string'||Buffer.byteLength(input.html,'utf8')>250000||
  input.html.length<100)
  throw error('DRAFT_INVALID_ENVELOPE');
 const original=sanitizeP4Geometry(originalGeometry);
 const draft=sanitizeP4Geometry(input.geometry);
 if(!original||!draft||!draft.boxes.length||!original.boxes.length)
  throw error('DRAFT_GEOMETRY_INVALID');
 if(draft.viewport.width!==original.viewport.width||
    draft.viewport.height!==original.viewport.height||
    draft.document.width!==original.document.width||
    draft.document.height!==original.document.height)
  throw error('DRAFT_VIEWPORT_MISMATCH');
 if(draft.boxes.length>80||draft.titles.length>24)
  throw error('DRAFT_COMPLEXITY_LIMIT');
 // This is an allowlisted P4 *template*, not a general-purpose sanitizer.
 // Strict equality ensures no hidden scripts, handlers, iframes, url(),
 // external CSS, tags, protocol handlers or HTML appended to the upload.
 const canonical=generateP4Reconstruction(draft);
 if(input.html!==canonical)throw error('DRAFT_HTML_NOT_CANONICAL');
 return {
  html:canonical,geometry:draft,
  record:{
   schema_version:1,kind:'local-independent-scriptless-p4-draft',
   status:'STORED_UNVERIFIED',
   provenance:'explicit-local-user-provided-canonical-p4-bundle',
   html_sha256:createHash('sha256').update(canonical).digest('hex'),
   bytes:Buffer.byteLength(canonical,'utf8'),
   painted_regions:draft.boxes.length,
   captured_title_count:draft.titles.length,
   original_site_refetched:false,
   browser_replay_executed:false,
   external_requests_issued:0,permissions_expanded:false,
   source_draft_alignment_verified:false,
   functional_equivalence_verified:false,product_ready:false,
   limitation:'Static P4 document only. Imported geometry is user supplied, not an independently observed Chrome capture.'
  }
 };
}
export async function saveIndependentDraftBundle({store,id,bundle,originalGeometry}={}){
 if(!store||typeof id!=='string')throw error('DRAFT_STORE_INVALID');
 const meta=await store.get(id);
 if(!meta)throw error('DRAFT_RUN_MISSING');
 if(meta.mode!=='static-visual'||meta.status!=='completed')
  throw error('DRAFT_RUN_NOT_ELIGIBLE');
 const {html,geometry,record}=validateIndependentDraftBundle(bundle,originalGeometry);
 const dir=store.pathFor(id);
 // Durable receipt is the commit marker; HTML and sanitized geometry are
 // separate wx-only files, preserving every original evidence artifact.
 await writeFile(join(dir,'independent-draft.html'),html,{flag:'wx',mode:0o600});
 await writeFile(join(dir,'independent-draft-geometry.json'),
  JSON.stringify(geometry),{flag:'wx',mode:0o600});
 await writeFile(join(dir,'independent-draft-receipt.json'),
  JSON.stringify(record,null,2),{flag:'wx',mode:0o600});
 return record;
}
export async function readIndependentDraftReceipt(store,id){
 try{
  const root=store.pathFor(id);
  const receipt=JSON.parse(await readFile(join(root,'independent-draft-receipt.json'),'utf8'));
  if(receipt?.kind!=='local-independent-scriptless-p4-draft'||
     receipt?.status!=='STORED_UNVERIFIED')return null;
  return receipt;
 }catch(e){if(e.code==='ENOENT')return null;throw e;}
}
