import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {parseDataset} from '../studio/mechanism-data.mjs';
import {generateMechanismDashboard} from '../studio/mechanism-dashboard.mjs';
const mapping={dimension:'region',group:'month',measure:'revenue'};
class Element {
 constructor(id=''){this.id=id;this.children=[];this.listeners={};this.attributes={};this.value='';this.textContent='';this.disabled=false;}
 addEventListener(event,fn){this.listeners[event]=fn;}
 replaceChildren(...nodes){this.children=nodes;this.value=nodes[0]?.value??'';}
 appendChild(node){this.children.push(node);return node;}
 remove(){}
 add(node){this.children.push(node);}
 setAttribute(key,value){this.attributes[key]=String(value);}
 async fire(event,details){return await this.listeners[event]?.(details??{target:this});}
}
function openOfflineHtml(html){
 const items=new Map();
 const get=id=>{if(!items.has(id))items.set(id,new Element(id));return items.get(id)};
 get('initial-rows').textContent=/<script type="application\/json" id="initial-rows">([^<]*)<\/script>/.exec(html)[1];
 get('initial-mapping').textContent=/<script type="application\/json" id="initial-mapping">([^<]*)<\/script>/.exec(html)[1];
 const script=/<script>([\s\S]*)<\/script><\/body>/.exec(html)[1];
 const doc={getElementById:get,createElementNS:(_namespace,name)=>new Element(name),createElement:name=>new Element(name),documentElement:{outerHTML:'<html></html>'},body:new Element('body')};
 const ctx={document:doc,Option:class{constructor(label,value){this.text=label;this.value=value}},console,
   URL:{createObjectURL:()=> 'blob:local',revokeObjectURL:()=>{}},Blob,setTimeout:()=>{},Intl};
 vm.runInNewContext(script,ctx,{timeout:3000});return get;
}
test('generated offline browser script updates KPI and SVG together',async()=>{
 const rows=parseDataset(await readFile(new URL('../fixtures/mechanisms/sales.csv',import.meta.url),'utf8'),'csv');
 const get=openOfflineHtml(generateMechanismDashboard(rows,mapping));
 const total=()=>get('total').textContent;
 const bars=()=>get('chart').children.filter(child=>child.id==='rect').length;
 assert.equal(total(),'870');assert.equal(bars(),3);
 for(const [selected,expected,label] of [['KR','450','2026-03=200'],['US','270','2026-03=120'],['JP','150','2026-03=75']]){
  get('region').value='v:'+selected;await get('region').fire('change');
  assert.equal(total(),expected);
  assert.equal(bars(),3);
  assert.match(get('chart').attributes['aria-label'],new RegExp(label));
 }
});
test('local upload requires explicit mapping confirmation and updates totals',async()=>{
 const rows=parseDataset(await readFile(new URL('../fixtures/mechanisms/sales.json',import.meta.url),'utf8'),'json');
 const get=openOfflineHtml(generateMechanismDashboard(rows,mapping));
 const file={name:'mine.csv',size:60,text:async()=> 'place,period,amount\nA,Jan,8\nB,Jan,4\nA,Feb,12'};
 await get('upload').fire('change',{target:{files:[file]}});
 assert.equal(get('export').disabled,true);assert.match(get('status').textContent,/매핑/);
 await get('apply').fire('click');
 assert.equal(get('total').textContent,'24');assert.equal(get('export').disabled,false);
 get('region').value='v:A';await get('region').fire('change');
 assert.equal(get('total').textContent,'20');
});
