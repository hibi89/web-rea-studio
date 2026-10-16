import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {parseApprovedUrls} from './static-analysis.mjs';

export const DEFAULT_TARGETS_FILE = fileURLToPath(new URL('../config/approved-targets.json', import.meta.url));

/** Load only exact, explicitly selected HTTPS URLs. No wildcards or redirects. */
export async function loadApprovedTargets({file=DEFAULT_TARGETS_FILE,envRaw=process.env.WEB_REA_ALLOWED_URLS}={}) {
  let value;
  try{value=JSON.parse(await readFile(file,'utf8'));}
  catch(e){throw Object.assign(Error('Could not load the reviewed HTTPS target configuration'),{code:'SCOPE_CONFIG_INVALID',cause:e});}
  if(value===null || typeof value!=='object' || Array.isArray(value) ||
     Object.keys(value).sort().join(',')!=='approved_urls,schema_version' ||
     value.schema_version!==1 || !Array.isArray(value.approved_urls) ||
     value.approved_urls.some(x=>typeof x!=='string')){
    throw Object.assign(Error('Invalid approved target configuration structure'),{code:'SCOPE_CONFIG_INVALID'});
  }
  const configured=parseApprovedUrls(value.approved_urls.join(','));
  const additional=parseApprovedUrls(envRaw);
  const combined=[...new Set([...configured,...additional])];
  if(combined.length>12)throw Object.assign(Error('Too many exact approved HTTPS URLs'),{code:'SCOPE_CONFIG_INVALID'});
  return combined;
}
