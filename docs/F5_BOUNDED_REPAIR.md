# F5 bounded repair loop — measured synthetic Chrome vertical slice

## Decision
Rejected: unconditional AI rewrites of arbitrary web code with a visual score alone. That approach can destroy functionality, overfit one screenshot, exfiltrate page data, or accept an unmeasured change.
Implemented: a bounded, evidence-constrained first repair loop on **static P4 layout colors only**. Source reference geometry is already sanitized. The standalone HTML is generated with no script, iframe, remote resource, API relay, or cross-origin permission.

## Code and state machine
- `studio/p5-bounded-repair.mjs`: `proposeSafeP4ColorRepair` compares saved P4 geometry of reference and draft. The shapes, order, dimensions and bounds must match exactly; otherwise it fails closed. One proposed change at a time: page background first, then first mismatched painted rectangle color.
- `runBoundedP4ColorRepair` requires a reference Chrome PNG and an injected independent `renderCandidate(html, {attempt})`. It renders a baseline and up to **two** proposed versions. No recursion, no broad CSS/text edits or external API modifications.
- Each new screenshot is evaluated using **P5 v2 full-canvas RGB MAE, sampled pixel agreement, size and coverage**, plus independently observed geometry. Accept only strictly improved MAE (default >=0.1), non-decreasing pixel match and geometry region match, equal canvas and 100% coverage. Missing replay or lower quality stops immediately.
- On a rejected candidate it preserves the last independently verified HTML, not the bad patch. `candidate_html` is independent scriptless source suitable for local review, **not** a production-ready application.
- Every result explicitly says `product_ready:false`, `functional_equivalence_verified:false`, `backend_equivalence_verified:false`, and `independent_chrome_verified_by_module:false`. The engine cannot claim its caller really ran Chrome; the actual CI test establishes that for one controlled fixture.

## Acceptance
- Unit tests use deterministic mocked PNG evaluation for two-step improvements, no-op, invalid geometry, bounds, missing replay and rollback.
- `tests/p5-repair-chrome-e2e.mjs` uses fresh Chrome headless profiles via the existing passive adapter, original fixture plus independent generated HTML replays, and no external requests. Mutates body+aside colors and asserts two successive measured improvements; final static-only quality gate must pass.
- `.github/workflows/local-studio-ci.yml` now requires this experiment in addition to Node/P4/F2/P2-CORS/F4. Synthetic acceptance alone does not prove general autonomous repair, arbitrary CSS layout changes, API/JS/interaction equivalence, or Windows real-site performance.

## Deferred work
- Extend from safe color patches to bounded geometry correction only after controls for ambiguous matching, viewport-dependent constraints and regressions across multiple states.
- Later evaluate one candidate at multiple viewport sizes and behavioral state sequences, keeping no-regression gates.
- True real-site F1→F5 closure still depends on Q1 owner's Windows saved failure record and exact authorization of needed external API hosts. The production passive gateway and target allowlist remain unchanged.
