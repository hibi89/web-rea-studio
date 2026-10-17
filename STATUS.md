# Status — historical timeline (see HANDOFF.md for the current state)

**Latest summary (2026-10-17):** The authoritative onboarding and current feature/verification boundaries are in [HANDOFF.md](HANDOFF.md). Latest functional code SHA `4a2031bd...` passed Node and isolated Chrome CI on 2026-10-17 (https://github.com/hibi89/web-rea-studio/actions/runs/38994112399). Windows P1 fixture and P2 static HTTPS were observed working. Real-site P2 passive rendering remained failed (`PASSIVE_EXTERNAL_FETCH_REJECTED` / `Failed to fetch`); F1–F4 behavior proofs apply only to synthetic fixtures. The entries below preserve chronological history rather than claiming every old pending status remains current.

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
- Feature code baseline `9d4bcf36c1241080e8ef09074ce6f9de1e8a9875`; CI https://github.com/hibi89/web-rea-studio/actions/runs/38994454894. See `docs/P2_SUPPORT_PACKET.md`.

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
