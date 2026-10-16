import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {P4_GEOMETRY_PROBE,sanitizeP4Geometry,generateP4Reconstruction} from '../studio/p4-reconstruction.mjs';

const sample={
 source:'p4-geometry',
 viewport:{width:1440,height:900},document:{width:1440,height:1700},
 body_color:'rgb(248, 248, 255)',root_color:'transparent',candidates:120,
 boxes:[
  {tag:'body',depth:1,x:0,y:0,w:1440,h:1700,background:'rgb(240, 240, 250)',border_width:'0px',radius:'0px'},
  {tag:'aside',depth:3,x:0,y:0,w:198,h:1700,background:'rgb(255, 255, 255)',border_width:'0px',radius:'0px'},
  {tag:'section',depth:6,x:221,y:220,w:452,h:310,background:'rgb(255, 255, 255)',border_width:'1px',border_color:'rgb(230, 230, 245)',radius:'14px'},
 ],
 titles:[{tag:'h1',x:220,y:22,w:500,h:30,text:'대시보드',color:'rgb(31, 29, 58)',font_size:'24px',font_weight:'700'}]
};
test('P4 geometry capture reads no network, password input, scripts, or browser storage',()=>{
 assert.doesNotMatch(P4_GEOMETRY_PROBE,/\bfetch\s*\(|\bXMLHttpRequest\b|\bclick\s*\(|\blocalStorage\b|\bsessionStorage\b|\.value\b|\.innerHTML\b/);
 assert.match(P4_GEOMETRY_PROBE,/getBoundingClientRect/);
 assert.match(P4_GEOMETRY_PROBE,/getComputedStyle/);
});
test('P4 geometry is bounded and sanitized before saving',()=>{
 const contaminated=structuredClone(sample);
 contaminated.boxes.push({tag:'img',x:20,y:20,w:20,h:20,background:'url(https://evil.example/key)'});
 contaminated.titles[0].text='<script>alert("XSS")</script> https://evil.example/?token=PRIVATE';
 contaminated.boxes[0].background='url(https://evil.example/secret)';
 const x=sanitizeP4Geometry(contaminated);
 assert.equal(x.source,'p4-geometry');
 assert.equal(x.boxes.length,3);
 assert.equal(x.boxes[0].background,'transparent');
 assert.equal(x.document.height,1700);
 assert.equal(x.titles[0].text.includes('https:'),false);
 assert.equal(JSON.stringify(x).includes('PRIVATE'),false);
 assert.equal(JSON.stringify(x).includes('evil.example'),false);
 assert.equal(x.boxes[1].w,198);
});
test('P4 reconstruction is a standalone, scriptless local HTML/CSS and preserves geometry',()=>{
 const data=sanitizeP4Geometry(sample);
 const result=generateP4Reconstruction(data);
 assert.match(result,/<!doctype html>/);
 assert.match(result,/width:1440px;height:1700px/);
 assert.match(result,/left:0px;top:0px;width:198px;height:1700px/);
 assert.match(result,/대시보드/);
 assert.match(result,/script-src &#39;none&#39;/);
 assert.doesNotMatch(result,/<script\b|<iframe\b|<form\b|https?:\/\/|<link\b/);
 assert.match(result,/실제 데이터\/동작 없음/);
});
test('user-provided label cannot inject markup into the independent preview',()=>{
 const attack=structuredClone(sample);
 attack.titles[0].text='<img src=x onerror=alert(1)>';
 const html=generateP4Reconstruction(attack);
 assert.equal(html.includes('<img'),false);
 assert.equal(html.includes('onerror='),true); // Plain escaped text, not an HTML attribute.
 assert.match(html,/&lt;img/);
});
test('no usable geometry is rejected without generating a fake success',()=>{
 assert.throws(()=>generateP4Reconstruction({source:'p4-geometry',boxes:[],titles:[],viewport:{width:1440},document:{height:800}}),/unavailable/);
 assert.equal(sanitizeP4Geometry({source:'something-else'}),null);
});
test('P4 DOM probe returns visible card geometry and heading text in a controlled fake document',()=>{
 const root={tagName:'BODY',parentElement:null,textContent:''};
 const aside={tagName:'ASIDE',parentElement:root,textContent:'',
  getBoundingClientRect:()=>({left:0,top:0,width:198,height:900})};
 const heading={tagName:'H1',parentElement:root,textContent:'대시보드',
  getBoundingClientRect:()=>({left:220,top:20,width:300,height:40})};
 const values={
  display:'block',visibility:'visible',opacity:'1',backgroundColor:'rgb(255, 255, 255)',
  borderTopLeftRadius:'8px',borderTopWidth:'0px',borderTopColor:'rgb(0, 0, 0)',
  color:'rgb(30, 30, 30)',fontSize:'24px',fontWeight:'700'};
 const page={
  body:root,documentElement:{scrollWidth:1440,scrollHeight:900},
  querySelectorAll:()=>[aside,heading]
 };
 const ctx={document:page,getComputedStyle:()=>values,innerWidth:1440,innerHeight:900,scrollX:0,scrollY:0,parseFloat};
 const raw=runInNewContext(P4_GEOMETRY_PROBE,ctx,{timeout:1000});
 const out=sanitizeP4Geometry(raw);
 assert.equal(out.document.width,1440);
 assert.equal(out.boxes[0].tag,'aside');
 assert.equal(out.boxes[0].w,198);
 assert.equal(out.titles[0].text,'대시보드');
});
