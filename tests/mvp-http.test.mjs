import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {handleMvpApi} from '../studio/mvp-api.mjs';
const id='aaaa1111-bbbb-4ccc-8ddd-eeee11112222';
const geometry={source:'p4-geometry',viewport:{width:1440,height:900},document:{width:1440,height:900},background:'#f3f4f5',boxes:[{x:0,y:0,w:1440,h:900,depth:0,background:'#f3f4f5',radius:'0px'}],titles:[{x:20,y:20,w:320,h:30,text:'MY TEST',color:'#222222',font_size:'20px',font_weight:'600'}]};
const input={theme:'paper',user_schema:{columns:[{name:'City',type:'text'},{name:'Number',type:'number'}]},sample_rows:[{City:'Busan',Number:23}]};
function response(res,status,data,type='application/json; charset=utf-8',extra={}){
 const bytes=Buffer.isBuffer(data)?data:type.startsWith('application/json')?Buffer.from(JSON.stringify(data)):Buffer.from(data);
 res.writeHead(status,{'Content-Type':type,'Content-Length':bytes.length,...extra});res.end(bytes);
}
async function withServer(fn){
 const root=await mkdtemp(join(tmpdir(),'rea-mvp-test-'));await mkdir(join(root,id));
 const store={pathFor:x=>join(root,x),get:async x=>x===id?{id,mode:'static-visual',status:'completed'}:null,
 getReport:async()=>({reconstruction_available:true}),getInspection:async()=>({mode:'static-visual',page:{reconstruction_blueprint:geometry}})};
 const server=createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;
  handleMvpApi({req,res,path:p,store,respond:response,studioPort:port,isBusy:()=>false}).then(ok=>{if(!ok)response(res,404,{error:'not_found'});}).catch(()=>response(res,500,{error:'internal_error'}));
 });
 let port;
 try{await new Promise(r=>server.listen(0,'127.0.0.1',r));port=server.address().port;await fn({port,root});}
 finally{await new Promise(r=>server.close(r));await rm(root,{recursive:true,force:true});}
}
async function request(port,path,options={}){return fetch(`http://127.0.0.1:${port}${path}`,options);}

test('POST creates three persistent independent HTMLs; GET preview/download have hash and CSP',async()=>{
 await withServer(async({port,root})=>{
  const path=`/api/runs/${id}`;
  const opts={method:'POST',headers:{'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`},body:JSON.stringify(input)};
  let res=await request(port,path+'/mvp-build',opts);assert.equal(res.status,201);
  const json=await res.json();assert.equal(json.source_site_refetched,false);assert.equal(Object.keys(json.modes).length,3);
  res=await request(port,path+'/mvp');assert.equal(res.status,200);assert.equal((await res.json()).row_count,1);
  for(const mode of ['faithful','remix','schema']){
   res=await request(port,path+'/mvp/'+mode);assert.equal(res.status,200);
   assert.match(res.headers.get('content-security-policy'),/connect-src 'none'/);
   assert.equal(res.headers.get('x-frame-options'),'SAMEORIGIN');
   assert.equal(await res.text(),await readFile(join(root,id,'mvp',mode+'.html'),'utf8'));
   res=await request(port,path+'/mvp/'+mode+'-download');assert.equal(res.status,200);
   assert.match(res.headers.get('content-disposition'),/attachment/);
  }
  res=await request(port,path+'/mvp-build',opts);assert.equal(res.status,409);
  await writeFile(join(root,id,'mvp','schema.html'),'tampered');
  res=await request(port,path+'/mvp/schema');assert.equal(res.status,409);
 });
});

test('POST requires exact Origin, saved source and bounded JSON',async()=>{
 await withServer(async({port})=>{
  const path=`/api/runs/${id}/mvp-build`;
  let res=await request(port,path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(res.status,403);
  res=await request(port,path,{method:'POST',headers:{'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`},body:'not json'});assert.equal(res.status,400);
  res=await request(port,path,{method:'POST',headers:{'Content-Type':'application/json',Origin:`http://127.0.0.1:${port}`},body:'x'.repeat(16385)});assert.equal(res.status,413);
 });
});
