import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {P4_GEOMETRY_PROBE,sanitizeP4Geometry,generateP4Reconstruction}
 from '../studio/p4-reconstruction.mjs';

const base=()=>({source:'p4-geometry',viewport:{width:1440,height:900},
 document:{width:1440,height:900},body_color:'rgb(249, 250, 253)',
 boxes:[{tag:'main',depth:2,x:0,y:0,w:1440,h:900,background:'rgb(249, 250, 253)',
  border_color:'transparent',border_width:'0px',radius:'0px'}],
 titles:[{tag:'h1',x:60,y:50,w:215,h:120,text:'Measured heading wrapping in Chrome',
  color:'rgb(30, 34, 57)',font_size:'32px',font_weight:'700'}]});

test('P4 measured typography preserves safe wrapping, alignment, line height in standalone scriptless HTML',()=>{
 const x=base();
 Object.assign(x.titles[0],{white_space:'normal',line_height:'37px',text_align:'center'});
 const geometry=sanitizeP4Geometry(x);
 assert.equal(geometry.titles[0].white_space,'normal');
 assert.equal(geometry.titles[0].line_height,'37px');
 assert.equal(geometry.titles[0].text_align,'center');
 const html=generateP4Reconstruction(geometry);
 assert.match(html,/white-space:normal;line-height:37px;text-align:center;/);
 assert.match(html,/Measured heading wrapping in Chrome/);
 assert.match(html,/script-src &#39;none&#39;/);
 assert.doesNotMatch(html,/<script\b|<iframe\b|https?:\/\//);
});
test('legacy P4 heading output retains original default style and no new CSS fields',()=>{
 const geometry=sanitizeP4Geometry(base());
 assert.equal(Object.hasOwn(geometry.titles[0],'line_height'),false);
 assert.equal(Object.hasOwn(geometry.titles[0],'white_space'),false);
 const html=generateP4Reconstruction(geometry);
 assert.match(html,/\.label\{overflow:hidden;white-space:nowrap;line-height:1\.45\}/);
 assert.match(html,/font-weight:700;">Measured heading wrapping in Chrome/);
 assert.doesNotMatch(html,/text-align:center|line-height:37px/);
});
test('injected CSS/URLs in measured heading properties are dropped and not echoed',()=>{
 const x=base(),t=x.titles[0];
 t.white_space='normal; background:url(https://bad.invalid/)';
 t.line_height='37px;position:fixed';
 t.text_align='center;z-index:9999';
 t.text='Heading only';
 const html=generateP4Reconstruction(x);
 const titleTag=html.match(/<div class="label"[^>]*>/)?.[0];
 assert.ok(titleTag,'Generated safe heading required');
 assert.doesNotMatch(titleTag,/bad\.invalid|z-index:9999|position:fixed|white-space:normal;/);
 assert.doesNotMatch(html,/bad\.invalid|z-index:9999/);
 const out=sanitizeP4Geometry(x).titles[0];
 assert.equal(Object.hasOwn(out,'text_align'),false);
 assert.equal(Object.hasOwn(out,'line_height'),false);
 assert.equal(Object.hasOwn(out,'white_space'),false);
});
test('P4 probe collects ONLY preexisting heading text and measured styles, never input values',()=>{
 const root={tagName:'BODY',parentElement:null,textContent:''};
 const heading={tagName:'H1',parentElement:root,textContent:'Safe wrapping heading',
  getBoundingClientRect:()=>({left:60,top:40,width:220,height:120})};
 const styles={display:'block',visibility:'visible',opacity:'1',backgroundColor:'transparent',
  borderTopLeftRadius:'0px',borderTopWidth:'0px',borderTopColor:'transparent',
  color:'rgb(0, 0, 0)',fontSize:'32px',fontWeight:'700',lineHeight:'38px',
  whiteSpace:'pre-line',textAlign:'right'};
 const ctx={document:{body:root,documentElement:{scrollWidth:1440,scrollHeight:900},
  querySelectorAll:()=>[heading]},getComputedStyle:()=>styles,
  innerWidth:1440,innerHeight:900,scrollX:0,scrollY:0,parseFloat};
 const raw=runInNewContext(P4_GEOMETRY_PROBE,ctx,{timeout:1000});
 const out=sanitizeP4Geometry(raw);
 assert.equal(out.titles.length,1);
 assert.deepEqual([out.titles[0].white_space,out.titles[0].line_height,out.titles[0].text_align],
  ['pre-line','38px','right']);
 assert.doesNotMatch(P4_GEOMETRY_PROBE,/\bfetch\s*\(|\bclick\s*\(|\.value\b|localStorage|sessionStorage/);
});
