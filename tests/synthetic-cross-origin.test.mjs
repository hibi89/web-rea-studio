import test from 'node:test';
import assert from 'node:assert/strict';
import {SYNTHETIC_PAGE_ORIGIN,SYNTHETIC_API_ORIGIN,
 classifySyntheticCorsRequest,syntheticDocumentCsp,runSyntheticCorsChrome}
 from '../studio/synthetic-cross-origin-browser.mjs';

const page=SYNTHETIC_PAGE_ORIGIN+'/';
const api=SYNTHETIC_API_ORIGIN+'/v1/report?view=summary';
const classify=(url,resourceType='Fetch',method='GET',allowApi=false)=>
 classifySyntheticCorsRequest({url,resourceType,method},{allowApi});

test('external domain denied by default; only exact preselected synthetic GET/Fetch approved',()=>{
 assert.equal(classify(page,'Document'), 'document');
 assert.equal(classify(api),null);
 assert.equal(classify(api,'Fetch','GET',true),'api');
 assert.equal(classify(api,'XHR','GET',true),'api');
 for(const scenario of [
  [api,'Fetch','POST'],[api,'Document','GET'],[api,'Script','GET'],
  [api.replace('summary','detail'),'Fetch','GET'],
  [api.replace('/v1/report','/v1/delete'),'Fetch','GET'],
  ['https://api.evil.example.org/v1/report?view=summary','Fetch','GET'],
  ['http://api.webrea-cors-fixture.example.org/v1/report?view=summary','Fetch','GET'],
  ['https://name:pass@api.webrea-cors-fixture.example.org/v1/report?view=summary','Fetch','GET'],
  [api+'#fragment','Fetch','GET'],['javascript:alert(1)','Fetch','GET'],
  [SYNTHETIC_PAGE_ORIGIN+'/other','Document','GET']
 ])assert.equal(classify(...scenario,true),null,scenario[0]);
 assert.equal(classify(page,'Document','POST'),null);
});

test('CSP defaults to self and only explicit fixture state permits its exact API origin',()=>{
 const denied=syntheticDocumentCsp();
 const granted=syntheticDocumentCsp({allowApi:true});
 assert.match(denied,/connect-src 'self';/);
 assert.doesNotMatch(denied,new RegExp(SYNTHETIC_API_ORIGIN));
 assert.match(granted,new RegExp("connect-src 'self' "+SYNTHETIC_API_ORIGIN.replaceAll('.','\\.')));
 for(const csp of [denied,granted]){
  assert.match(csp,/form-action 'none'/);
  assert.match(csp,/frame-src 'none'/);
  assert.doesNotMatch(csp,/connect-src \*/);
 }
});

test('real-Chrome synthetic fixture rejects runtime invalid options before any browser launch',async()=>{
 await assert.rejects(runSyntheticCorsChrome({browserPath:'',allowApi:true}),/CORS_TEST_OPTIONS_INVALID/);
 await assert.rejects(runSyntheticCorsChrome({browserPath:'/synthetic/not-used',allowApi:'yes'}),/CORS_TEST_OPTIONS_INVALID/);
});
