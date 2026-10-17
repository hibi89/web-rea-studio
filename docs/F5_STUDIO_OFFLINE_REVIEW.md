# F5 local Studio: opt-in color review of saved static evidence (2026-10-17)

## User-visible behavior

A previously **completed** `Static Visual` capture with a P4 reconstruction and P5 v2 comparison exposes `오프라인 색상 재검증 실행` in the Studio P5 panel. The button is deliberately manual, not an automatic response to loading the run or the page.

The user action makes one same-origin `POST /api/runs/:id/color-repair` with only `{"confirm":"offline-color-review"}`. A local Chrome replay may be expensive, so the server answers HTTP 202 promptly; the UI polls `GET /api/runs/:id/color-repair`. GET is disk-only status/result reporting and never launches an analyzer.

The local-only replay uses **fixed** `https://p5-offline-replay.example.org/` as a synthetic Chrome interception address. The browser sees only independently generated scriptless HTML supplied **from memory** and rejects unexpected requests. It does not use, resolve, relay, or re-fetch the original approved website URL. It cannot change API host permissions or the user's original analysis artifacts.

## Eligibility and security

- Original run must be `completed`, mode `static-visual`, with saved source PNG, P4 geometry, reconstruction flag, and P5 **v2** full-canvas measurement. Older v1 data and missing captures cannot trigger replay.
- UI action requires explicit confirmation, same-origin POST, fixed JSON request shape, bounded body, and only one concurrent Chrome review/analysis globally. Repeated attempts after a persisted result are rejected.
- Scratch captures live under the local run directory and are cleaned after replay. Original PNG, inspection, report and P4 independent HTML remain untouched.
- A success audit is persisted as `color-repair.json`, with measurements and no raw original data. A modified scriptless `color-repair.html` is written and downloadable **only when at least one proposed edit improved the independent capture**.
- HTML downloads use no-script/no-connect CSP and `Content-Disposition: attachment`. If no grounded patch is available, the result is `NO_SAFE_COLOR_PATCH` with no improved HTML. New screenshot-guided color hints sample only large unobscured near-uniform painted rectangles from **both stored original and independent generated PNGs**. They exclude captured title rectangles and overlapping painted children; multi-phase sampling resists regular patterns. A candidate is never accepted without measurable Chrome improvement.
- A replay failure stops the review. Current non-retry status is in local server memory; after restart, a failed attempt with no receipt may be retried by explicit user action. This is an engineering prototype, not a durable background queue.

## Limitation that matters most

The starting geometry still comes from the same sanitized original P4 reference. The new **optional screenshot-informed color path** now allows one narrowly grounded repair even when saved CSS color tokens already agree: an unobscured painted region must have nearly uniform but clearly different original/replay sampled colors. Many real captures still have **no eligible solid region** or no true color difference. `NO_SAFE_COLOR_PATCH` is a correct fail-closed outcome, not proof that the whole picture is identical. The reference Chrome pixels can still differ because of rendering, fonts, overlay and layout structure. The present system does **not** recolor gradients, images, mixed/text-heavy regions or obscured elements, fix element coordinates, change JavaScript, or guarantee any correction on the user's external websites. Original and generated PNGs are decoded locally; only small aggregated region-color evidence is retained, not screenshots or OCR text in patch receipts.

The separate CI `tests/p5-repair-chrome-e2e.mjs` *does* prove that when an independently corrupted draft differs in two grounded color tokens, `runBoundedP4ColorRepair` applies two edits and reduces Chrome RGB MAE from 197.69 to 1.32. Do not confuse that controlled positive experiment with the UI review's same-reference starting state.

## Verification

- `tests/p5-stored-review.test.mjs`: saved-only replay, source URL non-contact, idempotent receipts, no-patch proof, explicit confirmation, origin/mode/active lock, read-only GET behavior, conditional HTML download and strict response CSP.
- `tests/studio.test.mjs`: UI visibility and explicit POST code path.
- GitHub CI includes Node tests and real isolated Chrome P4, F5 positive repair test, F2, P2-CORS and F4 synthetic tests. Exact code SHA and CI are recorded in `HANDOFF.md`.

## Next quality upgrade

Extend the proven **bounded uniform-region inference** to multi-viewport and multiple UI states, with strict no-regression gates; eventually evaluate geometry correction separately. Mixed gradients, text-heavy areas and unknown backend behavior remain unsupported. This is necessary to move from a no-op review in typical real captures to actionable, evidence-backed repairs. Also obtain owner-reviewed Windows Q1 failure evidence before expanding live external API access.

## 2026-10-17 screenshot-guided extension

- `studio/p5-pixel-colors.mjs` selects **one** large reference/replay region with at least 88% uniform pixels in **both** screenshots, a substantial color difference, title/child exclusion and matching dimensions. It proposes a sanitized RGB CSS color only; no raw pixels, URLs or text are persisted.
- Initial uniformity test exposed sample-grid aliasing (a checkerboard appeared as a single color). Fixed using full-resolution decoding plus five phases per bounded tile, covering odd/even coordinates and a center. Negative tests cover checkerboards, gradients, missing coverage, title masks, bad dimensions and no difference.
- `runBoundedP4ColorRepair(... enableScreenshotColorInference:true)` enables the pixel proposal branch; every proposed change still must improve full-canvas MAE and not regress sampled pixel match or geometry under fresh independent replay. Existing geometry-token repairs remain unchanged when the option is false.
- `reviewSavedP5ColorRepair` now opts in. The save/read-only/permission boundaries remain unchanged. This is static P4 **color-only** repair, not a generalized website auto-repair.
- Controlled Chrome screenshot-inference proof (function SHA `41f04390`): RGB MAE **26.59 → 1.32**, one accepted paint correction, **two** independent scriptless Chrome replays, zero external API calls. Node 185/185 and Chrome full suite passed in https://github.com/hibi89/web-rea-studio/actions/runs/38998461204. A further full saved-run Chrome integration was added and is verified in a subsequent CI.
