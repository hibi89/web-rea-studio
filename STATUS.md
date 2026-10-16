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
