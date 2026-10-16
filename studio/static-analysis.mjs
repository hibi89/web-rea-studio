// Explicitly scoped, one-request HTTPS inspection. Never execute page scripts,
// send credentials, fetch secondary assets, or follow a redirect.
import {lookup as dnsLookup} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';

const err=(code,message)=>Object.assign(new Error(message),{code});
const MAX_PAGE=512*1024;
const VALID_NAME=/^(?=.{4,253}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/;
export function validateHttpsUrl(raw){
 if(typeof raw!=='string'||raw.length>2048)throw err('SCOPE_INVALID_URL','An exact HTTPS URL is required');
 let u;try{u=new URL(raw);}catch{throw err('SCOPE_INVALID_URL','Malformed HTTPS URL');}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port||u.hostname.endsWith('.')||
    !VALID_NAME.test(u.hostname)||isIP(u.hostname)||/\.(?:local|localhost|internal|test|invalid|example)$/.test(u.hostname)||
    u.hostname==='localhost'||!raw.startsWith('https://')||u.href!==raw)
  throw err('SCOPE_INVALID_URL','Only canonical public HTTPS URLs without credentials, query, fragment or custom port are supported');
 return u.href;
}
export function parseApprovedUrls(raw=''){
 if(raw===undefined||raw===null||raw==='')return [];
 if(typeof raw!=='string'||raw.length>12000)throw err('SCOPE_CONFIG_INVALID','Invalid approved URL configuration');
 const parts=raw.split(',').map(x=>x.trim());
 if(parts.length>12||parts.some(x=>!x))throw err('SCOPE_CONFIG_INVALID','Maximum 12 exact HTTPS URLs; no empty entries');
 const parsed=parts.map(validateHttpsUrl);
 if(new Set(parsed).size!==parsed.length)throw err('SCOPE_CONFIG_INVALID','Duplicate approved URL');
 return parsed;
}

// Intentionally support only globally-routable IPv4. IPv6-only websites are
// explicitly unsupported until an equivalent complete IPv6 policy is audited.
export function isPublicIPv4(ip){
 if(isIP(ip)!==4)return false;
 const [a,b,c,d]=ip.split('.').map(Number);
 if([a,b,c,d].some(x=>!Number.isInteger(x)||x<0||x>255))return false;
 if(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||
 a===100&&b>=64&&b<=127||a===198&&b===18||a===198&&b===19||
 a===192&&b===0&&c===0||a===192&&b===0&&c===2||a===192&&b===88&&c===99||
 a===198&&b===51&&c===100||a===203&&b===0&&c===113||a===192&&b===18||a===192&&b===19||a===192&&b===31)return false;
 return true;
}
const decodeText=html=>html.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#(\d+)|#x([a-f\d]+));/gi,(m,d,h)=>{
 const common={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '};
 if(common[m.toLowerCase()])return common[m.toLowerCase()];
 const n=d?Number(d):h?parseInt(h,16):0;
 return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
}).replace(/\s+/g,' ').trim();
const limited=(s,n)=>decodeText(s).replace(/[\x00-\x1f\x7f]/g,' ').slice(0,n);
const cleanTags=s=>s.replace(/<[^>]*>/g,' ');
const attr=(s,key)=>new RegExp('(?:^|\\s)'+key+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))','i').exec(s)?.slice(1).find(x=>x!==undefined)||'';
const count=(s,tag)=>[...s.matchAll(new RegExp('<'+tag+'(?:\\s|>)','gi'))].length;
export function inspectStaticHtml(html,url){
 const u=new URL(url);
 const cleaned=html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const titleMatch=/<title\b[^>]*>([\s\S]{0,1000}?)<\/title\s*>/i.exec(html);
 const headings=[];
 for(const m of cleaned.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi)){
  if(headings.length>=15)break;
  const value=limited(cleanTags(m[2]),140);if(value)headings.push({level:Number(m[1]),text:value});
 }
 const controls=[];
 for(const m of cleaned.matchAll(/<(button|input|select|textarea)\b([^>]{0,2500})>/gi)){
  if(controls.length>=45)break;
  const id=attr(m[2],'id');
  controls.push({kind:m[1].toLowerCase(),id:/^[\w-]{1,70}$/.test(id)?id:'',type:limited(attr(m[2],'type'),25)});
 }
 const links=new Set(),refs=cleaned.matchAll(/<a\b([^>]{0,2000})>/gi);let outbound=0,linksCount=0;
 for(const m of refs){linksCount++;if(linksCount>4000)break;
  const href=attr(m[1],'href');if(!href)continue;
  try{const dest=new URL(href,u);if(dest.origin===u.origin){if(links.size<25)links.add(dest.pathname);}else outbound++;}catch{}
 }
 const forms=[];
 for(const m of cleaned.matchAll(/<form\b([^>]{0,1000})>/gi)){
  if(forms.length>=30)break;
  forms.push({method:(attr(m[1],'method')||'GET').toUpperCase().slice(0,10)});
 }
 return {title:limited(titleMatch?.[1]||'',160),headings,controls,forms,
  summary:{buttons:count(cleaned,'button'),inputs:count(cleaned,'input'),forms:count(cleaned,'form'),links:linksCount,scripts:count(html,'script'),stylesheets:[...html.matchAll(/<link\b[^>]*rel\s*=\s*["']stylesheet["']/gi)].length,external_links:outbound},
  same_origin_paths:[...links]};
}

// Dependency injection is used by offline tests; production uses native DNS
// and HTTPS with certificate verification and a DNS-pinned selected IP.
export async function fetchApprovedHtml(target,{resolveHost=dnsLookup,request=httpsRequest,limit=MAX_PAGE,timeoutMs=10000}={}){
 const url=validateHttpsUrl(target),u=new URL(url);
 let records;try{records=await resolveHost(u.hostname,{all:true});}catch{throw err('DNS_LOOKUP_FAILED','Approved hostname could not be resolved');}
 const ipv4=Array.isArray(records)?records.filter(x=>x.family===4):[];
 if(!ipv4.length||ipv4.some(x=>!isPublicIPv4(x.address)))throw err('DNS_ADDRESS_BLOCKED','Resolved IPv4 addresses must all be public');
 const selected=ipv4[0].address;
 return await new Promise((ok,bad)=>{
  let settled=false,req;
  const reject=(e)=>{if(!settled){settled=true;bad(e)}};
  try{
   req=request(u,{method:'GET',agent:false,timeout:timeoutMs,headers:{Accept:'text/html', 'Accept-Encoding':'identity','User-Agent':'WebREAStudio-Static/0.2'},
    lookup:(_host,_options,cb)=>cb(null,selected,4),family:4,rejectUnauthorized:true,maxHeaderSize:16384},res=>{
      const status=res.statusCode||0;
      if(status>=300&&status<400){res.destroy();return reject(err('HTTP_REDIRECT_BLOCKED','Redirects are not followed'));}
      if(status!==200){res.destroy();return reject(err('HTTP_STATUS_REJECTED',`HTTPS responded with status ${status}`));}
      const type=String(res.headers['content-type']||'').toLowerCase();
      if(!/^text\/html(?:\s*;|\s*$)/.test(type)){res.destroy();return reject(err('CONTENT_TYPE_REJECTED','Only text/html responses are supported'));}
      const encoding=String(res.headers['content-encoding']||'identity').toLowerCase();
      if(encoding!=='identity'){res.destroy();return reject(err('CONTENT_ENCODING_REJECTED','Compressed responses are unsupported'));}
      const length=Number(res.headers['content-length']||0);
      if(length>limit){res.destroy();return reject(err('PAGE_TOO_LARGE','HTML exceeds safety size limit'));}
      let size=0;const chunks=[];
      res.on('data',part=>{
       size+=part.length;
       if(size>limit){res.destroy();return reject(err('PAGE_TOO_LARGE','HTML exceeds safety size limit'));}
       chunks.push(part);
      });
      res.on('error',()=>reject(err('HTTPS_STREAM_FAILED','HTTPS response stream failed')));
      res.on('end',()=>{if(!settled){settled=true;const bytes=Buffer.concat(chunks);ok({html:bytes.toString('utf8'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),status,ip_family:4});}});
   });
   req.on('error',()=>reject(err('HTTPS_REQUEST_FAILED','HTTPS request failed (check TLS, DNS or network)')));
   req.on('timeout',()=>{req.destroy();reject(err('HTTPS_TIMEOUT','HTTPS request exceeded time limit'));});
   req.end();
  }catch{reject(err('HTTPS_REQUEST_FAILED','HTTPS request could not start'));}
 });
}
export async function runStaticAnalysis({target,fetcher=fetchApprovedHtml}){
 const start=Date.now();const response=await fetcher(target);
 const page=inspectStaticHtml(response.html,target),url=new URL(target);
 const inspection={schema_version:2,scope:'explicit-https-allowlist',mode:'static-html',
   browser:null,completeness:'static-html-only',page,
   steps:[{step_id:'https-document',action:'GET',status:'completed',elapsed_ms:Date.now()-start}],
   network:[{kind:'response',method:'GET',path:url.pathname,status:200}],
   limitations:['Single HTTPS GET only','No JavaScript execution, screenshots, dynamic DOM, browser actions or secondary resources','HTML tag inventory is approximate']};
 return {report:{verdict:'PASS',analysis_mode:'static-html',failures:[],http_status:response.status,html_bytes:response.bytes,html_sha256:response.sha256,step_count:1,completed_steps:1,api_requests:0,api_responses_200:0,screenshot_saved:false,note:'Static HTML fetch only; not a REA browser capture or site reconstruction.'},inspection};
}
