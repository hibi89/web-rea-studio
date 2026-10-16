import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateQueue,vercelCall,provision} from '../deploy/vercel-provision.mjs';
const original=JSON.parse(await readFile(new URL('../deploy/vercel-queue.json',import.meta.url),'utf8'));
const copy=x=>structuredClone(x);

test('real manifest is well-scoped and has correct target',()=>{
 const q=validateQueue(original);
 assert.equal(q.projects[0].repo,'hibi89/web-rea-studio');
 assert.equal(q.projects[0].root_directory,'preview');
 assert.equal(q.projects[0].project_name,'web-rea-studio-preview');
});
test('manifest rejects wrong owners, paths, names, duplicate projects',()=>{
 const invalid=[];
 let a=copy(original);a.owner='other';invalid.push(a);
 a=copy(original);a.projects[0].repo='other/hijack';invalid.push(a);
 a=copy(original);a.projects[0].root_directory='../secrets';invalid.push(a);
 a=copy(original);a.projects[0].branch='admin';invalid.push(a);
 a=copy(original);a.projects.push({...a.projects[0]});invalid.push(a);
 for(const x of invalid)assert.throws(()=>validateQueue(x));
});
test('creates new GitHub-linked project and triggers initial production deployment',async()=>{
 const seen=[],fetcher=async(url,opts)=>{
  seen.push({url,opts});
  if(url.includes('/v9/projects/'))return new Response('{}',{status:404});
  if(url.includes('/v11/projects'))return Response.json({id:'prj_new',name:'web-rea-studio-preview'},{status:201});
  if(url.includes('/v6/deployments'))return Response.json({deployments:[]});
  if(url.includes('/v13/deployments'))return Response.json({uid:'dpl_first',url:'preview-example.vercel.app'},{status:201});
  throw Error('Unexpected endpoint');
 };
 const logs=[];const result=await provision(original,{token:'unit-test-fake',fetcher,log:s=>logs.push(s)});
 assert.deepEqual(result,[{name:'web-rea-studio-preview',created:true,deployment:'queued'}]);
 assert.equal(seen.length,4);
 const p=JSON.parse(seen[1].opts.body);assert.deepEqual(p.gitRepository,{type:'github',repo:'hibi89/web-rea-studio'});
 assert.equal(p.rootDirectory,'preview');
 const d=JSON.parse(seen[3].opts.body);assert.deepEqual(d.gitSource,{type:'github',org:'hibi89',repo:'web-rea-studio',ref:'main'});
 for(const call of seen)assert.match(call.opts.headers.Authorization,/^Bearer unit-test-fake$/);
 assert.ok(logs.every(x=>!x.includes('unit-test-fake')));
});
test('idempotent re-run does not recreate or redeploy existing linked project',async()=>{
 const seen=[];const fetcher=async(url,opts)=>{seen.push({url,opts});
  if(url.includes('/v9/projects/'))return Response.json({id:'prj_exists',link:{type:'github',org:'hibi89',repo:'web-rea-studio'}});
  if(url.includes('/v6/deployments'))return Response.json({deployments:[{state:'READY'}]});
  throw Error('should not post new resource');};
 const result=await provision(original,{token:'fake',fetcher,log:()=>{}});
 assert.equal(result[0].deployment,'existing');assert.equal(seen.length,2);assert.ok(seen.every(x=>x.opts.method==='GET'));
});
test('existing but unrelated Vercel project cannot be silently adopted',async()=>{
 const fetcher=async()=>Response.json({id:'prj_other',link:{type:'github',org:'other',repo:'other'}});
 await assert.rejects(provision(original,{token:'fake',fetcher,log:()=>{}}),{code:'EXISTING_PROJECT_MISMATCH'});
});
test('Vercel 403 fails without retry or leaking response body',async()=>{
 let n=0;const fetcher=async()=>{n++;return new Response('{"secret":"not for logs"}',{status:403})};
 await assert.rejects(provision(original,{token:'fake',fetcher,log:()=>{}}),{code:'VERCEL_HTTP_403_GET'});
 assert.equal(n,1);
});
