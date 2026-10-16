import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {diagnoseRuns} from '../studio/diagnose.mjs';
test('local diagnoser classifies failure without revealing sensitive stderr text',async()=>{
 const root=await mkdtemp(join(tmpdir(),'rea-diag-'));
 const id='ad6906c3-fddb-41ce-8d7c-5387fcfd43d2';
 try{
  const dir=join(root,id);await mkdir(dir);
  await writeFile(join(dir,'metadata.json'),JSON.stringify({id,status:'failed',created_at:'2026-10-16T05:00:00Z'}));
  await writeFile(join(dir,'rea-stderr.log'),'npm error EAI_AGAIN https://example.com/?token=secret-password');
  const r=await diagnoseRuns(root);
  assert.equal(r.found,true);assert.equal(r.diagnosis,'NPM_OR_NETWORK_ERROR');
  assert.equal(r.files.stderr_bytes>0,true);
  assert.equal(JSON.stringify(r).includes('secret-password'),false);
  await assert.rejects(diagnoseRuns(root,'../../escape'),/Invalid run ID/);
 }finally{await rm(root,{recursive:true,force:true});}
});
