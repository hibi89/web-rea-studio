import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const base=new URL('../preview/',import.meta.url);
const read=async p=>readFile(new URL(p,base),'utf8');
test('public page uses static assets and visibly labels itself as a demo',async()=>{
 const html=await read('index.html');
 assert.match(html,/PUBLIC PREVIEW/);
 assert.match(html,/샘플 보기/);
 assert.match(html,/readonly/);
 assert.doesNotMatch(html,/src="https?:\/\//);
});
test('public JavaScript cannot run the networked studio or silently mislabel mock evidence',async()=>{
 const js=await read('app.js');
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage/);
 assert.match(js,/demo:true,live:false/);
 assert.match(js,/SAMPLE/);
 assert.match(js,/preventDefault\(\)/);
});
test('static directory CSP denies any outbound connection',async()=>{
 const c=JSON.parse(await read('vercel.json'));
 const headers=c.headers[0].headers;
 const csp=headers.find(h=>h.key==='Content-Security-Policy').value;
 assert.match(csp,/connect-src 'none'/);
 assert.match(csp,/form-action 'none'/);
 assert.match(csp,/default-src 'none'/);
});
