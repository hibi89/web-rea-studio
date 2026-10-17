import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPassiveDependencyReview} from '../studio/passive-dependencies.mjs';
test('saved evidence yields host-only review and sanitized same-origin API grouping',()=>{
 const output=buildPassiveDependencyReview({mode:'dynamic-passive',report:{fetch_rejections:1},inspection:{network:[
  {kind:'requested',path:'/api/report',resource_type:'Fetch'},
  {kind:'fulfilled',path:'/api/report',status:200},
  {kind:'fetch-attempt',scope:'other-origin',host:'api.example.net',url:'https://api.example.net/PRIVATE?token=VERY_SECRET'},
  {kind:'fetch-rejected',scope:'other-origin',host:'api.example.net'},
  {kind:'xhr-open',scope:'other-origin',host:'other.example.net'},
 ]}});
 assert.equal(output.network_requests_issued,0);
 assert.deepEqual(output.external_hosts_approved,[]);
 assert.deepEqual(output.external_permission_review.candidate_hosts,['api.example.net']);
 assert.equal(output.dependencies.find(x=>x.path==='/api/report').fulfilled,1);
 assert.equal(output.dependencies.find(x=>x.host==='other.example.net').permission_review_required,false);
 assert.equal(output.summary.missing_fetch_details,false);
 assert.ok(!JSON.stringify(output).includes('VERY_SECRET'));
 assert.ok(!JSON.stringify(output).includes('/PRIVATE'));
});
test('unmatched, sensitive or unverified input never grants approval',()=>{
 const review=buildPassiveDependencyReview({mode:'dynamic-passive',report:{fetch_rejections:3},inspection:{network:[
  {kind:'fetch-attempt',scope:'other-origin',host:'api-a.example.net'},
  {kind:'fetch-rejected',scope:'other-origin',host:'api-b.example.net'},
  {kind:'fetch-attempt',scope:'other-origin',host:'api-x.example.net@host.local'},
  {kind:'requested',path:'/api/report?token=SECRET'},
  {kind:'requested',path:'/users/9049'},
  {kind:'blocked',path:'/api/report',reason:'HTTP_REJECTED'},
  {kind:'browser-failed',scope:'other-scheme',path:'/PRIVATE'},
  {kind:'requested',scope:'other-origin',host:'api.example.net',path:'/SECRET'}
 ]}});
 assert.deepEqual(review.external_permission_review.candidate_hosts,[]);
 assert.equal(review.summary.missing_fetch_details,true);
 assert.equal(review.dependencies.find(x=>x.path==='/api/report').assessment,'resource_blocked');
 assert.ok(!JSON.stringify(review).includes('SECRET'));
 assert.ok(!JSON.stringify(review).includes('9049'));
 assert.ok(!JSON.stringify(review).includes('/PRIVATE'));
});
test('legacy evidence is unknown and only passive mode is allowed',()=>{
 const x=buildPassiveDependencyReview({mode:'dynamic-passive'});
 assert.equal(x.summary.missing_fetch_details,true);
 assert.deepEqual(x.dependencies,[]);
 assert.throws(()=>buildPassiveDependencyReview({mode:'rea-browser'}),/PASSIVE_ONLY/);
});
