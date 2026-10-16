# Web REA Studio — P0 verification kit

2026-10-16 | Status: **PARTIAL / REA browser execution returned Evidence; actions not yet validated**

This is a **controlled proof-of-concept kit**, not a finished app cloner and not REA's source code. It includes a local synthetic dashboard, reproducible API tests, and a pinned REA scenario runner to validate the proposed REA adapter. The project does not read other websites, accept credentials, or modify existing user repositories.

## Verified in the current sandbox

- GitHub source reviewed: `morluto/rea`, release **`rea-agents-6.5.0`**, package `rea-agents@6.5.0`, license MIT. The remote `main` HEAD on 2026-10-16 was `1b97b0f3707b1cf78ac98bd4ae81638b33cc286f` (not the pinned release source).
- REA browser docs confirm two separate boundaries: passive CDP observation and owned Playwright scenario capture. Scenario capture does **not** enforce an independent destination network allowlist.
- The local fixture API passed **7/7 Node built-in tests**.
- REA was **not installed or executed** here: sandbox Node.js **v22.16.0** does not meet its Node >=22.19 requirement; the installed Chromium refuses navigation (`net::ERR_BLOCKED_BY_ADMINISTRATOR`), including to loopback.
- Windows user machine: Node.js **v24.21.0**, Chrome executable found; original `npm test` passed **7/7**. First REA invocation halted when Windows PowerShell treated an npm `prebuild-install` deprecation warning as a `NativeCommandError`. This does not prove a failure in REA itself.
- Fixed runner now delegates the pinned `npx.cmd` call to `cmd.exe` through `Start-Process`, isolates stderr in a log, and checks the child exit code. **This fix has not been executed on Windows yet.**
- Windows + REA real browser result: **NOT VERIFIED**.

## Windows P0 steps (PowerShell)

For first-time setup, clone the new private repository into a **new directory** (do not overwrite the earlier ZIP extraction):

```powershell
git clone https://github.com/hibi89/web-rea-studio.git
cd web-rea-studio
```

For subsequent changes, run `git pull --ff-only` in this Git directory. Do not run `git pull` in the earlier ZIP folder: it is not a Git checkout.

1. Use the cloned project directory. Do not place it in another project's Git repository.
2. Verify Node.js: `node --version`; use Node.js 24.11+ or 22.19+ (not 23 or 25). Check `npm --version` and Chrome/Edge installation.
3. From the extracted folder run `npm test` and `node scripts/check-host.mjs`. No package installation is needed for the local tests.
4. Review plan: `powershell -NoProfile -File .\scripts\p0-rea-smoke.ps1`. This makes **no external download or configuration changes**. If your environment blocks PowerShell scripts by policy, do not work around the policy without permission.
5. When you expressly permit npm package download and browser execution, run `powershell -NoProfile -File .\scripts\p0-rea-smoke.ps1 -Execute`, or execute after reviewing the script. It starts a local fixture and calls **exact `rea-agents@6.5.0`**, writes capture data under `results/`, and cleans up its fixture process. Set `-BrowserPath 'C:\...\chrome.exe'` if auto-discovery fails.
6. Never send `results/rea-capture.json` from a real site without reviewing it. The P0 fixture is synthetic; future analysis must redact tokens, cookies, URLs, and private content.

Alternative for manual smoke: open two terminals, run `npm run fixture` in one, and `node scripts/generate-scenario.mjs` with the `REA_BROWSER_EXECUTABLE` environment set in the second. Then `npx -y rea-agents@6.5.0 capture-browser-scenario results/browser-scenario.json --json`.

## P0 pass criteria

- Node version compatible on owner Windows: **pass (24.21.0)**
- Fixture API tests: **pass (7/7)**
- Local browser can navigate the fixture: **pending actual REA run**
- REA exact version launches with `capture-browser-scenario`: **pending**
- Click action and DOM/accessibility capture exist in saved evidence: **pending**
- REA process terminates cleanly and does not alter existing client config: **pending**
- Saved Evidence is retrievable and secrets are absent: **pending**

Do not advance to P1 based on the 7 Node tests alone. Continue after actual Windows/REA smoke output has been reviewed.

## Official source references

- https://github.com/morluto/rea
- https://github.com/morluto/rea/releases/tag/rea-agents-6.5.0
- https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/browser-observation.md
- https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/browser-scenario-contract.md
- https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/installation.md
- https://github.com/morluto/rea/blob/rea-agents-6.5.0/THIRD_PARTY_NOTICES.md

## P0 enhanced evidence verification

The Windows REA 6.5.0 command completed and saved a JSON Evidence envelope on the owner machine, but the original validator checked JSON syntax only. This new revision records DOM, accessibility, and URL after every scenario action and checks action status, digest integrity, visible changes, API request/response, origin and cleanup.

From the GitHub checkout:

```powershell
git pull --ff-only
npm test
powershell -NoProfile -File .\scripts\p0-rea-smoke.ps1 -Execute
```

Only a report with `"verdict": "PASS"` passes our controlled-fixture criteria. Do not share raw Evidence from unrelated websites. This does not demonstrate full website reconstruction, source recovery, or generalized security isolation.
