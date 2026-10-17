# Status — historical timeline (see HANDOFF.md for the current state)

**Latest summary (2026-10-17):** The authoritative onboarding and current feature/verification boundaries are in [HANDOFF.md](HANDOFF.md). Latest functional code SHA `af3877d8...` passed Node (199/199) and isolated real Chrome P4/F5 color, viewport rollback, **source-`aside` to independent draft-`div` correspondence + x/width repair**, F2/P2-CORS/F4 on 2026-10-17 (https://github.com/hibi89/web-rea-studio/actions/runs/39001079575). Windows P1 fixture and P2 static HTTPS were observed working. Real-site P2 passive rendering remained failed (`PASSIVE_EXTERNAL_FETCH_REJECTED` / `Failed to fetch`); F1–F4 behavior proofs apply only to synthetic fixtures. The entries below preserve chronological history rather than claiming every old pending status remains current.

## 2026-10-17 F5 independent source/draft geometry correspondence (offline)
- Added `studio/p5-observed-alignment.mjs`: matches large, uniquely corresponding sanitized painted source/draft regions **without relying on identical tag names, array indices, or HTML selectors**. A generated draft `div` may correspond to a source `aside` if paint, region uniqueness and geometry distance are independently observed.
- Hard stop for duplicate lookalikes, changed paint/viewport, unmatched extra large cards, more than one independently measured defective region, no defect, or displacement exceeding the existing 64px-per-field budget. Does not invent a shifted box to justify a repair.
- Before any edit, uses a fresh scriptless Chrome replay of the canonical starting P4 HTML and independently compares against the *actually observed* draft PNG (full coverage, dimensions equal, RGB MAE <=2, sampled pixel match >=95). If source and derived draft are not equivalent, returns `STOPPED_ALIGNMENT_UNVERIFIED`.
- Only after that preflight passes, invokes the existing separately tested `runBoundedP4GeometryRepair`, preserving primary visual improvement thresholds, bounded edits, rollback and optional independently supplied secondary viewport checks.
- Tests `tests/p5-observed-alignment.test.mjs` (four fail-closed regression cases) and `tests/p5-observed-alignment-chrome-e2e.mjs` (separate in-memory original Chrome, independently captured flawed generated draft, clean preflight, measured repairs) are mandatory CI. **Verified functional SHA `af3877d843d6c1d95e66df594c0206c120eaece2`**: Node **199/199**, complete Chrome P4/F5/F2/P2-CORS/F4 **SUCCESS** https://github.com/hibi89/web-rea-studio/actions/runs/39001079575.
- Actual Chrome evidence: 2 unique painted regions aligned; independent `aside`→`div` proof; accepted **x and w** corrections, full-canvas RGB MAE **2.08→1.28**, four generated replay captures, six synthetic in-memory HTML responses, external requests **0**, `product_ready:false`.
- **Still not delivered:** user-facing Studio source/draft matching action or editable independent draft, arbitrary responsive DOM layouts, autonomous unknown region identity, real external-site success, Q1 Windows API authorization/restore. See `docs/F5_OBSERVED_ALIGNMENT.md`.

## 2026-10-17 F5 bounded single-region geometry repair
- New `studio/p5-geometry-repair.mjs`: independently observed P4 rectangle `x`, `y`, `w`, or `h` correction, **one property per Chrome-measured step**, maximum 64px delta, at most two defects and two proposals. Exact region count/order/tag/depth/paint/border, full viewport and captured title evidence required. Text intersections, ambiguous siblings/children and out-of-bounds changes reject.
- Corrected quality-gate interpretation after Node evidence: `compareP4Geometry` averages only the **already matched** regions, so a newly matched card can increase average geometry error despite improved coverage. Average error is non-regression-gated only when matched coverage stays unchanged. Full-screen RGB MAE must still decrease by the configured minimum, pixel agreement and matched coverage may not fall, and previously passing static visual gates cannot regress.
- Supports **up to two separately observed secondary views**, with fresh independent image replays; any failure or secondary deterioration returns the last accepted HTML, not the harmful patch. Existing F5 **color** policy stays unchanged.
- Unit tests cover x/w correction, bounds, titles/overlap, ambiguous matching, replay rollback and secondary viewport failure. `tests/p5-geometry-repair-chrome-e2e.mjs` is a required Chrome CI test using synthetic memory-only HTML, corrupting an aside's x+28 and width+54 within the 64px safety budget.
- Testing baseline SHA `f9d6754d57b313d06fc724affdd74945f839561f`. Latest CI https://github.com/hibi89/web-rea-studio/actions/runs/39000084339 **SUCCESS**: Node **195/195**, full isolated Chrome P4/F5 geometry/color/multiviewport/F2/P2-CORS/F4. Measured controlled geometry repair `aside.x+28`, `aside.w+54` → one field per iteration, accepted **x and w**, RGB MAE **2.08 → 1.28** over three fresh generated HTML replays; external network requests 0. Earlier trial correctly rejected a weaker width correction (MAE delta 0.17 below strict 0.3 minimum), so the test defect size was increased without weakening the threshold.
- No actual third-party site verification, Windows acceptance, saved Studio geometry-repair button, general CSS layout inference, JS/API behavior or released product. See `docs/F5_GEOMETRY_REPAIR.md`.

## 2026-10-17 F5 independent multi-viewport no-regression gate
- `runBoundedP4ColorRepair` now accepts at most two **separately supplied, actually measured** secondary viewport references and replay callbacks. Each patch first must improve the primary full-canvas screenshot, then be independently replayed at each secondary width. If any second view loses sampled pixel match or geometric agreement, increases MAE beyond a 0.05 rounding allowance, or loses an already passing quality gate, return `STOPPED_VIEWPORT_REGRESSION` and preserve prior HTML. Missing auxiliary baseline returns `STOPPED_SECONDARY_BASELINE_UNVERIFIED`.
- `runDynamicAnalysis` can use a bounded `offlineViewport` override only with `scriptsDisabled:true` and an explicitly supplied offline relay. Valid widths 360–1440px, heights 400–900px; no custom option is allowed for the default external gateway. Existing production/Windows viewport behavior unchanged.
- Required isolated Chrome responsive CSS fixture: desktop 1440px original RGB MAE **22.75→1.31**, but 900px secondary **2.06→36.21**. Therefore **0 patches accepted**, rollback of harmful proposal; total 6 synthetic in-memory HTML fulfilments, 0 real internet requests. Unit tests prove pass/no-regression, fail/regression, absent evidence and bad viewport options.
- The **user-facing Studio currently stores only one original viewport**, so `color-repair.json` now explicitly says `secondary_viewports_verified:0` and `multi_viewport_no_regression_verified:false` rather than fabricating coverage. Real-site second-view captures are still a future opt-in, privacy-reviewed task.
- Functional code SHA `3cc29ca72f5280e5a2cd7dc3081ad8847e5edbba` GitHub CI **SUCCESS**: Node **190/190**, full isolated Chrome P4/F5 (including new multi-viewport), F2/P2-CORS/F4 https://github.com/hibi89/web-rea-studio/actions/runs/38999212889. Design and limitations `docs/F5_MULTIVIEWPORT_GUARD.md`.
- Real external-site end-to-end parity, Windows acceptance, API permission Q1, true responsive replica and independent mobile source evidence remain **unverified**.

## 2026-10-17 F5 screenshot-derived uniform-region paint hints
- `studio/p5-pixel-colors.mjs` infers candidate paint color from locally saved reference PNG and a fresh independent replay PNG, only for large mostly-uniform non-body P4 rectangles, skipping captured titles/occluding children and requiring matched dimensions. Never exports original pixel buffers/text.
- First unit run exposed checkerboard aliasing under stride-8 sampling; corrected with full-resolution decoded image and 5 different pixel positions within each bounded tile. Uniformity threshold >=88% on each image, RGB difference >=24, at least 20 masked-safe probes. Gradients/text/ambiguous regions fail closed.
- Engine `runBoundedP4ColorRepair` gains explicit `enableScreenshotColorInference` mode; original geometry-only behavior remains compatible. Existing saved Studio `reviewSavedP5ColorRepair` opts into pixel hints while preserving opt-in POST/GET, isolated fixed synthetic replay URL, saved original files and non-product verdict.
- Chrome synthetic baseline with deliberately stale observed color: RGB MAE **26.59 → 1.32**, one accepted screenshot-derived patch, two fresh independent scriptless Chrome replays, external requests 0. A complete synthetic saved `static-visual` run also produces `color-repair.json` and a standalone scriptless `color-repair.html` with **original source screenshot preserved**.
- CI verified functional SHA `378888dd85b0c618c64fb8d60dd28b60ad8d2d94`: Node **185/185**, Chrome P4/F5 token repair/F5 pixel inference/F5 saved-run replay/F2/P2-CORS/F4 **SUCCESS**: https://github.com/hibi89/web-rea-studio/actions/runs/38998538942.
- **Not yet verified:** any actual third-party dashboard repaired; pixel hints do not generalize to gradients, icons, images or coordinates; Windows local button test and external API Q1 authorization still pending. Refer to `docs/F5_STUDIO_OFFLINE_REVIEW.md`.

## 2026-10-17 F5 opt-in saved static Studio color review
- Added `studio/p5-stored-review.mjs`: from an already completed static-visual run and its saved P4 geometry/PNG/P5 v2 comparison, re-renders only **scriptless generated HTML** through a fixed synthetic Chrome relay address. **Never re-fetches the original URL**. Caller must supply a legitimate Chrome renderer.
- Studio `POST /api/runs/:id/color-repair` requires explicit JSON confirmation and same-origin request; responds 202, uses a single-job busy lock. `GET .../color-repair` reads status/results only; optional `GET .../color-repair-download` serves scriptless HTML with no-connect CSP **only when improvement was measured**. Saved receipt stays separate from original capture/report.
- UI shows an explicit local-only button, running state, `NO_SAFE_COLOR_PATCH` for identical saved geometry, and improvement download only on accepted changes. Default starting geometry equals the original P4 source, so **no repair is expected for typical captured cases**. This is not general screenshot-inferred self-healing.
- Regression: `tests/p5-stored-review.test.mjs` tests origin/confirmation/duplicate/active/source-unmodified/no-original-recapture/report-only GET/conditional safe HTML; `tests/studio.test.mjs` tests presence of controls. Exact latest feature code SHA `2ffc324e2835445f79e719476de799f370635931`; CI https://github.com/hibi89/web-rea-studio/actions/runs/38997567550 **SUCCESS** (Node 182/182 and all isolated Chrome suites). See `docs/F5_STUDIO_OFFLINE_REVIEW.md`.
- No original site API access granted; Windows real-site acceptance still pending. Separate controlled F5 positive Chrome loop (two deliberately corrupted grounded colors) remains verified as before.

## 2026-10-17 F5 first bounded self-repair proof (offline, synthetic)
- `studio/p5-bounded-repair.mjs` proposes **only** observed P4 body/background and region color edits (shape/order/bounds must already match). It requires a fresh re-render callback for baseline and each proposal, accepts measured improvement only, and rolls back a failed or non-improving candidate. No more than two patch attempts per run.
- Unit regressions cover two accepted steps, rejected/no-op candidate, invalid geometry, bounded attempt count and failing renderer. `tests/p5-repair-chrome-e2e.mjs` validates one source capture and fresh standalone Chrome replays on entirely synthetic memory-backed pages. CI workflow makes this a required Chrome step.
- Latest functionally tested SHA `a93947459e631f5a85c29a91ac77f2919668bc72`, Actions `38996839185` **SUCCESS**: Node 179/179 and Chrome P4/F5-repair/F2/P2-CORS/F4. One original capture + three independent replays; two accepted patches improved RGB MAE **197.69 → 1.32**, no external requests, static-only gate passed. Initial CI failures were investigated: missing test capture directory, then ineffective body background update beneath a covering P4 body region; both fixed and independently verified.
- No actual external API or user-site interaction, arbitrary JavaScript/CSS repair, multiple-viewport optimization or Windows acceptance. Repaired HTML is scriptless and `product_ready` is always false. Details in `docs/F5_BOUNDED_REPAIR.md`.

## 2026-10-17 Q1 saved-evidence permission preflight (not a live API connection)
- Added pure `studio/permission-preflight.mjs` from previously redacted passive support evidence, `GET /api/runs/:id/permission-preflight`, and Studio failure-panel JSON download and missing-authority summary.
- Candidate external hostname requires matched saved fetch attempt+rejection. Local/special-use/IP-coded DNS providers (`sslip.io`, `nip.io`, `xip.io`) are flagged for heightened review. No CORS diagnosis, DNS lookup or hostname ownership proof is invented.
- Always `NOT_APPROVED` / `BLOCK_NETWORK_EXPANSION`. All authority/scope/quota/security checklist entries remain null; no executable network policy, new origin, external request, browser action or production deployment.
- Unit/route/UI regression checked; GitHub functional SHA `22045a6b523eaf6b4a35ae047bcab914003de940` has Node **173/173**, isolated Chrome P4/F2/P2-CORS/F4 **SUCCESS**: https://github.com/hibi89/web-rea-studio/actions/runs/38996188937.
- **Q1 itself not complete:** actual Windows saved report and remote API behavior/authorization not yet verified. See `docs/Q1_PERMISSION_PREFLIGHT.md` and `HANDOFF.md`.

## 2026-10-17 Q0 quality-first full-canvas P5 comparison
- Fixed visual false-positive: previously P5 ignored bottom-right notice area and compared only screenshot overlap. Now P5 v2 scores the **entire sampled canvas**, assigns 255 RGB error to missing pixels, records sample coverage, and does not automatically mask any region.
- Added independent static-only quality gate (same screenshot dimensions, 100% coverage, >=90% sampled pixel match, <=20 RGB MAE, >=70% geometry match). Missing geometry/masked comparisons block this gate. The gate always declares functional/backend/autonomous-repair readiness **false**, even with excellent pixels.
- Local Studio P5 comparison now displays pass/fail and warns that historical v1 comparisons did **not** pass the new gate. Older run results remain unchanged.
- Node regressions cover cropped but identical overlaps, zero geometry, large RGB divergence, masked evidence and legacy UI. Real isolated Chrome P4 visual test now checks the quality gate and keeps F2/P2/F4 regression checks.
- Current functional code baseline after UI/test changes: `6ef1af91aa4c78853e64f9b384e2d93da7e89353`, GitHub Actions 38995644114 **SUCCESS** (Node and isolated Chrome P4/F2/P2-CORS/F4). Previous P5 core baseline `846568bf` passed Node 168/168 + isolated Chrome full suite: https://github.com/hibi89/web-rea-studio/actions/runs/38995511999.
- Product acceptance roadmap: `docs/QUALITY_FIRST_ROADMAP.md`. **No real external site is yet fully reconstructed**; Q1 still requires Windows saved-run evidence and host authorization before any expanded API relay.

## 2026-10-17 P2 two-origin synthetic browser lab
- Chrome CDP **in-memory** fixture tested default cross-origin API denial, CSP approval without CORS (still failure), and CSP approval with exact CORS response (synthetic JSON successfully read). Independent DNS/proxy access disabled; real external API calls = 0.
- Exact GET/Fetch/XHR-only synthetic endpoint policy and denial cases covered. GitHub functional SHA d96ea6df; Node and Chrome P4/F2/P2-CORS/F4 CI **SUCCESS**: https://github.com/hibi89/web-rea-studio/actions/runs/38994833194.
- No runtime change to actual passive gateway, CSP, approved targets, credentials, user data or Vercel. This does **not** repair the old Failed to fetch screen; confirm authority before changing real network origins.
- See docs/P2_SYNTHETIC_CORS_LAB.md; next acceptance step is inspecting the saved Windows support packet without recapturing the target.

## 2026-10-17 P2 passive capture verdict hardening
- Added capture FAIL verdict when a client fetch is rejected or core Document/Script/XHR/Fetch resource is blocked, even if literal error text is absent. Report includes `critical_resources_blocked`; cosmetic image/favicon errors alone do not fail application verdict.
- No external host allowlist changes, active clicks, new credentials, extra network requests, or retroactive report changes.
- Automated tests added; compare CI results against this exact commit. User Windows/real-dashboard verification is separately pending.

## 2026-10-17 Read-only passive permission-review follow-up
- Failed saved passive captures now surface a bounded list of unapproved external hostnames **only when fetch-attempt and fetch-rejected both match**. They are not verified required APIs or authorized hosts.
- Separate diagnoses handle core Document/Script/XHR/Fetch blocks and fetch rejections without matched external host; the local diagnosis UI displays these without touching the site.
- No new external requests, allowlist changes, credentials, or previous run data changes. CI/Windows verification remain separate gates.

## 2026-10-17 P2 offline API dependency evidence
- Added read-only saved passive network dependency report grouped by sanitized same-origin paths and external hostnames. No new network traffic or permissions; GET `/api/runs/:id/dependencies` exports bounded JSON.
- Unit, redaction and local HTTP route tests added. New commit CI and Windows real capture must be checked separately; live data-loading problem is unresolved.
- Detail in `docs/P2_DEPENDENCY_REVIEW.md`.

## 2026-10-17 P2 local dependency review UI
- Failed passive-run diagnosis panel now shows bounded, saved-evidence dependency summary and a local JSON download link. It uses only the already-tested read-only local API; no extra target fetch or authorization.
- UI availability and DOM tests added; functional SHA `e1063bb0` passed GitHub Node+Chrome CI (run 38992975379). Actual Windows UI and live backend remain unverified.

## 2026-10-17 F1/F2 external passive evidence blueprint
- Added read-only stored F1 controls + F2 network evidence JSON through GET /api/runs/:id/passive-blueprint, a local Studio link, and regression tests. No external fetch, clicks, permission change or inferred button/API causality.
- Feature code baseline 4a2031bd54a7b833efc9a26555b30df3c61eaa9c; GitHub CI and Windows real-data acceptance are separate checks.
- Actual live dashboard Failed to fetch issue is unresolved. See docs/F1_F2_PASSIVE_BLUEPRINT.md and HANDOFF.md.

## 2026-10-17 P2 offline support packet from saved failed captures
- Added deterministic, privacy-minimized JSON support packet for failed/interrupted saved `dynamic-passive` analyses via `GET /api/runs/:id/support-packet`; UI offers `안전 진단 패킷 JSON` in failed-run diagnostics.
- Packet contains only counts, allowlisted status/reason codes, hostnames and coarse approved-origin path categories; excludes raw input values, page labels, full URLs/queries, screenshot, external paths, response bodies and raw stderr. Warns owner to review hostnames before sharing.
- No new external fetch, browser click, host approval, analyzer relaunch, Windows data overwrite or Vercel change. Unit/HTTP/UI tests added; actual Windows saved-run acceptance and real external backend behavior remain unverified.
- Feature code baseline `9d4bcf36c1241080e8ef09074ce6f9de1e8a9875`; GitHub CI run 38994454894 **SUCCESS** (Node regression, isolated Chrome P4/F2/F4). Windows and live target remain separate unverified gates. See `docs/P2_SUPPORT_PACKET.md`.

## Historical records (2026-10-16)

## P0 (controlled fixture)
- User's Windows PC (Node 24.21, Chrome, REA 6.5.0): last live run reported `PASS`, `completed_steps: 7/7`, `api_responses_200: 1`, `completeness: complete`, `dropped_events: 0`.
- Evidence ID: `ev_80f9d598055f2f3ead83d485d9cb4ad672432343cd6b642c0559561d84a34bd9`.
- The tool-generated summary was reviewed, but the entire underlying Evidence file has not been independently inspected; provenance review outstanding.

## P1-1 (safe local analysis console)
- Studio UI, API, on-demand REA runner, local per-run Evidence metadata/report/screenshot, history replay and one-active-job semantics implemented.
- Targets restricted to `http://127.0.0.1:4317/` (authorized synthetic fixture). No remote-site automation.
- Test suite expanded with URL admission, security headers, duplicate execution prevention, crash recovery, persistence and no-reanalysis-on-GET checks.
- Local HTTP serving and mocked-analysis tests: refer to the current exact `npm test` output and `docs/P1_CONSOLE.md`. Real Windows REA Studio run still pending.
- No cloud production URL, Vercel project, or paid service provisioned.

Next: owner runs `git pull --ff-only`, `npm test`, `npm run studio`, and performs one browser analysis; validate report and screenshot, then plan P1-2.

## P1-2 evidence inspector (2026-10-16)
- Owner successfully opened the Studio UI (localhost:4320) on Windows, but the first job was `FAILED` before a report was saved. Exact failure cause is unknown without the local stderr/diagnosis; this is not an REA success claim.
- Added fixture-only evidence projection (`inspection.json`), safe read-only `GET /api/runs/:id/inspection`, steps/network UI, visible diagnostic banner and `npm run diagnose` for existing failed runs.
- Local mock/unit/security tests passed 36/36 in Linux Node 22 authoring runtime; **real Windows REA Studio invocation remains unverified**.
- P0 independent PowerShell controlled fixture test was user-reported PASS (evidence_id ev_80f9d598055f2f3ead83d485d9cb4ad672432343cd6b642c0559561d84a34bd9).

## 2026-10-16 P1 Windows storage failure and fix
- Owner screenshot: multiple `FAILED` analyses; visible failure was `EPERM` while renaming an existing `metadata.json` inside a OneDrive-synced project directory. The current issue is local run metadata storage; REA itself is not proven to have failed.
- Changed Windows storage root to `%LOCALAPPDATA%\WebREAStudio\runs`. The old OneDrive run folders are copied (not moved or deleted) on startup.
- Added append-only metadata revisions; no existing metadata.json replacement, serialized writes, bounded transient rename retries, legacy/read/restart compatibility and diagnosis support.
- Local Node tests: 42/42 PASS, including simulated Windows EPERM, multiple updates, concurrent updates, migration, and restart.
- **Windows real browser Studio run still unverified after this fix.** P1 is not signed off until the owner reports a fresh `completed / PASS` report and screenshot.

## P1 Windows launcher bug and fix — 2026-10-16
- Owner produced real stderr: `"npx.cmd -y rea-agents@6.5.0 ..." is not recognized` (Windows `cmd.exe` shell quoting broke in Node child_process). Evidence file was empty; the CLI did not run.
- P0 PowerShell smoke worked, but P1 used a different subprocess invocation path.
- P1 runner now launches `npx-cli.js` through `process.execPath`, preserving the pinned `rea-agents@6.5.0` and removing shell parsing.
- Added `npm run check:launcher` to verify actual local child process invocation without fetching REA or opening a browser.
- **Windows P1 real REA capture still unverified.** Run preflight before a single manual Studio analysis.

## P1 Windows end-to-end VERIFIED / P2-1 developed (2026-10-16)
- Owner's live Windows screenshots show Studio `COMPLETED`, strict `PASS`, 7/7 completed actions, API response observed, screenshot_saved=true, and inspection steps/network events. P1 controlled-fixture browser flow is now verified on owner's real Windows machine.
- P2-1 adds an independent one-request, **static-only**, authorized HTTPS page structure analyzer. Exact URLs must be approved at startup via `WEB_REA_ALLOWED_URLS`; default external approval list is empty.
- P2 tests block unapproved URLs, noncanonical HTTPS, unsafe DNS, redirects, oversized/non-HTML content, and assert that GET/reload never triggers further analysis.
- P2 local mock tests are not a Windows live external HTTPS test. P2-1 external real-host acceptance awaits an owned/authorized URL and user-side run.
- External REA/Chrome capture remains disabled pending independent browser egress containment.

## 2026-10-16 P2 user-selected live HTTPS target
- Windows REA P1 browser path: owner confirmed `COMPLETED`, `PASS`, 7/7 actions, 200 response, verified screenshot and steps/network inspector in the conversation. Controlled fixture only.
- First exact P2 static target selected by owner: `https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/`.
- Private repo now contains `config/approved-targets.json`; the local Studio loads it and pre-fills the input. No wildcard or unrestricted browser navigation.
- Static HTTPS extraction tests: in-sandbox 57/57 Node tests PASS after adding four approval/config tests. Browser visit and live remote HTTPS response were not tested in this environment; P2 live acceptance pending.

## P2-2a passive dynamic browser (2026-10-16)
- Owner already demonstrated Windows P1 REA fixture E2E PASS and P2-1 authorized live HTTPS static-html PASS on `https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/`.
- Added independent Node/Chrome CDP passive adapter with a validated same-origin GET resource relay, ephemeral browser profile, restricted CSP and Chrome DNS/proxy flags; no external REA scenario or arbitrary clicks.
- First browser analysis is explicit opt-in, not the default. Static site URL is unchanged and exact-match authorization remains in force.
- Local Node mock/unit tests: 63/63 passed. The authoring environment's Chromium is blocked by policy with `net::ERR_BLOCKED_BY_ADMINISTRATOR`; this is **not** a Chrome E2E success.
- Next: update Windows checkout, run npm test, start Studio and select Passive Browser once, review report, screenshot and blocked request count. Only then consider P2-2a proven.


## P2-2 real Windows result (2026-10-16)
- Owner observed `COMPLETED / PASS` and stored a PNG, but screenshot says `보고서를 불러오지 못했습니다`, `Failed to fetch`.
- Report: two resource requests, only one fulfilled, none blocked, render fidelity unverified.
- This is **failed application rendering**, not successful dashboard reproduction.
- Fail-closed report detection and pending request counters added; diagnostic PNG retained even on FAIL.
- Underlying data request failure still requires per-request event inspection; no additional domains approved.

## Local-first failure inspection milestone (2026-10-16)
- Added a local-only `GET /api/runs/:id/diagnosis` for failed or interrupted historical runs; it derives a privacy-filtered summary from previously saved data with no rerun.
- The actual local Studio UI now shows a failure-only diagnosis panel with a copy button and bounded path-only network metadata.
- Included regression tests for read-only semantics, redaction and completed-run rejection.
- Real Windows Chrome acceptance remains pending. The failed application report is not declared fixed.
