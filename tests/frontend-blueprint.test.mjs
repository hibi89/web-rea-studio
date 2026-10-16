import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectFrontendHtml} from '../studio/frontend-blueprint.mjs';
test('static blueprint captures visual code hints and never stores HTML contents',()=>{
 const html='<main><header></header><canvas></canvas><svg></svg><style>.x{color:#AABBCC}</style><script>fetch("/api");</script><script src="https://cdn.example.org/js/app.js"></script></main>';
 const value=inspectFrontendHtml(html,'https://owner.example.org/');
 assert.equal(value.tags.canvas,1);
 assert.equal(value.tags.header,1);
 assert.equal(value.scripts.total,2);
 assert.equal(value.scripts.fetch_markers,1);
 assert.ok(value.css.colors.includes('#aabbcc'));
 assert.equal(value.resources[0].host,'cdn.example.org');
 assert.equal(value.api_replay,'not_attempted');
 assert.ok(!JSON.stringify(value).includes('fetch("/api")'));
});
