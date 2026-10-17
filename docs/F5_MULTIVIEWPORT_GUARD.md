# F5 independent multi-viewport no-regression gate — 2026-10-17

## Why this exists
A screenshot-based paint fix may reduce the error at 1440px while damaging another layout at 900px. A fix is **not** accepted just because its primary screenshot looks better.

## Implementation
- The previous `runBoundedP4ColorRepair` API is preserved when `regressionViews` is absent. The optional argument accepts **up to two** secondary *already observed* viewports with explicit name, original PNG, original sanitized P4 geometry and an independent `renderCandidate(html,{attempt,viewport})` callback.
- A primary baseline and each supplied secondary baseline must be rendered and measured independently. Any unavailable secondary evidence blocks repair with `STOPPED_SECONDARY_BASELINE_UNVERIFIED`.
- An edit is considered for acceptance only after improving the primary full-canvas MAE by the existing minimum without reducing primary pixel agreement or region matching. Each secondary is **freshly re-rendered using the identical candidate HTML**.
- Secondary screenshot dimensions/coverage and geometry measurement must be complete. For every secondary, after-change RGB MAE may rise no more than 0.05 due to reporting precision, pixel match may fall no more than 0.01 percentage points, geometric region match cannot decrease, and a previously passing static visual gate cannot become blocked.
- A secondary failure returns `STOPPED_VIEWPORT_REGRESSION`, records bounded before/after evidence in `history[].secondary_views`, and returns the last accepted HTML, not the harmful proposal. If one proposal passes, its secondary after-evidence becomes the next baseline.
- No arbitrary CSS generation, network approval, source URL navigation, or original backend interactions occur in this gate. The caller's renderer remains an independently trusted adapter; an injected callback alone is not proof it uses Chrome.

## Chrome viewport support
- `runDynamicAnalysis` accepts `offlineViewport:{width,height}` **only** for a script-disabled analysis using an explicitly supplied memory relay. Width is an integer between 360 and 1440; height is an integer from 400 to 900. Unexpected props, live gateway relay, active JS execution, oversized/out-of-range viewports are rejected *before browser launch*.
- The ordinary authorized real-site `static-visual` and `dynamic-passive` captures retain their existing default viewport and unchanged origin/relay permission policy.
- The Chrome PNG clip width uses the bounded alternate viewport; the test confirms actual captured PNG dimensions, not just configuration.
- The required `tests/p5-multiviewport-chrome-e2e.mjs` provides an entirely in-memory CSS media-query fixture with white desktop and black narrower aside. It asserts the desktop becomes more accurate with a paint patch **but** the secondary screenshot becomes less accurate, so the engine rejects the patch. No internet traffic is issued.
- Node tests cover harmful candidate rollback, non-regressing second-view acceptance, missing/failed auxiliary replay, invalid evidence, viewport option restrictions.

## Evidence boundary
The current user-facing `reviewSavedP5ColorRepair` still has **only one original captured viewport**. It does **not** fabricate a secondary source or silently navigate the target website to obtain one. Its `color-repair.json` explicitly records `multi_viewport_no_regression_verified:false`. Therefore a saved-run improvement is only a single-viewport result.

To apply this guard to real captured user runs later, add an explicitly authorized, privacy-reviewed second source screenshot at capture time or from separately supplied owner evidence. Match viewport sizes, DOM and capture timing, and independently validate both; avoid introducing hidden navigation or network activity. Do not claim multi-viewport real-site parity from this synthetic regression test.

## Remaining product milestones
- Multiple independent reference viewports under owner's explicit approved capture contract, bounded action/net budgets, same-data source state, and safe persisted schema.
- Multiple interaction states and text/image/gradient handling, element geometry corrections, and actual authorized real-site completion.
- Q1 API/CORS and user Windows acceptance remain separate unresolved requirements.
