import test from 'node:test';
import assert from 'node:assert/strict';
import {createFixtureServer} from '../fixtures/site/server.mjs';
import {readFile} from 'node:fs/promises';
let server,base;
test.before(async()=>{server=createFixtureServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;});
test.after(async()=>{await new Promise(r=>server.close(r));});
test('readiness endpoint',async()=>{const r=await fetch(base+'/health');assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,fixture:'p0-1'});});
test('dashboard HTML and scripts served',async()=>{
 for(const [path,mime,needle] of [['/','text/html','Web REA P0 Controlled Dashboard'],['/app.js','text/javascript','function render'],['/style.css','text/css','.toolbar']]){
 const r=await fetch(base+path);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),new RegExp(mime));assert.match(await r.text(),new RegExp(needle));}
});
test('7/30 day selector produces different evidence',async()=>{const a=await(await fetch(base+'/api/trends?days=7')).json();const b=await(await fetch(base+'/api/trends?days=30')).json();assert.equal(a.count,2);assert.equal(b.count,4);});
test('category and search change results',async()=>{const r=await(await fetch(base+'/api/trends?days=30&category=chrome&q=Mint')).json();assert.equal(r.count,1);assert.equal(r.items[0].title,'Mint Chrome');});
test('invalid inputs are rejected',async()=>{for(const p of ['?days=999','?category=bad'])assert.equal((await fetch(base+'/api/trends'+p)).status,400);});
test('non-GET and unknown routes are closed',async()=>{assert.equal((await fetch(base+'/api/trends',{method:'POST'})).status,405);assert.equal((await fetch(base+'/admin')).status,404);});
test('responses avoid caching and sniffing',async()=>{const r=await fetch(base+'/api/trends');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');});
test('PowerShell runner isolates npm warnings and checks exit status',async()=>{
 const r=await readFile(new URL('./p0-rea-smoke.ps1',import.meta.url),'utf8');
 assert.match(r,/Start-Process -FilePath \$env:ComSpec/);
 assert.match(r,/RedirectStandardError \$reaStderr/);
 assert.match(r,/\$reaProcess\.ExitCode -ne 0/);
 assert.doesNotMatch(r,/& npx\.cmd/);
});
