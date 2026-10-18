import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dimensionFilter} from '../skills/dashboard/dimension-filter.mjs';
import {groupBySum} from '../skills/dashboard/group-by-sum.mjs';
import {chartCrossfilter} from '../skills/dashboard/chart-crossfilter.mjs';
import {parseDataset,suggestMapping} from '../studio/mechanism-data.mjs';
import {validateMapping,buildMechanismSpec} from '../studio/mechanism-dashboard.mjs';
const mapping={dimension:'region',group:'month',measure:'revenue'};
const fixture=async file=>parseDataset(await readFile(new URL('../fixtures/mechanisms/'+file,import.meta.url),'utf8'),file.split('.').at(-1));
test('CSV and JSON fixtures drive same mapping and totals',async()=>{
 const csv=await fixture('sales.csv'),json=await fixture('sales.json');
 assert.equal(csv.length,9);assert.deepEqual(csv,json);assert.deepEqual(suggestMapping(csv),mapping);
 assert.equal(chartCrossfilter(csv,mapping,'KR',dimensionFilter,groupBySum).total,450);
});
test('all four selected regions recompute actual KPI and three chart values',async()=>{
 const rows=await fixture('sales.csv');
 for(const [selected,expected] of [[null,870],['KR',450],['US',270],['JP',150]]){
   const result=chartCrossfilter(rows,mapping,selected,dimensionFilter,groupBySum);
   assert.equal(result.total,expected);
   assert.equal(result.chart.reduce((sum,x)=>sum+x.total,0),expected);
   assert.equal(result.chart.length,3);
 }
});
test('invalid mapping, NaN, blank measure, inconsistent CSV rejected',async()=>{
 const rows=await fixture('sales.csv');
 assert.throws(()=>validateMapping(rows,{dimension:'region',group:'region',measure:'revenue'}),/INVALID_MAPPING/);
 assert.throws(()=>groupBySum([{a:'A',n:''}],'a','n'),/INVALID_MEASURE/);
 assert.throws(()=>groupBySum([{a:'A',n:'Infinity'}],'a','n'),/INVALID_MEASURE/);
 assert.throws(()=>parseDataset('region,month,revenue\nKR,Jan,1\nUS,Feb','csv'),/INVALID_ROW_WIDTH/);
});
test('HTML injection remains plain local CSV data',()=>{
 const value='<img src=x onerror=alert(1)>';
 assert.equal(parseDataset('region,month,revenue\n"'+value+'","Jan,Feb",10','csv')[0].region,value);
});
test('mechanism spec explicitly separates template and unknown provenance',async()=>{
 const spec=buildMechanismSpec(await fixture('sales.csv'),mapping);
 assert.equal(spec.inputs.length,3);assert.equal(spec.skills.length,3);
 assert.ok(spec.edges.every(x=>x.provenance==='template'));
 assert.equal(spec.api.provenance,'unknown');assert.equal(spec.reference.provenance,'template');
});
