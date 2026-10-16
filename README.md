# Web REA Studio

Private local-first website analysis project. Current development status: **P1 controlled-browser workflow demonstrated on the owner's Windows PC; P2-1 authorized passive HTTPS HTML analysis implemented, external-site real-host verification pending.**

## What it does today

| Mode | Site | Engine | Output |
|---|---|---|---|
| Controlled browser | `http://127.0.0.1:4317/` | pinned `rea-agents@6.5.0` / Chrome | Seven scripted actions, DOM/accessibility, network events, verified report, final screenshot |
| Authorized HTTPS static | Exact URLs in `WEB_REA_ALLOWED_URLS` | Restricted single HTTPS GET, **not REA** | HTML page title, headings, controls/forms, same-origin path summary, digest and limited report |

**Limitations:** The tool does **not** reconstruct private server source, analyze unauthorised domains, bypass authentication or make unrestricted external browser requests. Static external analysis does not execute JavaScript or take screenshots.

## Windows quick start

In the checked-out `hibi89/web-rea-studio` directory:

```powershell
git pull --ff-only
npm test
npm run check:launcher
npm run studio
```

Open `http://127.0.0.1:4320/`. Click **분석 실행** with the default local fixture URL to exercise the P1 browser workflow.

For a domain you own or have permission to analyze, stop Studio and set an exact HTTPS authorization in your PowerShell session **before** starting it:

```powershell
$env:WEB_REA_ALLOWED_URLS='https://your-approved-actual-site.example/'
npm run studio
```

The domain above is a placeholder; use an actual authorized URL. Copy that same exact URL into Studio. This performs a **single static HTML request** only. An unapproved URL is rejected.

Only one run executes at a time. Refresh and viewing history do not re-run the analyzer. On Windows, results stay in `%LOCALAPPDATA%\WebREAStudio\runs`, outside the OneDrive-synced source checkout.

## Tested vs untested

- **Owner Windows real P1 evidence**: `COMPLETED`, strict `PASS`, 7/7 steps, HTTP 200 observed, screenshot saved, inspector populated (2026-10-16; owner provided UI screenshots).
- **P2 static HTML**: offline local tests of scope, DNS filtering, TLS request parameters, redirect refusal, HTML size checks, extraction, and API persistence. **No live external HTTPS test on owner Windows yet.**
- REA 6.5.0 is pinned; direct Node → `npx-cli.js` launcher is used instead of Windows `cmd.exe /c` to avoid quoting failure.

## Documentation

- [P2 authorized static analyzer](docs/P2_STATIC.md)
- [P1 console and persistence](docs/P1_CONSOLE.md)
- [P1 evidence inspector](docs/P1_INSPECTOR.md)
- [P0 REA acceptance](docs/P0_CHECKLIST.md)
- [Architecture and requirements](REQUIREMENTS.md)

No unrelated GitHub repositories or Vercel projects are modified by this Studio.

## P2 first real HTTPS target

The user-selected exact HTTPS URL is listed in `config/approved-targets.json`.
`npm run studio` now loads it and pre-fills it in the analysis console.
This runs **one read-only static HTML GET**, not REA browser capture and not
website cloning. No extra `WEB_REA_ALLOWED_URLS` environment variable is
needed for the checked-in target. The existing REA-controlled fixture remains
available by entering `http://127.0.0.1:4317/` manually.

## P2-2a passive live-page browser preview

The approved HTTPS site can now be analyzed in **Static HTML** (unchanged default)
or an explicitly selected **Passive Browser** mode. The passive mode uses a fresh
Chrome DevTools session with restricted same-origin GET relay requests. It runs
page JavaScript and records a screenshot, basic DOM structure, blocked/fulfilled
resource metadata. No clicks, sign-in, full crawling, browser-source recovery,
or external-domain fetches are enabled. See [P2_DYNAMIC.md](docs/P2_DYNAMIC.md).

This is a first developer preview; real Windows end-to-end success has not been
established. The existing P1 REA fixture and P2 static HTML tests remain intact.


## P2-2 live site failure (2026-10-16)

The owner successfully captured a real PNG and DOM for the approved site, but the
captured page displayed `Failed to fetch` instead of the working dashboard.
Older P2-2a reports incorrectly used `PASS` to mean screenshot stored, even when
the application's report failed. The revised code marks visible fetch failure
or unsettled requests as `FAIL`, saves the diagnostic screenshot, and keeps
browser-only capture status separate from working application rendering.
A broken data request is **not yet repaired**. Inspect the saved network event
summary before allowing additional origins or changing the request policy.

## Local failure diagnostics

The public Vercel deployment is a **mock UI**. Actual browser analysis runs on
the Windows PC at \`http://127.0.0.1:4320/\`. Storage is local, outside OneDrive.

Pull the latest code, run \`npm test\`, then \`npm run studio\`. Select any
previous **FAILED** run from the left sidebar to see **실패 원인 진단**:
a bounded summary of failure codes, network request counts, path-only network
metadata and the recommended next check. **진단 복사** copies the sanitized
summary; it never includes raw stderr, request query strings, cookies or tokens.

This viewer makes no new browser request and never retries an analysis.
If the site displays \`Failed to fetch\`, the screenshot is diagnostic,
**not** proof that the site was successfully reconstructed.
