import assert from 'node:assert/strict';
import {runSyntheticCorsChrome} from '../studio/synthetic-cross-origin-browser.mjs';

const browserPath=process.env.CHROME_BIN;
if(!browserPath)throw Error('REAL_CHROME_REQUIRED');

const denied=await runSyntheticCorsChrome({browserPath,allowApi:false,sendCors:false});
assert.equal(denied.source,'isolated-two-origin-chrome-fixture');
assert.equal(denied.app_state,'failed');
assert.equal(denied.app_fetch_attempts,1);
assert.equal(denied.synthetic_api_responses,0);
assert.equal(denied.network_requests_to_real_hosts,0);
assert.equal(denied.actual_external_api_calls,0);

const missingCors=await runSyntheticCorsChrome({browserPath,allowApi:true,sendCors:false});
assert.equal(missingCors.app_state,'failed');
assert.equal(missingCors.app_fetch_attempts,1);
assert.equal(missingCors.synthetic_api_responses,1);
assert.equal(missingCors.network_requests_to_real_hosts,0);
assert.equal(missingCors.actual_external_api_calls,0);

const verified=await runSyntheticCorsChrome({browserPath,allowApi:true,sendCors:true});
assert.equal(verified.app_state,'ready:31');
assert.equal(verified.app_fetch_attempts,1);
assert.equal(verified.synthetic_api_responses,1);
assert.equal(verified.network_requests_to_real_hosts,0);
assert.equal(verified.actual_external_api_calls,0);

console.log(JSON.stringify({p2_synthetic_two_origin_chrome:'PASS',
 denied_state:denied.app_state,
 no_cors_state:missingCors.app_state,
 explicitly_allowed_state:verified.app_state,
 all_requests_synthetic:true,
 real_external_api_calls:0}));
