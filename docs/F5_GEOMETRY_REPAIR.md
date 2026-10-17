# F5 grounded rectangle geometry repair — 2026-10-17

## Boundary

This is the **next narrowly measured F5 vertical slice**, not a general responsive website solver. `studio/p5-geometry-repair.mjs` handles **one matched P4 painted rectangle** with a mistaken `x`, `y`, `w` or `h` in an independently constructed static HTML. It requires an existing independently observed and sanitized reference geometry, its original PNG and a bounded independent renderer. It never guesses original source code, interacts with a live site or creates a network allowlist.

Existing `studio/p5-bounded-repair.mjs` color repair intentionally rejected coordinate differences; **that policy stays unchanged**. Geometry correction lives in a separate module.

## Candidate selection and safety

- Reference and draft must match viewport/document bounds, region count and order, region tag/depth, painted colors, borders, radii, and captured title evidence. Any change to DOM structure or colors fails closed.
- Exactly **one** painted region may have incorrect geometry. The region cannot be `body`, must be at least 110×88 px, fully within the original canvas, and each changed coordinate must be within 64 px of the observed reference. No arbitrary larger displacements.
- At most two differing coordinate fields are accepted in this first slice. Each proposal fixes only **one** of `x`, `y`, `w` or `h`, in stable order. Coordinates come from observed P4 evidence, not from a generative model.
- The old and proposed rectangles must not intersect an observed title or other independently painted peer/child region. Ambiguous paint overlays and changed HTML content cannot be repaired by this method.
- Candidate HTML comes from the existing P4 scriptless generator, which has an embedded no-script/no-network CSP. All original evidence stays unchanged.

## Acceptance and rollback

`runBoundedP4GeometryRepair` measures baseline generated HTML through an injected renderer. Each proposal must show:

1. Full-canvas equal dimensions, complete comparison coverage, and a valid independently measured P4 region comparison.
2. At least 0.3 points reduction in full-canvas RGB MAE, no reduction in sampled pixel agreement or matched geometry coverage, and no regression from a passing static visual gate.
3. When matched-region coverage remains **unchanged**, average error of matched geometry cannot increase. If coverage **improves**, a new matched region may legitimately increase the mean compared with the old set of matched shapes; in that case the more informative coverage improvement is used. This distinction was discovered through a failing regression test and explicitly corrected.
4. If separately captured reference views are supplied, independently replay the **same candidate HTML** at each additional viewport and reject any measured regression. No independent reference means no claim of multi-viewport proof.
5. Two proposals maximum; on failure or no improvement, stop immediately and retain **last accepted HTML**, never the unverified new candidate.

Status strings: `BOUNDED_STATIC_GEOMETRY_IMPROVEMENT`, `NO_SAFE_GEOMETRY_PATCH`, `STOPPED_NO_IMPROVEMENT`, `STOPPED_VIEWPORT_REGRESSION`, and stop codes for baseline/replay evidence loss.

## Tests and evidence

- `tests/p5-geometry-repair.test.mjs`: field-by-field correction, bounds/ambiguous regions/text/overlap rejection, measured improvement, unchanged result preservation and bad/missing secondary viewport.
- `tests/p5-geometry-repair-chrome-e2e.mjs`: **real isolated Chrome** synthetic site with a deliberately displaced and too-wide aside. Reference is captured through the existing scriptless in-memory relay, and each generated version is recaptured in a new isolated browser. Expected patches: `x` then `w`; required measurable full-screenshot improvement both times. No real external target or API access.
- Required GitHub Actions `Run Chrome F5 measured position and size repair acceptance` alongside F5 color, multi-viewport guard and F2/F4 checks.
- **The feature is a separate testable engine, not yet exposed as a new Studio repair button.** The saved Studio original geometry currently is identical to its own source reference; inventing a wrong position to repair would be misleading. Integrate only after a demonstrably independent defective reconstructed geometry exists.

## Remaining gaps

Real-world F1–F5 site flow; owner Windows proof; original site's `Failed to fetch` API authorization; real second-viewport evidence; complicated nested/grid/flex layouts and text/image/gradient/JS; automated region correspondence under substantial layout changes. No product-ready claim is justified by this synthetic proof.

## Verified CI and lessons — 2026-10-17

- GitHub functional code SHA `f9d6754d57b313d06fc724affdd74945f839561f`: Node **195/195**, isolated real Chrome P4/F5 color & screenshot/F5 multi-viewport/F5 geometry/F2/P2 CORS/F4 all **SUCCESS**. https://github.com/hibi89/web-rea-studio/actions/runs/39000084339
- Real isolated Chrome synthetic rectangle experiment: deliberately shifted `aside.x +28px` and `aside.w +54px` relative to the observed source; independently recaptured baseline plus **two** proposed corrections. Accepted `x`, then `w`. Full-canvas sampled RGB MAE **2.08 → 1.28**, accepted=2, scriptless isolated generated replays=3, external network requests=0, `product_ready:false`.
- Failure diagnosis 1: Node test initially rejected a newly matched rectangle because its addition could raise an *average over only matched regions* even while region match coverage increased. Gate now requires non-increasing matched error only when matching coverage does not improve. Full-screen MAE and all other safety checks remain mandatory.
- Failure diagnosis 2: In the first Chrome defect, the second `w` change improved measured MAE by only **0.17**, below our explicit **0.3** minimum, so the engine correctly rejected it. The controlled test was updated to use a **54px** error (within the unchanged 64px safe-delta cap), not an easier threshold. Both fixes then passed on a fresh Chrome run.
- This proves a bounded **static geometry vertical slice**, not general original-site layout inference or live website cloning. Keep the exact limitations above in all future summaries.
