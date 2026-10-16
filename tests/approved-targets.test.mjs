import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadApprovedTargets} from '../studio/approved-targets.mjs';

const site='https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/';
test('the one user-selected HTTPS dashboard is in the checked-in exact allowlist',async()=>{
  assert.deepEqual(await loadApprovedTargets({envRaw:''}),[site]);
});
test('user-selected HTTPS dashboard is not a wildcard or site browsing authorization',async()=>{
  const approved=await loadApprovedTargets({envRaw:''});
  assert.equal(approved.includes(site),true);
  assert.equal(approved.includes('https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/private'),false);
  assert.equal(approved.includes('https://other.clevertide128.chatgpt.site/'),false);
});
test('invalid config and malformed override fail closed',async()=>{
  const temp=await mkdtemp(join(tmpdir(),'rea-approved-'));
  const file=join(temp,'targets.json');
  try{
    await writeFile(file,JSON.stringify({schema_version:1,approved_urls:['http://127.0.0.1/']}));
    await assert.rejects(loadApprovedTargets({file,envRaw:''}),{code:'SCOPE_INVALID_URL'});
    await writeFile(file,JSON.stringify({schema_version:1,approved_urls:[site]}));
    await assert.rejects(loadApprovedTargets({file,envRaw:'http://127.0.0.1/'}),{code:'SCOPE_INVALID_URL'});
    await writeFile(file,JSON.stringify({schema_version:2,approved_urls:[site]}));
    await assert.rejects(loadApprovedTargets({file,envRaw:''}),{code:'SCOPE_CONFIG_INVALID'});
  }finally{await rm(temp,{recursive:true,force:true});}
});
test('duplicate URL across checked-in config and env is not requested twice',async()=>{
  assert.deepEqual(await loadApprovedTargets({envRaw:site}),[site]);
});
