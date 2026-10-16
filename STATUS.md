# Status — P1-1 CODE READY / REAL WINDOWS VERIFICATION PENDING — 2026-10-16

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
