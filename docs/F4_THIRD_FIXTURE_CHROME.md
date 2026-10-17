# F4 third synthetic browser fixture: planner

Date: 2026-10-17. Source SHA `88841b8c3ffb539b82da78dbd22d5f844102fe34`. Verified [Actions 39025370559](https://github.com/hibi89/web-rea-studio/actions/runs/39025370559).

## Decision and alternatives

| Path | Security / effort | Outcome |
| --- | --- | --- |
| Add a third fixture in isolated Chrome on the existing F4 state machine | No real network, bounded UI/action evidence, small code change | **Selected:** validates previously untested app schema without widening live scope |
| Immediately register a third complete Studio persisted run mode | Touches API routing, F3, F5 audits, receipts and downloads together | Defer until isolated browser proof passes |
| Use real external APIs and general active navigation | Permission, SSRF, authentication, CORS and live data risk | Not approved |

## Scope and changes

- `studio/generic-fixture-browser.mjs` adds a fixed `planner` profile with `day` / `layout` / `slots` state, two controlled actions (`day`, `view`) and an explicit reset. The date action fetches `/api/calendar?day=tuesday` only through CDP interception at the existing synthetic origin and receives `{slots:2}` in memory. It is never an actual API transfer.
- `studio/fixture-permissions.mjs` adds only the exact planner source DOM selectors to the existing fixed, test-only action policy; submit, destructive action, external link and password input remain denied. No ability to grant user URLs or external host methods.
- `tests/f4-generic-chrome-e2e.mjs` now requires **catalog, analytics and planner** to pass separately. It verifies exact request allow/deny, state observation, F2 graph paths, generated HTML lacking actual fetch/XHR/iframe/remote URL, real Chrome replay against observed transitions, and direct dispatch of disallowed action events to prove state/counters are immutable.
- The shared `studio/generic-behavior.mjs`, F4 graph planner and `studio/reconstruction-contract.mjs` remain unchanged. The `planner` Chrome result is checked by the same `compileObservedStateContract` as other fixture types.
- **Explicit boundary:** no new Studio UI choice, POST route, run persistence, F3 manifest export, F5 stored-chain audit or reviewed download for planner yet. Existing authorized run types, original evidence, credentials, external-network lockdown and deployment untouched.

## Verified evidence

- GitHub Actions: Linux Node22 **253/253 PASS**, Windows Node22 **253/253 PASS**, Windows Node24 full required job SUCCESS; **3/3 mandatory jobs SUCCESS**. Existing Windows browser smoke and acceptance succeeded.
- Linux real isolated Chrome: all 3 apps return `f4_generic_chrome:PASS`. For **planner**: 3 observed actions, 2 branching routes, 4 reachable states, 3 independently verified graph edges, 3 actions replayed, 5 unobserved events rejected, 3 approved and 4 denied DOM controls, 1 locally simulated API call, 0 real external API calls, generated independent HTML 4,582 bytes.
- Browser proof is from a fixture with an in-memory source and faked API response. It **does not** establish original website behavior, user-origin permissions, recovered JavaScript, live API, actual database, mobile viewport parity, or source authenticity.

## Next bounded task

On next `3`, unify a third fixture's **local Studio** POST/run evidence/manifest/F4 export/F5 chain audit while preserving the old two modes' exact saved outputs and existing read-only GET semantics. Require full Linux/Windows CI and isolated Chrome verification again. External-site host/path/method approval is a separate Q1 gate.
