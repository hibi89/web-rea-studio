import {lookup as lookupDns} from 'node:dns/promises';
import {request as httpsRequest} from 'node:https';
import {isIP} from 'node:net';
import {isPublicIPv4,validateHttpsUrl} from './static-analysis.mjs';

const failure=(code,message)=>Object.assign(Error(message),{code});
const mimeAllow=/^(?:text\/(?:html|css|javascript|plain)|application\/(?:javascript|json|wasm)|image\/(?:png|jpeg|webp|gif|svg\+xml|x-icon)|font\/(?:woff|woff2|ttf)|application\/(?:font-woff|octet-stream))(?:\s*;|\s*$)/i;
export const DYNAMIC_LIMITS=Object.freeze({maxRequests:64,maxBytes:12*1024*1024,maxResourceBytes:2*1024*1024,maxDurationMs:35000});

/** Browser requests are suggestions, never permissions. No redirects or navigation off the exact page. */
export function approveBrowserRequest(request,{target,seen=0,bytes=0}={}){
 const approved=validateHttpsUrl(target);
 const reference=new URL(approved);
 if(seen>=DYNAMIC_LIMITS.maxRequests||bytes>=DYNAMIC_LIMITS.maxBytes)return {allowed:false,reason:'budget_exhausted'};
 if(request.method!=='GET')return {allowed:false,reason:'method_blocked'};
 if(typeof request.url!=='string'||request.url.length>2048)return {allowed:false,reason:'invalid_request'};
 let url;try{url=new URL(request.url);}catch{return {allowed:false,reason:'invalid_request'};}
 if(url.origin!==reference.origin||url.username||url.password||url.hash||url.port!=='')return {allowed:false,reason:'origin_blocked'};
 if(isIP(url.hostname)||url.protocol!=='https:')return {allowed:false,reason:'origin_blocked'};
 if(request.resourceType==='Document' && url.href!==approved)return {allowed:false,reason:'navigation_blocked'};
 if(['WebSocket','EventSource','Media','Manifest'].includes(request.resourceType))return {allowed:false,reason:'resource_blocked'};
 if(!['Document','Stylesheet','Script','Image','Font','XHR','Fetch','Other'].includes(request.resourceType))return {allowed:false,reason:'resource_blocked'};
 return {allowed:true,url:url.href,resourceType:request.resourceType};
}

// Node, not Chrome, performs each pinned, TLS-validated HTTP request. Browser
// never receives request credentials/cookies or follows redirects automatically.
export async function fetchGatewayResource(raw,{resolveHost=lookupDns,request=httpsRequest,timeoutMs=9000}={}){
 let target;try{target=new URL(raw);}catch{throw failure('RESOURCE_URL_INVALID','Invalid resource URL');}
 if(target.protocol!=='https:'||target.username||target.password||target.port||target.hash||target.hostname.endsWith('.')||isIP(target.hostname))throw failure('RESOURCE_URL_INVALID','Unsupported resource URL');
 let answers;try{answers=await resolveHost(target.hostname,{all:true});}catch{throw failure('DNS_LOOKUP_FAILED','DNS resolution failed');}
 const ipv4=answers.filter(x=>x.family===4);
 if(!ipv4.length || ipv4.some(x=>!isPublicIPv4(x.address)))throw failure('DNS_ADDRESS_BLOCKED','Non-public DNS address');
 const chosen=ipv4[0].address;
 return await new Promise((ok,bad)=>{
  let settled=false;
  const reject=e=>{if(!settled){settled=true;bad(e);}};
  try{
   const req=request(target,{method:'GET',agent:false,timeout:timeoutMs,headers:{Accept:'*/*','Accept-Encoding':'identity','User-Agent':'WebREAStudio-Authorized/0.3'},lookup:(_host,_options,cb)=>cb(null,chosen,4),family:4,rejectUnauthorized:true,maxHeaderSize:16384},res=>{
    const status=res.statusCode||0;
    if(status>=300&&status<400){res.destroy();return reject(failure('REDIRECT_BLOCKED','Redirect not followed'));}
    if(status!==200){res.destroy();return reject(failure('HTTP_REJECTED',`Unexpected HTTP status ${status}`));}
    const type=String(res.headers['content-type']||'').toLowerCase();
    if(!mimeAllow.test(type)){res.destroy();return reject(failure('MIME_BLOCKED','Resource type not permitted'));}
    if(String(res.headers['content-encoding']||'identity').toLowerCase()!=='identity'){res.destroy();return reject(failure('ENCODING_BLOCKED','Compressed responses not supported'));}
    if(Number(res.headers['content-length']||0)>DYNAMIC_LIMITS.maxResourceBytes){res.destroy();return reject(failure('RESOURCE_TOO_LARGE','Resource too large'));}
    let size=0;const chunks=[];
    res.on('data',data=>{size+=data.length;if(size>DYNAMIC_LIMITS.maxResourceBytes){res.destroy();return reject(failure('RESOURCE_TOO_LARGE','Resource too large'));}chunks.push(data);});
    res.on('error',()=>reject(failure('RESPONSE_FAILED','Resource read failed')));
    res.on('end',()=>{if(!settled){settled=true;ok({status:200,contentType:type,body:Buffer.concat(chunks)});}});
   });
   req.on('error',()=>reject(failure('HTTPS_REQUEST_FAILED','TLS or HTTPS request failed')));
   req.on('timeout',()=>{req.destroy();reject(failure('HTTPS_TIMEOUT','Resource request timed out'));});
   req.end();
  }catch{reject(failure('HTTPS_REQUEST_FAILED','Resource request could not start'));}
 });
}

export function redactedResourcePath(raw,target){
 try{const u=new URL(raw);return u.origin===new URL(target).origin?u.pathname.slice(0,160):null;}catch{return null;}
}
export const STATIC_VISUAL_CSP="default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";
export const LOCKDOWN_CSP="default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-src 'none'; worker-src 'none'; form-action 'none'; base-uri 'none'";
