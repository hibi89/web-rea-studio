import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,rename,readdir,readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeStore,defaultRunStorageDir,importLegacyRuns} from '../studio/core.mjs';
import {diagnoseRuns} from '../studio/diagnose.mjs';

async function inSandbox(action){
 const dir=await mkdtemp(join(tmpdir(),'rea-storage-test-'));
 try{return await action(dir);}finally{await rm(dir,{recursive:true,force:true});}
}
const target_url='http://127.0.0.1:4317/';
const blocksOverwrite=async(from,to)=>{
 try{await stat(to);throw Object.assign(Error('simulated Windows OneDrive rename to existing path denied'),{code:'EPERM'});}
 catch(e){if(e.code!=='ENOENT')throw e;}
 return rename(from,to);
};

test('Windows local storage uses LOCALAPPDATA instead of OneDrive project folder',()=>{
 assert.equal(defaultRunStorageDir({platform:'win32',env:{LOCALAPPDATA:'C:\\Users\\tester\\AppData\\Local'},cwd:'C:\\Users\\tester\\OneDrive'}),join('C:\\Users\\tester\\AppData\\Local','WebREAStudio','runs'));
 assert.equal(defaultRunStorageDir({platform:'win32',env:{WEB_REA_DATA_DIR:'/tmp/custom',LOCALAPPDATA:'/tmp/local'},cwd:'/tmp/work'}),'/tmp/custom');
 assert.throws(()=>defaultRunStorageDir({platform:'win32',env:{},cwd:'/tmp/on-drive'}),/LOCALAPPDATA/);
});

test('metadata update never replaces existing metadata.json on EPERM-simulated Windows',()=>inSandbox(async dir=>{
 const s=makeStore(join(dir,'runs'),{move:blocksOverwrite});await s.init();
 const created=await s.create({target_url});
 const original=await readFile(join(s.pathFor(created.id),'metadata.json'),'utf8');
 await s.update(created.id,{status:'running'});
 await s.update(created.id,{status:'completed',verdict:'PASS'});
 assert.equal((await s.get(created.id)).status,'completed');
 assert.equal((await s.get(created.id))._revision,2);
 assert.equal(await readFile(join(s.pathFor(created.id),'metadata.json'),'utf8'),original);
 const versions=(await readdir(s.pathFor(created.id))).filter(x=>/^metadata\.v/.test(x));
 assert.deepEqual(versions.sort(),['metadata.v000001.json','metadata.v000002.json']);
}));

test('concurrent updates are serialized, never overwrite a numbered revision',()=>inSandbox(async dir=>{
 const s=makeStore(join(dir,'runs'),{move:blocksOverwrite});await s.init();
 const m=await s.create({target_url});
 await Promise.all([s.update(m.id,{phase:'first'}),s.update(m.id,{phase:'second'}),s.update(m.id,{phase:'third'})]);
 const saved=await s.get(m.id);
 assert.equal(saved._revision,3);assert.equal(saved.phase,'third');
 assert.equal((await readdir(s.pathFor(m.id))).filter(x=>x.startsWith('metadata.v')).length,3);
}));

test('temporary rename lock retries without deleting any prior revision',()=>inSandbox(async dir=>{
 let attempts=0;
 const flaky=async(src,dst)=>{
   attempts++;
   if(attempts===2)throw Object.assign(Error('OneDrive temporary access denied'),{code:'EPERM'});
   return blocksOverwrite(src,dst);
 };
 const s=makeStore(join(dir,'runs'),{move:flaky});await s.init();
 const created=await s.create({target_url});
 const updated=await s.update(created.id,{status:'completed'});
 assert.equal(updated.status,'completed');assert.equal(attempts,3);
}));

test('old legacy metadata.json is readable and restart appends an interrupted revision',()=>inSandbox(async dir=>{
 const root=join(dir,'old-runs'),s=makeStore(root);await s.init();
 const m=await s.create({target_url});
 await s.update(m.id,{status:'running'});
 const again=makeStore(root,{move:blocksOverwrite});await again.init();
 assert.equal((await again.get(m.id)).status,'interrupted');
 assert.equal((await again.get(m.id))._revision,2);
 assert.equal(JSON.parse(await readFile(join(again.pathFor(m.id),'metadata.json'),'utf8')).status,'queued');
}));

test('legacy OneDrive history import copies once without changing original files',()=>inSandbox(async dir=>{
 const source=join(dir,'old-one-drive'),dest=join(dir,'new-local');
 const legacy=makeStore(source);await legacy.init();
 const m=await legacy.create({target_url});
 await legacy.update(m.id,{status:'failed',error:'legacy OneDrive EPERM'});
 await writeFile(join(legacy.pathFor(m.id),'rea-stderr.log'),'no credentials');
 await writeFile(join(legacy.pathFor(m.id),'metadata.json.skipped.tmp'),'incomplete');
 const original=await readFile(join(legacy.pathFor(m.id),'metadata.json'),'utf8');
 assert.deepEqual(await importLegacyRuns({from:source,to:dest}),{imported:1,skipped:0});
 assert.deepEqual(await importLegacyRuns({from:source,to:dest}),{imported:0,skipped:1});
 const copied=makeStore(dest);await copied.init();
 assert.equal((await copied.get(m.id)).status,'failed');
 assert.equal(await readFile(join(legacy.pathFor(m.id),'metadata.json'),'utf8'),original);
 assert.equal(await readFile(join(copied.pathFor(m.id),'rea-stderr.log'),'utf8'),'no credentials');
 assert.equal((await readdir(copied.pathFor(m.id))).some(x=>x.endsWith('.tmp')),false);
 const diagnosed=await diagnoseRuns(dest,m.id);
 assert.equal(diagnosed.found,true);assert.equal(diagnosed.status,'failed');
}));
