# F4 planner: real Chrome → local Studio → F3/F4/F5 reviewed export

Date: 2026-10-17 (KST). Verified feature source SHA `f18115b8b8fde1e1916e1c96a79e852f06ad9693`. CI [`39026903014`](https://github.com/hibi89/web-rea-studio/actions/runs/39026903014), final successful **run attempt 2**.

## Decision and scope

The third `planner` synthetic source passed real isolated Chrome F2/F4 observation and replay in the preceding work unit. The product gap was that the local Studio UI/API and persisted evidence/export still allowed only `catalog` and `analytics`.

Two options: (A) implement a generic user-supplied fixture registry and broad remote target mode; (B) admit just the already-observed planner profile into the existing exact-local-fixture Studio chain. **B chosen** to avoid privilege escalation, arbitrary scripts, remote API reproduction, or changing the existing two modes' state model.

## Changes

- `studio/server.mjs`: exact `fixture-generic-planner` on the already-approved `127.0.0.1` fixture URL; new profile maps to the existing allowlisted Chrome observer, fixed policy, source replay, F3 manifest, graph, standalone HTML, generated reconstruction contract and saved report. Read-only graph/contract/preview/F5 audit/reviewed export work for this mode. External target never accepts this mode.
- `studio/evidence-manifest.mjs`: controlled synthetic planner is a trusted *mode*; narrow safe state representation for `day`/`slots`, `monday`/`tuesday`. Never admits arbitrary text/credentials.
- `studio/controlled-chain-audit.mjs`, `studio/reconstruction-contract.mjs`, `studio/reviewed-delivery.mjs`: bounded third app ID and reviewed export filename; existing evidence checks and 409 conflict behavior retained. No origin or backend equivalence assertions.
- `studio/public/index.html`, `studio/public/app.js`: planner option shown and enabled only for exact local fixture target; F5 reviewed-export panel accessible for completed planner runs.
- Tests: existing `tests/generic-studio.test.mjs`, `tests/reconstruction-contract.test.mjs`, `tests/reviewed-delivery.test.mjs` now cover three modes in offline Node/HTTP. A new **independent true-browser Studio POST** acceptance `tests/f4-planner-studio-chrome-e2e.mjs` runs the real Chrome source observer and verifier through the actual server, fetches F3/graph/contract/audit/receipt/HTML, and then tampers stored manifest to require audit conflict and 409 refusal. New compulsory Linux Chrome CI step added.

## Final evidence

- GitHub workflow `39026903014`, final **attempt 2**: Linux Node22 **254/254 PASS**, Windows Node22 **254/254 PASS**, Windows Node24 required test/Chrome/launcher/owner-style acceptance **SUCCESS**, three jobs **SUCCESS**.
- Linux real isolated F4 Chrome: catalog/analytics/planner each **3** observed/replayed actions, **2** branching routes, **4** states, **3** graph edges, **5** rejected unobserved actions, **0** external API calls.
- Separate planner Studio Chrome end-to-end reports `planner_studio_full_chrome:PASS`: 3 actions, 2 routes, 4 states, 0 external API calls, generated standalone HTML **4,582 bytes**, SHA-256 `f2b687887502dd5973f72e06df306f1b52551ed092069cb6246cd2b38a720b4a`, `manifest_tamper_export_blocked:true`.
- **Important failure history:** initial attempt 1 at the same source SHA failed in the **preexisting P4 Chrome startup test** with `CDP_START_TIMEOUT` (debugging port file missing); new planner Chrome end-to-end had not yet run. No source change was made; exactly one failed Linux job rerun, attempt 2 succeeded. No claim the root cause was fixed.

## Safety, nonclaims and next work

All source fixture data and API responses are synthesized and intercepted in process. This did **not** access a third-party website's additional API, credentials, cookies, database, JavaScript implementation or off-origin host. Returned SHA-256 receipts are unsigned and assert stored artifact coherence only, not source authenticity; F5 Chrome isn't rerun by GET. No external-site backend parity, owner physical Windows final acceptance, deployment or cost. On next `3`, favor an offline, provenance-aware **real-site passive observation → F3 missing data/function gap contract**; require a separate user permission boundary before any active third-party behavior/API investigation.
