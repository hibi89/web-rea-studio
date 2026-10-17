# F5 saved static pipeline audit — offline artifact coherence

Date: 2026-10-17. Read-only integration of existing evidence, not a new site capture or source-app cloning capability.

## Why this unit

The static visual workflow already creates independent scriptless P4 HTML and, when an original screenshot exists, performs a separate in-memory Chrome P5 comparison. **Previously the results panel only displayed saved claims and metrics.** The user had no single fail-closed artifact proving that HTML still matched the saved geometry or that pixel metrics still matched the two saved PNGs. That prevented distinguishing usable independent outputs from broken or missing saved evidence.

Two alternatives were considered: add another cosmetic reconstruction primitive (low product-wide benefit), or implement a **coherent, self-checking saved pipeline audit** (selected). This covers the existing observation→HTML→Chrome comparison chain without loosening any source/API permissions.

## Implementation

- `studio/static-pipeline-audit.mjs`: deterministic read-only audit of a completed `static-visual` run, using saved report, passive geometry, exact saved HTML, two saved PNGs and the saved P5 comparison.
- `studio/server.mjs`: `GET /api/runs/:id/static-pipeline-audit` available only for *completed* static-visual runs (404 for other modes, 409 for unfinished). Reading it **does not enqueue a capture, launch Chrome, contact the original website, mutate a run, or expand permissions**.
- Checks: original screenshot present; sanitized geometry usable; regenerated canonical HTML **exact byte match** with stored HTML; re-decode both saved PNGs and independently recompute `rgb_mae`, pixel match, coverage, sample counts and dimensions; compare computed metrics with saved P5 data; recompute static quality gate from those values and recorded geometry quality. It does not trust a stored `visual_comparison_available` or gate status as sufficient evidence.
- Schema `rea-static-pipeline-offline-audit`, statuses `OFFLINE_ARTIFACTS_VERIFIED`, `INCOMPLETE`, `EVIDENCE_CONFLICT`; stage values reveal separate source, geometry, canonical HTML, PNG comparison, visual threshold, and **explicitly unverified functional parity**. An internally consistent visual comparison that fails its quality threshold is still an *audited artifact*, not a successful visual reconstruction.
- The Studio P4 panel shows a text-only audit summary and a bounded JSON download. No raw HTML, source URL, host, screenshot bytes, sensitive page text or credentials appear in the JSON. All responses say `product_ready=false`, `functional_equivalence_verified=false`, `backend_equivalence_verified=false`, `DO_NOT_CERTIFY_PRODUCT`.
- Uses the existing PNG integrity and sample limits. Rechecks pixels from local files **only**; its quality gate's geometric evidence comes from the existing stored comparison and is not an independent fresh second Chrome capture. It is an evidence-consistency check, not proof of image/source authenticity.

## Verification plan

- `tests/static-pipeline-audit.test.mjs`: valid saved HTML and pixels, honest blocked visual threshold, missing evidence, changed HTML, forged metrics, forged quality gate, corrupt replay PNG, unsupported run modes and secret non-disclosure.
- `tests/static-pipeline-audit-route.test.mjs`: isolated local server with manually deposited synthetic saved run (no POST capture), repeated GET responses, content attachment, missing or mismatched mode/unfinished status, UI controls, stable run metadata and executor call count **zero**.
- All existing Node and Windows/Linux synthetic Chrome regressions remain mandatory. This test does **not** contact any real website, grant a new external origin, or ask the owner to open Windows PowerShell.

## Boundaries and next priority

This advances product **verification usability**, not source inspection coverage or full application reconstruction. It does **not** fix an unauthorized off-origin `fetch`, recreate backend data, produce original React/Canvas/SVG functionality, or give a defensible general percentage-complete measurement. Actual three-site acceptance (see `docs/QUALITY_FIRST_ROADMAP.md`) remains unavailable until authorized target scopes are verified.

CI outcome and specific commit should be appended only after actual GitHub Actions jobs are all terminal success. Historical local owner acceptance and new runner acceptance are separate.
