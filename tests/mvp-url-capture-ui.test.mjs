import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const ui=new URL('../studio/public/mvp.js',import.meta.url);
const html=new URL('../studio/public/mvp.html',import.meta.url);
class Element {
 constructor(id){this.id=id;this.value='';this.textContent='';this.hidden=false;this.disabled=false;this.listeners={};this.items=[];this.dataset={mode:id};this.attrs={};this.href='';this.src='';}
 addEventListener(type,listener){this.listeners[type]=listener;}
 submit(){return this.listeners.submit({preventDefault(){}});}
 replaceChildren(...children){this.items=[...children];}
 append(...children){this.items.push(...children);}
 add(option){this.items.push(option);}
 setAttribute(name,value){this.attrs[name]=value;}
 removeAttribute(name){delete this.attrs[name];}
}
const json=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});

test('MVP URL capture submits only after explicit click, rejects unapproved targets, then builds once',async()=>{
 const htmlText=await readFile(html,'utf8');
 assert.match(htmlText,/<form id="capture-form">/);
 assert.match(htmlText,/<form id="build-form">/);
 assert.ok(htmlText.indexOf('<form id="capture-form">')<htmlText.indexOf('<form id="build-form">'));
 const elements=new Map();
 const ids=['data','run','source','target-url','authorized-sites','capture','build','capture-status','status','preview','artifact','download','theme','requirements','build-form','capture-form','measure-faithful','visual-photos','comparison-source','comparison-generated','visual-status'];
 for(const id of ids)elements.set(id,new Element(id));
 elements.get('theme').value='paper';
 const tabs=['faithful','remix','schema'].map(x=>new Element(x));
 let calls=[],approved=['https://approved-demo.example.org/'];
 const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 const outputs=Object.fromEntries(['faithful','remix','schema'].map(mode=>[mode,{sha256:'f'.repeat(64),bytes:123,
  preview_url:'/api/runs/'+id+'/mvp/'+mode,download_url:'/api/runs/'+id+'/mvp/'+mode+'-download'}]));
 const fetch=async(path,options={})=>{
  calls.push({path,method:options.method||'GET',body:options.body});
  if(path==='/api/targets')return json({approved_urls:approved,fixture:'http://127.0.0.1:4317/'});
  if(path==='/api/runs'&&options.method==='POST')return json({id},202);
  if(path==='/api/runs')return json({runs:calls.some(c=>c.path==='/api/runs'&&c.method==='POST')
   ?[{id,status:'completed',mode:'static-visual',created_at:'now',target_url:approved[0]}]:[]});
  if(path==='/api/runs/'+id)return json({status:'completed'});
  if(path==='/api/runs/'+id+'/report')return json({reconstruction_available:true});
  if(path==='/api/runs/'+id+'/mvp-build')return json({modes:outputs,source_site_refetched:false},201);
  if(path==='/api/runs/'+id+'/mvp')return json({modes:outputs});
  throw Error('Unexpected network path '+path);
 };
 runInNewContext(await readFile(ui,'utf8'),{
  document:{getElementById:id=>elements.get(id),querySelectorAll:()=>tabs},Option:class Option{constructor(label,value){this.label=label;this.value=value;}},
  fetch,setTimeout,console
 });
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.some(c=>c.method==='POST'),false,'page initialization must not start capture');
 assert.equal(elements.get('target-url').value,approved[0]);
 elements.get('target-url').value='https://not-approved.example.org/';
 await elements.get('capture-form').submit();
 assert.equal(calls.some(c=>c.method==='POST'),false,'unapproved URL never submitted');
 elements.get('target-url').value=approved[0];
 await elements.get('capture-form').submit();
 assert.deepEqual(calls.filter(c=>c.method==='POST').map(c=>c.path),['/api/runs','/api/runs/'+id+'/mvp-build']);
 const capture=JSON.parse(calls.find(c=>c.path==='/api/runs'&&c.method==='POST').body);
 assert.deepEqual(capture,{target_url:approved[0],analysis_mode:'static-visual'});
 assert.equal(elements.get('run').value,id);
 assert.equal(elements.get('preview').src,'/api/runs/'+id+'/mvp/faithful');
 assert.equal(elements.get('capture').disabled,false);
 assert.match(elements.get('capture-status').textContent,/완료/);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.filter(c=>c.path==='/api/runs'&&c.method==='POST').length,1);
});
