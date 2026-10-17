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
