# F5 independently observed region alignment — quality gate (2026-10-17)

## Problem solved

The existing bounded F5 geometry corrector expected source and draft to share **identical ordered P4 box tags**. In genuine independent HTML, a source `aside` usually becomes a generated `div.region`, with extra body/main and notice wrappers. Treating them as corresponding based on list index or assuming a damaged draft without measuring it is unsafe.

## New observed-evidence path

- `studio/p5-observed-alignment.mjs` consumes **two independently captured, sanitized P4 geometry datasets**. It does not navigate any target and cannot produce source code for a hidden application backend.
- Only non-body, fully in-frame, sufficiently large (at least 110 × 88), actually painted regions with a distinct background are candidates. The algorithm ignores original tag name and ordering. Transparent wrappers, body-sized areas, and the generated small status notice are excluded.
- Each reference region must have **exactly one** feasible paint-style-matching draft region within the strict 64px-per-coordinate, 128px total offset budget; draft assignments must be mutually exclusive. Duplicate lookalikes, overlapping ambiguous candidates, missing extra cards, paint differences, different viewport/document dimensions, no defect or multiple defects **fail closed**. No probabilistic guessing.
- The single independently observed changed region is projected into a copy of the original sanitized P4 evidence, preserving reference roles/paint/title contracts required by `runBoundedP4GeometryRepair`. The region's coordinates come **from the independently captured draft**, never from a manufactured defect.
- Before any repair, the engine re-renders that projected scriptless HTML in a fresh independent capture and compares it to the *actual draft screenshot*. Both PNG dimensions must be equal and 100% covered; overlap masking is forbidden; the generated baseline must have RGB MAE no more than 2 and pixel match at least 95%.
- A canonical preflight mismatch or missing browser measurement yields `STOPPED_ALIGNMENT_UNVERIFIED` with zero accepted edits. If validated, the existing at-most-two field-by-field geometry repair runs using the *original* source screenshot, with the same minimum improvement, rollback, content safety and optional secondary-viewport gates.
- This separate path does not loosen color-repair validation, live-site permissions, or default capture. No external API or origin is automatically approved.

## Security and evidence

The result reports sanitized region indices and integer coordinate deltas, never original HTML, selectors, raw CSS URLs, cookies, input values, auth data or screenshot bytes. Original and observed source image evidence must be supplied by the caller. A passed unit test alone does not establish the callback ran Chrome; a required isolated Chrome CI test separately proves this under synthetic in-memory relay.

### Testing

- `tests/p5-observed-alignment.test.mjs`: renamed/reordered source vs draft regions, unique pairing, identical-content no-op, duplicate ambiguous colors, more than one defect, viewport/paint mismatch, baseline screenshot disagreement and missing independent replay.
- `tests/p5-observed-alignment-chrome-e2e.mjs`: synthetic source HTML captured in Chrome, deliberately flawed *generated* P4 HTML independently recaptured in a separate Chrome execution, evidence-based source `aside` → `div` pairing, canonical draft preflight against independently captured PNG, then `x` and `w` repairs measured in new isolated Chrome replays.
- Required new GitHub Actions step `Run Chrome F5 independently observed geometry alignment` alongside Node and original P4/F5/F2/F4 Chrome regressions.

## Limitations and next priority

This is a narrowly controlled **offline/synthetic** independent-draft correspondence proof. Ambiguous repeated cards, gradients, text overlap, structural rearrangement, responsiveness, missing geometry and multi-element corrections remain blocked. It does not infer functional JavaScript/API logic or original backend algorithms. The normal local Studio UI still lacks an independently captured editable alternate geometry; users cannot request an invented mismatch as a repair. Q1 actual Windows dashboard and explicit external API authorization remain unresolved. Advance to an actual user-authorized saved independent draft artifact, then consider opt-in Studio integration only when identity/paint/viewport contracts are verified.

## Exact CI acceptance — 2026-10-17

- Verified functional GitHub SHA: `af3877d843d6c1d95e66df594c0206c120eaece2`.
- CI: [Local Studio Node regression run 39001079575](https://github.com/hibi89/web-rea-studio/actions/runs/39001079575), **SUCCESS**, Node **199/199** plus all isolated Chrome P4/F5 color, F5 cross-viewport, F5 basic geometry, F5 observed-region identity, F2, P2-CORS and F4.
- Independent Chrome results: two unambiguous visible painted rectangles; source `aside` linked to generated independent draft `div`; one defect with observed `x` and `w`; two patch acceptances after an extra canonical-draft preflight. Full-canvas RGB MAE **2.08 → 1.28**; generated replays **4**; local in-memory synthetic HTML responses **6**; internet requests **0**, product readiness **false**.
- This is evidence-driven correspondence in the **controlled synthetic fixture**. It is neither proof of real arbitrary DOM understanding nor original-site functional parity.
