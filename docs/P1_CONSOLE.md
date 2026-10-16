# P1-1 — Local analysis console

Status: implemented in GitHub source; Windows real-REA end-to-end verification is pending.

## Architecture choice

Compared (A) adding a UI and state to the existing one-shot PowerShell script vs (B) a separate local Node studio server and persistent run store. Choose **B**: the original P0 scripts remain unchanged, API GET is never coupled to analysis, and a swappable runner permits deterministic unit tests. The CLI uses `rea-agents@6.5.0` rather than an auto-updating package.

P1-1 is a **controlled-fixture** console, not an unrestricted browser reconnaissance agent. A user must explicitly submit one analysis; an unknown external URL is rejected. Changing the input to an arbitrary website does **not** authorize that site.

## Launch on the owner's Windows PC

```powershell
git pull --ff-only
npm test
npm run studio
```

Open `http://127.0.0.1:4320/` in Chrome. The app automatically starts a synthetic fixture at `http://127.0.0.1:4317/`. Click **분석 실행** once to launch the pinned REA scenario. Initial `npx` execution may download REA and dependencies. No paid LLM API or Vercel deployment is involved.

If browser discovery fails, set a terminal-local environment variable before starting:

```powershell
$env:REA_BROWSER_EXECUTABLE='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run studio
```

Stop the local server using `Ctrl+C` in its terminal. The analysis child is time-limited, but Windows child-process cleanup on timeout needs a real-host regression test. Do not enable unattended arbitrary-site execution at this stage.

## Workflow

- `POST /api/runs` with an exact `target_url` starts one job. The accepted URL is **only** `http://127.0.0.1:4317/` by default. Requests require a same-origin browser Origin header.
- `GET /api/runs` lists latest 50 saved summaries. `GET /api/runs/:id` checks progress; `GET /api/runs/:id/report` and `/screenshot` return the validated report or PNG.
- `GET` routes only read stored results. Page refresh and polling **never call REA again**.
- A concurrent `POST` receives HTTP 409. Each run writes `scenario.json`, `rea-capture.json`, `rea-stderr.log`, `report.json` and an optional `screenshot.png` to `results/studio/runs/<uuid>/`.
- Metadata is written atomically with UUID directory isolation. A job interrupted by restart is marked `interrupted` on startup; **automatic retries are disabled**.
- Raw Evidence is intentionally not exposed through HTTP. The `.gitignore` excludes all results. Only synthetic test content should be analyzed until redaction and traffic isolation policies are expanded.

## Verification

- Unit/integration: `npm test` uses Node's built-in runner and a deterministic mocked REA executor. These tests do **not** prove the real REA CLI works within the Studio process on Windows.
- Manual acceptance on Windows: start the app, submit once, observe status transition `queued → running → completed`, `PASS`, `7/7` steps, at least one API response, final screenshot, and persisted history after refresh/restart. Check local logs on failure.
- P0 separately: owner reported `verdict: PASS` with evidence ID `ev_80f9d598055f2f3ead83d485d9cb4ad672432343cd6b642c0559561d84a34bd9`; the complete raw Evidence was not separately inspected in this chat. Treat provenance review as outstanding.

## Remaining work (P1-2)

Design authorization record, navigation/request allowlist, redirect handling, browser network sandbox, secret scrubbing, bounded crawler actions, source attribution, evidence indexing and comparisons **before** enabling externally supplied URLs. The current REA browser scenario contract does not enforce a network allowlist on all ordinary page requests.

## Localhost link tracking compatibility

Opening the Studio UI via ChatGPT may append `?utm_source=chatgpt.com`. `GET /` strips only bounded `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and `utm_content` query fields by an HTTP redirect to `/`. Unknown query fields and any query on API or asset routes are still rejected; this is not an external-site allowlist expansion.

## P1 storage fix for Windows OneDrive (2026-10-16)

A real Windows run repeatedly reported `EPERM` when replacing an existing `metadata.json` under the OneDrive-synced project folder. This is a local metadata write error, not evidence that REA itself failed.

- The default **Windows** run directory is now `%LOCALAPPDATA%\WebREAStudio\runs` (outside the OneDrive project). On other platforms it remains `results/studio/runs`. The optional `WEB_REA_DATA_DIR` environment variable overrides this when needed.
- On Studio startup, existing UUID run folders under `results/studio/runs` are copied to the new local directory **without altering or deleting originals**. Previously imported UUIDs are skipped; temporary `.tmp` files are excluded. If an old history file is inaccessible, the Studio starts with local storage and warns; the originals stay untouched.
- Run metadata updates are now immutable revisions (`metadata.v000001.json`, `metadata.v000002.json`, etc.). Initial/legacy `metadata.json` is never replaced. Reads select the highest committed revision, and updates for one run are serialized. A bounded retry (two retries) handles transient rename denial. No old snapshot is removed to work around EPERM.
- `npm run diagnose` reads the new local store, including revisioned metadata. The Studio prints the actual local storage directory in the terminal. For accurate diagnosis of legacy runs, start Studio once so it can perform the copy, then stop it before running `npm run diagnose`.
- This change has Linux Node unit/integration tests, including simulated Windows EPERM. A **real Windows/OneDrive acceptance test is still required**. Do not declare Studio end-to-end success before observing a new `completed / PASS` run and a screenshot.
