import test from 'node:test';
import assert from 'node:assert/strict';
import {runDynamicAnalysis,staticVisualCaptureSpec} from '../studio/dynamic-browser.mjs';

const base={target:'https://controlled.example.org/',browserPath:'/synthetic/chrome',
 dir:'/unneeded/testing',timeoutMs:1000};
const offlineRelay=async()=>{throw Error('A rejected viewport must never launch or call relay');};

test('alternate viewport cannot modify external/live rendering policy',async()=>{
 for(const opts of [
  {scriptsDisabled:false,relay:offlineRelay,offlineViewport:{width:900,height:900}},
  {scriptsDisabled:true,offlineViewport:{width:900,height:900}},
  {scriptsDisabled:true,relay:offlineRelay,offlineViewport:{width:200,height:900}},
  {scriptsDisabled:true,relay:offlineRelay,offlineViewport:{width:900,height:1200}},
  {scriptsDisabled:true,relay:offlineRelay,offlineViewport:{width:900,height:900,deviceScaleFactor:2}},
  {scriptsDisabled:true,relay:offlineRelay,offlineViewport:{width:900.5,height:900}},
  {scriptsDisabled:true,relay:offlineRelay,offlineViewport:{width:900}},
 ]){
  await assert.rejects(runDynamicAnalysis({...base,...opts}),{
   code:'OFFLINE_VIEWPORT_REJECTED'
  });
 }
});
test('bounded viewport capture width follows provided synthetic-only size',()=>{
 const spec=staticVisualCaptureSpec({cssContentSize:{height:1200}},
  {width:900,height:900,maxHeight:4000});
 assert.deepEqual(spec.clip,{x:0,y:0,width:900,height:1200,scale:1});
 assert.equal(spec.truncated,false);
});
