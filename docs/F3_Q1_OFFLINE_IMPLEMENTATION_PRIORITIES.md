# F3/Q1 — bounded offline implementation priority plan

Date: 2026-10-17 (KST). Verified functional SHA `7d6fbc65596ca005cf8f4c5230d9552430098f0a`. [Actions 39030452759](https://github.com/hibi89/web-rea-studio/actions/runs/39030452759) first attempt: Linux Node22 263/263 PASS, Windows Node22 263/263 PASS, Windows Node24 required smoke/Chrome/owner-style acceptance SUCCESS; 3/3 mandatory jobs SUCCESS.

## Goal / alternatives

Prior F3/Q1 readiness identified that the real source remains unverified and all live network/action privileges are denied. The missing product question was *what concrete engineering task can be done safely now?* Compared (A) automatically generate convincing real-site pages, buttons/API clients from passive labels/traffic and (B) separate anonymous, observed UI **planning** from blocked behavior/data/API/DB integration and expose evidence prerequisites. Chose B: A invents behavior and overstates authorization. No external requests or permissions were added.

## Exact change

- `studio/f3-q1-work-plan.mjs` deterministically computes **both** `assessF3Q1Readiness` and `buildPassiveGapContract` for the same stored `dynamic-passive` inspection/report/diagnosis. It checks both output counts, security state and unresolved gap cardinality.
- Tasks are ordered from P0 saved provenance review through observed UI affordance category-count outlines (P1), capture completeness, real action transitions, control/API proof, redacted response schema, original backend/DB contract, explicit external API access authorization and original-site parity verification (P2–P8).
- A category-level task gets `PLANNABLE_OFFLINE_ONLY` **only** when evidence is internally coherent and F3/Q1 allows `OBSERVED_UI_CATEGORIES_ONLY`. Planning is strictly noninteractive; no HTML/CSS/source/renderer is emitted at this stage. Missing/contradictory source evidence blocks all UI planning.
- Work plan status remains either `UI_PRESENCE_PLANNING_ONLY`, `INSUFFICIENT_EVIDENCE` or `EVIDENCE_CONFLICT`. Fixed `BLOCK_REAL_SITE_RECONSTRUCTION` and `BLOCK_NETWORK_EXPANSION`, `NOT_APPROVED`. Every task declares no implementation verification, no original parity and no grant of authority.
- Local Studio GET `/api/runs/:id/f3-q1-work-plan` for **failed/interrupted passive** only, not any synthetic app. 404 for unsupported mode and missing inspection; 409 for invalid run status or mismatched stored inspection. GET accesses only existing local storage and performs no new capture/browser/source request.
- UI failure diagnosis has an additional downloadable `F3/Q1 구현 우선순위·차단 항목 JSON` and explicitly distinguishes offline category planning count from blocked tasks. Link resets on run changes. Raw host, URL path, form contents, labels, response bodies, tokens and credentials are omitted.

## Test evidence

`tests/f3-q1-work-plan.test.mjs` adds 3 tests. (1) A synthetic redacted saved failed passive capture with buttons, links, password input and matched external attempt/rejection yields only noninteractive presence planning, all action/network/DB tasks blocked, no private fields leaked. (2) contradictory saved fetch counts or missing control evidence disables planning and maintains denial; unsupported fixture/mode throws. (3) real local Studio POST stub once -> saved failed run -> repeat read-only GET gives identical JSON while executor is run once; completed/missing/synthetic modes rejected; UI exposed.

GitHub Actions `39030452759` all 3 required jobs SUCCESS in first attempt: Linux Node22 **263/263**, Windows Node22 **263/263**, Windows Node24 mandatory job SUCCESS; existing real isolated Chrome synthetic catalog/analytics/planner and P4/F5 regression accepted. This demonstrates the **offline task scheduler/decision safety**, not a recreation of the live target or owner's current physical Windows acceptance.

## Next implementation unit

Build a strictly **anonymized and non-executable** local HTML/CSS wireframe from `PLANNABLE_OFFLINE_ONLY` control categories/counts only, under an explicit disabled-action/zero-network CSP. Validate a rendered preview in isolated Chrome. If no safe plan exists, return a blocked receipt instead of generating HTML. Do not claim source appearance, real data, active interaction, API/backend or original-site functional parity. Real external host/path/method authorization remains a separate owner-approved step; deployment/cost/physical owner PC test out of scope.
