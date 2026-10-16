import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {PassThrough} from 'node:stream';
import {runInNewContext} from 'node:vm';
import {approveBrowserRequest,fetchGatewayResource,redactedResourcePath,LOCKDOWN_CSP,STATIC_VISUAL_CSP,DYNAMIC_LIMITS} from '../studio/dynamic-gateway.mjs';
import {CdpClient,assessPassiveRender,waitForPassiveIdle,sanitizedNetworkTarget,isIncidentalFavicon,sanitizeClientTrace,PASSIVE_TRACE_SCRIPT,STATIC_VISUAL_VIEWPORT,staticVisualCaptureSpec,screenshotPngDimensions} from '../studio/dynamic-browser.mjs';

const target='https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/';
const request=(url,resourceType='Document',method='GET')=>({url,resourceType,method});

test('approved exact document and same-origin scripts are read-only, no arbitrary navigation',()=>{
 assert.equal(approveBrowserRequest(request(target),{target}).allowed,true);
 assert.equal(approveBrowserRequest(request(target+'assets/site.js','Script'),{target}).allowed,true);
 assert.equal(approveBrowserRequest(request(target+'api/stats?month=10','XHR'),{target}).allowed,true);
 for(const scenario of [
  request(target+'admin','Document'),request('https://other.clevertide128.chatgpt.site/','Document'),
  request('https://127.0.0.1/','Script'),request('http://127.0.0.1/','Script'),
  request('https://169.254.169.254/latest','Script'),request(target+'api/update','Fetch','POST'),
  request(target,'WebSocket'),request('data:text/html,secret','Image'),
 ])assert.equal(approveBrowserRequest(scenario,{target}).allowed,false,scenario.url);
 assert.equal(redactedResourcePath(target+'api/stats?token=secret',target),'/api/stats');
 assert.equal(redactedResourcePath('https://evil.test/steal',target),null);
});

test('bounded request and data quotas are enforced before fetching',()=>{
 assert.equal(approveBrowserRequest(request(target),{target,seen:DYNAMIC_LIMITS.maxRequests}).reason,'budget_exhausted');
 assert.equal(approveBrowserRequest(request(target),{target,bytes:DYNAMIC_LIMITS.maxBytes}).reason,'budget_exhausted');
 assert.match(LOCKDOWN_CSP,/connect-src 'self'/);
 assert.match(LOCKDOWN_CSP,/form-action 'none'/);
 assert.match(LOCKDOWN_CSP,/frame-src 'none'/);
});
const publicDns=async()=>[{address:'1.1.1.1',family:4}];
const fakeTransport=({status=200,type='text/html',body='<h1>OK</h1>',headers={}}={})=>{
 const calls=[];
 const request=(url,opts,onResponse)=>{
  calls.push({url,opts});const req=new EventEmitter();
  req.end=()=>process.nextTick(()=>{const res=new PassThrough();res.statusCode=status;res.headers={'content-type':type,...headers};onResponse(res);res.end(body);});
  req.destroy=()=>{};return req;
 };
 return {request,calls};
};
test('gateway pins public DNS, does exactly one credential-free GET and returns buffered bytes',async()=>{
 const fake=fakeTransport({type:'application/javascript',body:'console.log(1)'});
 const x=await fetchGatewayResource(target+'app.js',{resolveHost:publicDns,request:fake.request});
 assert.equal(x.status,200);assert.equal(x.contentType,'application/javascript');assert.equal(x.body.toString(),'console.log(1)');
 assert.equal(fake.calls.length,1);
 assert.equal(fake.calls[0].opts.agent,false);
 assert.equal(fake.calls[0].opts.method,'GET');
 assert.equal(fake.calls[0].opts.rejectUnauthorized,true);
 assert.equal(fake.calls[0].opts.headers.Cookie,undefined);
 assert.equal(fake.calls[0].opts.headers.Authorization,undefined);
 assert.equal(fake.calls[0].opts.headers['Accept-Encoding'],'identity');
 await new Promise((ok,bad)=>fake.calls[0].opts.lookup('host',{},(e,ip,family)=>e?bad(e):(assert.equal(ip,'1.1.1.1'),assert.equal(family,4),ok())));
});
test('gateway denies redirects, private IP resolution, oversized and non-content resources',async()=>{
 const fake=fakeTransport();
 await assert.rejects(fetchGatewayResource(target,{resolveHost:async()=>[{address:'127.0.0.1',family:4}],request:fake.request}),{code:'DNS_ADDRESS_BLOCKED'});
 assert.equal(fake.calls.length,0);
 for(const [fakeOptions,expected] of [[{status:302},'REDIRECT_BLOCKED'],[{type:'text/calendar'},'MIME_BLOCKED'],[{headers:{'content-encoding':'gzip'}},'ENCODING_BLOCKED'],[{body:'x'.repeat(2*1024*1024+1)},'RESOURCE_TOO_LARGE']]){
  const f=fakeTransport(fakeOptions);await assert.rejects(fetchGatewayResource(target,{resolveHost:publicDns,request:f.request}),{code:expected});
  assert.equal(f.calls.length,1);
 }
});
class FakeSocket{
 constructor(){this.handlers={};this.sent=[];this.readyState=1;}
 addEventListener(type,handler){(this.handlers[type]||=[]).push(handler);}
 send(json){this.sent.push(JSON.parse(json));}
 emit(type,data){for(const cb of this.handlers[type]||[])cb(data);}
 close(){this.readyState=3;this.emit('close',{});}
}
test('CDP client addresses commands by sessionId and rejects errors/disconnections',async()=>{
 const ws=new FakeSocket(),cdp=new CdpClient(ws);
 const a=cdp.send('Page.enable',{},'page-session');
 assert.equal(ws.sent[0].sessionId,'page-session');
 ws.emit('message',{data:JSON.stringify({id:ws.sent[0].id,result:{enabled:true}})});
 assert.deepEqual(await a,{enabled:true});
 const b=cdp.send('Page.navigate',{url:target},'page-session');
 ws.emit('message',{data:JSON.stringify({id:ws.sent[1].id,error:{message:'fake-error'}})});
 await assert.rejects(b,{code:'CDP_REMOTE_ERROR'});
 const c=cdp.send('Runtime.evaluate',{},'page-session');ws.close();
 await assert.rejects(c,{code:'CDP_DISCONNECTED'});
});


test('capturing a screenshot of a Failed to fetch application error must fail acceptance',()=>{
 const assessment=assessPassiveRender({application_fetch_error_visible:true},{requested:2,fulfilled:2,blocked:0});
 assert.equal(assessment.verdict,'FAIL');
 assert.deepEqual(assessment.failures,['application_fetch_error_visible']);
 assert.equal(assessment.render_fidelity,'incomplete');
});
test('unfinished network requests cannot be silently counted as successful rendering',()=>{
 const assessment=assessPassiveRender({application_fetch_error_visible:false},{requested:2,fulfilled:1,blocked:0});
 assert.equal(assessment.verdict,'FAIL');
 assert.equal(assessment.pending,1);
 assert.deepEqual(assessment.failures,['resource_requests_unsettled']);
});
test('complete passive capture remains capture PASS without claiming visual equivalence',()=>{
 const result=assessPassiveRender({application_fetch_error_visible:false},{requested:3,fulfilled:3,blocked:0});
 assert.equal(result.verdict,'PASS');
 assert.equal(result.render_fidelity,'unverified');
 const partial=assessPassiveRender({application_fetch_error_visible:false},{requested:4,fulfilled:3,blocked:1});
 assert.equal(partial.verdict,'PASS');
 assert.equal(partial.render_fidelity,'partial');
});


test('passive idle barrier waits for a late API request and its completion',async()=>{
 const started=Date.now();let requested=0,settled=0,pending=0;
 const a=setTimeout(()=>{requested++;pending=1;},35);
 const b=setTimeout(()=>{settled=1;pending=0;},135);
 try{
  const result=await waitForPassiveIdle({snapshot:()=>({requested,settled,pending}),minWaitMs:80,quietMs:45,maxWaitMs:1200,pollMs:7});
  assert.equal(result.idle,true);
  assert.ok(Date.now()-started>=155,'must allow late response and a quiet interval');
 }finally{clearTimeout(a);clearTimeout(b);}
});
test('passive idle barrier times out on hanging API rather than claiming it settled',async()=>{
 const result=await waitForPassiveIdle({snapshot:()=>({requested:2,settled:1,pending:1}),minWaitMs:10,quietMs:10,maxWaitMs:70,pollMs:5});
 assert.equal(result.idle,false);
 assert.ok(result.wait_ms>=60);
 assert.equal(assessPassiveRender({application_fetch_error_visible:false},{requested:2,fulfilled:1,blocked:0,pending:1}).verdict,'FAIL');
});
test('network diagnostics retain source host but never query, secret, credential or external path',()=>{
 const base=target;
 const own=sanitizedNetworkTarget(base+'_api/report?token=private',base);
 assert.deepEqual(own,{path:'/_api/report',scope:'approved-origin'});
 const foreign=sanitizedNetworkTarget('https://cdn.example.net/private/foo?secret=abc',base);
 assert.equal(foreign.host,'cdn.example.net');assert.equal(foreign.path,null);
 assert.equal(JSON.stringify(foreign).includes('secret'),false);
 assert.equal(JSON.stringify(foreign).includes('/private/'),false);
 assert.equal(sanitizedNetworkTarget('http://169.254.169.254/private?token=abc',base).scope,'other-scheme');
});

test('favicon-only request can be completed locally without visiting remote icon',()=>{
 assert.equal(isIncidentalFavicon({url:target+'favicon.ico',method:'GET',resourceType:'Other'},target),true);
 for(const r of [
  {url:target+'favicon.ico?token=abc',method:'GET',resourceType:'Other'},
  {url:'https://other.example/favicon.ico',method:'GET',resourceType:'Other'},
  {url:target+'favicon.ico',method:'POST',resourceType:'Other'},
  {url:target+'api/report',method:'GET',resourceType:'Other'},
 ])assert.equal(isIncidentalFavicon(r,target),false);
});
test('fetch/XHR attempted requests are tracked without exposing query or cross-origin paths',()=>{
 assert.match(PASSIVE_TRACE_SCRIPT,/window\.fetch=function/);
 assert.match(PASSIVE_TRACE_SCRIPT,/XMLHttpRequest\.prototype\.open/);
 assert.doesNotMatch(PASSIVE_TRACE_SCRIPT,/sendBeacon|localStorage|sessionStorage/);
 const result=sanitizeClientTrace({fetches:1,rejections:1,xhrs:1,events:[
  {kind:'fetch-attempt',scope:'approved-origin',path:'/api/report?key=SECRET'},
  {kind:'fetch-rejected',scope:'other-origin',host:'api.example.net',raw:'https://api.example.net/secret/path?token=SECRET'},
  {kind:'xhr-open',scope:'approved-origin',path:'/api/report'}
 ]},target);
 assert.equal(result.fetches,1);
 assert.equal(result.rejections,1);
 assert.equal(result.events[0].path,undefined);
 assert.equal(result.events[1].host,'api.example.net');
 assert.equal(result.events[1].raw,undefined);
 assert.equal(JSON.stringify(result).includes('SECRET'),false);
 assert.equal(result.events[2].path,'/api/report');
});

test('injected passive tracer preserves rejected fetch and redacts both API query and cross-origin path',async()=>{
 class XHR {open(method,url){this.method=method;this.url=url;}}
 const win={fetch:async()=>{throw Error('offline')}};
 const context={window:win,XMLHttpRequest:XHR,location:{href:target,origin:new URL(target).origin},URL,Reflect};
 runInNewContext(PASSIVE_TRACE_SCRIPT,context,{timeout:1000});
 await assert.rejects(win.fetch(target+'api/report?token=VERY_SECRET'),/offline/);
 const xhr=new XHR();xhr.open('GET','https://api.external.example/private/id?token=VERY_SECRET');
 assert.equal(xhr.method,'GET');
 const captured=win.__webrea_passive_trace.snapshot();
 assert.equal(captured.fetches,1);
 assert.equal(captured.rejections,1);
 assert.equal(captured.xhrs,1);
 assert.equal(captured.events.length,3);
 const clean=sanitizeClientTrace(captured,target);
 assert.equal(clean.events[0].path,'/api/report');
 assert.equal(clean.events[1].kind,'fetch-rejected');
 assert.equal(clean.events[2].host,'api.external.example');
 assert.ok(!JSON.stringify(clean).includes('VERY_SECRET'));
 assert.ok(!JSON.stringify(clean).includes('/private/id'));
});

test('static visual CSP blocks all scripts, fetch and form submissions',()=>{
 assert.match(STATIC_VISUAL_CSP,/script-src 'none'/);
 assert.match(STATIC_VISUAL_CSP,/connect-src 'none'/);
 assert.match(STATIC_VISUAL_CSP,/form-action 'none'/);
 assert.doesNotMatch(STATIC_VISUAL_CSP,/script-src 'self'/);
 assert.match(LOCKDOWN_CSP,/script-src 'self'/);
});

test('Static Visual renders at desktop CSS viewport without switching existing passive mode',()=>{
 assert.deepEqual(STATIC_VISUAL_VIEWPORT,{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 assert.deepEqual(staticVisualCaptureSpec({cssContentSize:{height:2300}}),{
  clip:{x:0,y:0,width:1440,height:2300,scale:1},page_height:2300,truncated:false});
 assert.deepEqual(staticVisualCaptureSpec({cssContentSize:{height:100}}).clip,{
  x:0,y:0,width:1440,height:900,scale:1});
 const huge=staticVisualCaptureSpec({cssContentSize:{height:25000}});
 assert.equal(huge.clip.height,4000);
 assert.equal(huge.truncated,true);
 const broken=staticVisualCaptureSpec({});
 assert.equal(broken.clip.height,900);
});
test('PNG dimensions are parsed from screenshot evidence and bounded',()=>{
 const png=Buffer.alloc(32);Buffer.from('89504e470d0a1a0a','hex').copy(png);
 png.writeUInt32BE(1440,16);png.writeUInt32BE(2300,20);
 assert.deepEqual(screenshotPngDimensions(png),{width:1440,height:2300});
 assert.equal(screenshotPngDimensions(Buffer.from('not-png')),null);
});
