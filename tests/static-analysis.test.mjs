import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {createHash} from 'node:crypto';
import {validateHttpsUrl,parseApprovedUrls,isPublicIPv4,inspectStaticHtml,fetchApprovedHtml,runStaticAnalysis} from '../studio/static-analysis.mjs';

const url='https://shop.example.org/';
const html='<!doctype html><html><head><title>Home &amp; Shop</title><script src="https://cdn.example.net/a.js"></script></head><body><h1>Welcome</h1><a href="/sale?q=secret">Sale</a><a href="https://foreign.org/">Outside</a><form method="post"><input type="password" value="PRIVATE"><button id="shop-buy">Buy</button></form></body></html>';
const digest=s=>createHash('sha256').update(s).digest('hex');
const stubRequest=(options={})=>{
 const seen=[];
 const request=(requested,requestOptions,callback)=>{
  seen.push({requested:requested.href,options:requestOptions});
  const emitter=new EventEmitter();
  emitter.end=()=>process.nextTick(()=>{
    const res=new PassThrough();res.statusCode=options.status||200;
    res.headers={'content-type':options.type||'text/html; charset=utf-8',...options.headers};
    callback(res);
    if(options.body!==undefined)res.end(options.body);else res.end(html);
  });
  emitter.destroy=()=>{};
  return emitter;
 };
 return {request,seen};
};
const publicDns=async()=>[{address:'93.184.216.34',family:4}];

test('exact HTTPS approvals require canonical public-domain URL without query/credentials/ports',()=>{
 assert.equal(validateHttpsUrl(url),url);
 assert.deepEqual(parseApprovedUrls('https://shop.example.org/,https://owner.org/about'),[url,'https://owner.org/about']);
 for(const x of ['http://shop.example.org/','https://shop.example.org','https://127.0.0.1/','https://localhost/','https://site.local/','https://user:pass@shop.example.org/','https://shop.example.org:8443/','https://shop.example.org/?q=1','https://shop.example.org/#fragment','https://shop.example.org./'])assert.throws(()=>validateHttpsUrl(x));
 assert.throws(()=>parseApprovedUrls(url+','+url),{code:'SCOPE_CONFIG_INVALID'});
 assert.throws(()=>parseApprovedUrls(' , '+url));
});

test('DNS policy blocks private, loopback, benchmark, documentation, link-local and IPv6 addresses',()=>{
 for(const ip of ['127.0.0.1','10.0.0.3','169.254.169.254','172.16.0.1','192.168.1.2','100.100.100.100','198.18.0.1','192.0.2.1','198.51.100.10','203.0.113.1','224.0.0.1','::1','fd00::1'])assert.equal(isPublicIPv4(ip),false,ip);
 for(const ip of ['93.184.216.34','1.1.1.1','8.8.8.8'])assert.equal(isPublicIPv4(ip),true,ip);
});

test('HTTPS transport permits one GET only and pins public DNS address without proxies or redirects',async()=>{
 const fake=stubRequest();
 const result=await fetchApprovedHtml(url,{resolveHost:publicDns,request:fake.request});
 assert.equal(result.status,200);assert.equal(result.bytes,Buffer.byteLength(html));assert.equal(result.sha256,digest(html));
 assert.equal(fake.seen.length,1);
 const req=fake.seen[0];assert.equal(req.requested,url);assert.equal(req.options.method,'GET');
 assert.equal(req.options.agent,false);assert.equal(req.options.rejectUnauthorized,true);
 assert.equal(req.options.headers.Cookie,undefined);assert.equal(req.options.headers.Authorization,undefined);
 assert.equal(req.options.headers['Accept-Encoding'],'identity');
 await new Promise((ok,bad)=>req.options.lookup('shop.example.org',{},(err,address,family)=>err?bad(err):(assert.equal(address,'93.184.216.34'),assert.equal(family,4),ok())));
});

test('static parser exposes only structure and removes input values, query strings and scripts',()=>{
 const page=inspectStaticHtml(html,url);
 assert.equal(page.title,'Home & Shop');assert.equal(page.headings[0].text,'Welcome');
 assert.equal(page.summary.forms,1);assert.equal(page.summary.scripts,1);
 assert.deepEqual(page.same_origin_paths,['/sale']);
 assert.equal(page.forms[0].method,'POST');
 assert.equal(page.controls.some(x=>JSON.stringify(x).includes('PRIVATE')),false);
 assert.equal(JSON.stringify(page).includes('q=secret'),false);
});

test('DNS responses containing private IPs are rejected before opening connections',async()=>{
 let calls=0;
 const fetch=()=>{calls++;throw Error('should not connect')};
 await assert.rejects(fetchApprovedHtml(url,{resolveHost:async()=>[{address:'8.8.8.8',family:4},{address:'127.0.0.1',family:4}],request:fetch}),{code:'DNS_ADDRESS_BLOCKED'});
 assert.equal(calls,0);
 await assert.rejects(fetchApprovedHtml(url,{resolveHost:async()=>[{address:'::1',family:6}],request:fetch}),{code:'DNS_ADDRESS_BLOCKED'});
});

test('HTTP redirects, non-HTML, wrong status and too-large bodies do not pass',async()=>{
 for(const [configuration,code] of [
  [{status:302,headers:{location:'http://127.0.0.1/'}},'HTTP_REDIRECT_BLOCKED'],
  [{type:'application/json'},'CONTENT_TYPE_REJECTED'],
  [{status:401},'HTTP_STATUS_REJECTED'],
  [{body:'A'.repeat(600000)},'PAGE_TOO_LARGE'],
  [{headers:{'content-encoding':'gzip'}},'CONTENT_ENCODING_REJECTED'],
 ]){
  const fake=stubRequest(configuration);
  await assert.rejects(fetchApprovedHtml(url,{resolveHost:publicDns,request:fake.request}),{code});
  assert.equal(fake.seen.length,1);
 }
});

test('single-page read-only evidence is not misrepresented as browser evidence',async()=>{
 let calls=0;
 const output=await runStaticAnalysis({target:url,fetcher:async()=>{calls++;return {html,bytes:Buffer.byteLength(html),sha256:digest(html),status:200};}});
 assert.equal(calls,1);assert.equal(output.report.verdict,'PASS');
 assert.equal(output.report.analysis_mode,'static-html');assert.equal(output.report.screenshot_saved,false);
 assert.equal(output.inspection.mode,'static-html');assert.equal(output.inspection.browser,null);
 assert.equal(output.inspection.steps.length,1);
 assert.equal(output.inspection.network[0].path,'/');
 assert.match(output.report.note,/not a REA browser capture/i);
});
