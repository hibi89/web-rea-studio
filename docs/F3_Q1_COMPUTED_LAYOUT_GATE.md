# F3/Q1 — Computed CSS Grid and Horizontal Overflow Chrome Gate

Date 2026-10-17 KST. Feature SHA `61552d4a0f74b8fcd065fb5fdffc4a7236babca1`, verified GitHub workflow [39034558612](https://github.com/hibi89/web-rea-studio/actions/runs/39034558612): **first attempt mandatory 3/3 jobs SUCCESS**, Linux Node22 **273/273 PASS**, Windows Node22 **273/273 PASS**, Windows Node24 required Chrome/owner-style job SUCCESS.

## Evidence boundary and issue

The previous unit generated anonymized 3×3 geometry HTML and proved that real Chrome rendered a 1440×900 desktop and a 390×844 viewport. PNG dimension alone does *not* prove CSS generated the expected grid columns, correct zone reading order, or lack of horizontal overflow. It also does not prove the original website's mobile design. No external source will be revisited; this work concerns only anonymous, synthetic HTML generated from bounded saved passive category/geometry observations.

## Implementation

New `studio/f3-q1-layout-proof.mjs` contains `ANONYMOUS_LAYOUT_PROBE`, a fixed read-only CDP expression: it reads exactly the generated `.zones` grid and direct `.zone` children, `getComputedStyle(...).gridTemplateColumns`, nine bounding rectangles, viewport width, document scroll/client widths and native interactive control count. It does not read text, URLs, form values, auth or original source and does not execute page actions. `sanitizeAnonymousLayoutProbe` bounds all returned coordinates/counters and rejects malformed/non-pixel CSS.

`assessAnonymousLayout({measurement,viewport})` rejects missing/invalid measurements; mismatched viewport/client width; zone count other than 9; nonzero native controls; document horizontal overflow; expected computed column mismatch (3 on desktop, 1 at ≤640px); offscreen or invalid grid and zone bounds; wrong desktop row-major or mobile stacked reading order. A PASS returns only coarse sanitized gate findings rather than stored measurement pixels and still carries `original_site_layout_verified:false`, `source_mobile_layout_verified:false`.

`studio/dynamic-browser.mjs` accepts opt-in `observeAnonymousLayout:false` by default and only when **`scriptsDisabled:true`**, **`offlineViewport` explicitly bounded**, and **custom memory relay** rather than the gateway. An unapproved invocation fails `ANONYMOUS_LAYOUT_PROBE_DENIED` before Chrome launches. The fixed probe does not run in ordinary `dynamic-passive`, `static-visual`, or owner-site capture flows; the output appears only as `inspection.page.offline_anonymous_layout` in opted-in synthetic render results. Existing browser/capture behavior, Studio downloads and F3/Q1 HTML bytes remain unchanged.

## Tests and observed Chrome facts

`tests/f3-q1-layout-proof.test.mjs` adds four pure tests for expression shape/redaction, 3-column desktop, 1-column mobile and overflow blocking, as well as wrong grid count, tampered viewport, native controls, misplaced zones and wrong order.

Required `tests/f3-q1-geometry-preview-chrome-e2e.mjs` now independently reads computed CSS from real isolated Chrome in **both original synthetic generated views**:

| Evidence | Desktop | Mobile |
| --- | --- | --- |
| Requested viewport | 1440×900 | 390×844 |
| Actual screenshot | 1440×900 | 390×1087 full-page |
| Computed grid columns | 3 | 1 |
| Measured zones | 9 | 9 |
| Horizontal overflow | false | false |
| Native controls | 0 | 0 |
| External/site requests | 0 | 0 |

A separate third Chrome rendering of an **intentionally wrong four-column** generated CSS test produced `BLOCKED` with reason `COMPUTED_GRID_COLUMNS_MISMATCH`. Test log marks `f3_q1_adverse_four_column_gate: PASS`, `f3_q1_geometry_two_viewports: PASS`. All three Chrome test HTML documents were served via synthetic in-memory relay only. No real target actions/API/DB, external origin approvals, or remote website reconstruction were executed.

CI [39034558612](https://github.com/hibi89/web-rea-studio/actions/runs/39034558612): required 3/3 SUCCESS on first attempt. Linux and Windows Node22 each **273/273 PASS**; Windows24 required job SUCCESS. These results do **not** verify the original source layout, data loading, mobile responsive design, API behavior, backend parity or user's latest physical Windows environment.

## Next bounded unit

Connect these computed grid/overflow results with a **separately triggered, explicitly verified local Chrome acceptance receipt** bound to the exact generated anonymous HTML SHA-256, input evidence and two defined viewports. Do not make GET/download or refresh implicitly run Chrome. Block missing/tampered evidence and failed/partial Chrome captures; keep all original sites and permission boundaries untouched.
