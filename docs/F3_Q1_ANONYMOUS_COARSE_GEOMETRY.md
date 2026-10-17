# F3/Q1 — Anonymous Coarse-Geometry UI Preview

Date: 2026-10-17 KST. Functional code SHA `c9b805dbed0590fbc70334dcd91771f6eb6623f7`, [GitHub Actions 39033259589](https://github.com/hibi89/web-rea-studio/actions/runs/39033259589): **first attempt 3/3 required jobs SUCCESS**, Linux Node22 **269/269**, Windows Node22 **269/269**, Windows Node24 required job **SUCCESS**.

## Goal and provenance

Improve the existing anonymous, noninteractive F3/Q1 control-category placeholder without inventing source layout. The app's saved passive `interaction_inventory` contains sanitized control rectangles; `frontend_blueprint` contains the actual measured viewport size; `screen_capture` and the saved report separately record screenshot size. A plain control count cannot justify layout. The new artifact is generated **only** if all of those align with the previously blocked-safe F3/Q1 plan. It does not reconstruct original DOM, CSS, navigation, API, backend or database.

Alternative rejected: faithfully copy raw position pixels or source labels, or fill missing geometry from guessed coordinates. Chosen: **3×3 coarse viewport bins** based on each control's rectangle center, plus coarse width bands (narrow/medium/wide) and fixed anonymous text. Two-viewport CSS responsiveness is a new **synthetic generated layout**, not observed mobile-source behavior.

## New implementation and endpoints

- New pure module `studio/f3-q1-geometry-preview.mjs` calls existing `buildPassiveWireframe` (which enforces F3/Q1 work-plan and evidence consistency) then additionally validates `inspection.page.frontend_blueprint.source === 'computed-dom'`, `viewport.w/h`, `inspection.screen_capture`, `report.screenshot_width/height` and the passive inventory `verification:'presence-only'`, `actions_executed:0`, `counts.total`, all categories and rectangles.
- Every rectangle must have safe finite integer x/y/width/height entirely inside the **observed** desktop viewport. Up to 48 elements. Coordinates are not output: the rendered HTML includes only fixed 9 zone identifiers, allowed categories and coarse width variants. Zone center normalizes each control to the observed viewport. Missing, clipped, negative, mismatched or incomplete saved geometry => `BLOCKED`, no HTML.
- Generated HTML consists of scriptless styled noninteractive placeholders (no `button`, form, `input`, link or iframe) with a three-column desktop grid and single-column synthetic mobile stack. HTML meta CSP and response CSP deny scripts, cross-origin networking, forms and navigation; HTTP response adds sandbox and nosniff.
- Added read-only GET `/api/runs/:id/f3-q1-geometry-preview`, `...-download`, `...-receipt`. Requires failed/interrupted `dynamic-passive` saved run, 404 unsupported/missing inspection and 409 wrong state/unsupported stored inspection/evidence conflict. Receipt includes SHA-256, byte count, 9 zone counts, `NOT_APPROVED`, and explicit *original mobile behavior unverified* flag. Studio diagnosis exposes preview, HTML attachment and receipt links only when the derived receipt is available. Existing simpler anonymous category-only preview remains independent.
- No Chrome/browser, user PC access, network recapture, source requests, writes to old run files, policy changes or automatic permissions on GET.

## Tests and limits

New `tests/f3-q1-geometry-preview.test.mjs` (3 unit/local HTTP tests): genuine stored evidence shape + hash/category/zone safety, anti-leak; missing viewport, viewport/screenshot mismatch, count/provenance conflict, negative/clipped rectangle, untrusted category, network count conflict, unknown mode => blocked; HTTP inline/download/receipt match; repeated GET never launches executor; 404/409 safeguards.

New Linux **required real Chrome** `tests/f3-q1-geometry-preview-chrome-e2e.mjs` runs scriptless in-memory HTML under two explicitly isolated synthetic viewports: **1440×900 screenshot 1440×900**, **390×844 screenshot 390×1087** (full-page image exceeds viewport). Both Chrome renders PASS, zero browser interactive controls, zero original website requests, zero script execution, two in-memory synthetic document responses. Receipt sample SHA-256 `f8713a5fc10f73886e5460795645ba55536d71836dc99b3a31e1bf9c7edecfab`. This hash describes a *synthetic generated sample*, not the owner's real source site.

Existing GitHub Linux/Windows Chrome and Node suites continue passing: Linux/Windows22 **269/269**, Windows24 mandatory smoke success, first attempt CI 3/3 success. There is no user physical Windows acceptance of this particular feature, real target mobile-width observation, working target API or original functional visual parity. A screenshot width alone does not yet prove CSS grid column count or absence of horizontal document overflow; verify independent computed CSS/layout in a subsequent bounded step.
