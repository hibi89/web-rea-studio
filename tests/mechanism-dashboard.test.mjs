import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseDataset} from '../studio/mechanism-data.mjs';
import {generateMechanismDashboard} from '../studio/mechanism-dashboard.mjs';
const map={dimension:'region',group:'month',measure:'revenue'};
test('standalone generated HTML contains inline runtime, CSP hash and no remote dependency',async()=>{
 const rows=parseDataset(await readFile(new URL('../fixtures/mechanisms/sales.csv',import.meta.url),'utf8'),'csv');
 const html=generateMechanismDashboard(rows,map);
 assert.match(html,/<svg id="chart"/);
 assert.match(html,/script-src &#39;sha256-|script-src 'sha256-/);
 assert.match(html,/function chartCrossfilter/);
 assert.doesNotMatch(html,/<script\s+src|<link\s+href|\bfetch\s*\(/);
});
test('untrusted user value is escaped inside inert JSON and script cannot be broken',()=>{
 const html=generateMechanismDashboard([{region:'</script><img src=x onerror=alert(1)>',month:'Jan',revenue:1}],map);
 assert.doesNotMatch(html,/<img\s+src/);
 assert.equal((html.match(/<script\b/g)||[]).length,3);
 assert.match(html,/\\u003c\/script>/);
});
test('malformed numeric mapping fails before emitting document',()=>{
 assert.throws(()=>generateMechanismDashboard([{region:'KR',month:'Jan',revenue:'not a number'}],map),/INVALID_MEASURE/);
});
