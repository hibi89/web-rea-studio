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
