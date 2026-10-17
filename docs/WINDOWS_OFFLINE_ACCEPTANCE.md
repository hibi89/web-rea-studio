# Windows offline Studio acceptance (2026-10-17)

## What is checked

GitHub Actions now includes a **separate real `windows-latest` job**, rather than treating Linux Chrome tests or Windows-path unit mocks as proof that the app works on Windows.

Windows CI runs:

1. `npm test`: complete Node 22 regression and local HTTP suite on an actual Windows runner.
2. `npm run check:launcher`: invokes only the installed npm sibling `npx-cli.js --version` directly with Node. It does **not** install or run REA, download anything or visit a target.
3. Finds installed Google Chrome at standard Windows install locations, fails if absent, and verifies the executable responds.
4. `node scripts/windows-studio-startup-smoke.mjs`: starts the **real Studio entrypoint** in a new Windows child process, with a private temporary storage path containing spaces. It confirms the loopback UI/fixture/runs endpoints, empty initial history, **rejection of an actual raw HTTP request with a hostile Host header**, rejection of unexpected query parameters, and no new capture files. The test does not browse or analyze any external website.
5. `node tests/p4-chrome-e2e.mjs`: a separate real Windows Chrome CDP run against synthetic in-memory P4 evidence.
6. `node tests/p5-saved-geometry-chrome-e2e.mjs`: separate real Windows Chrome workflow of **previously stored user-supplied static draft → independent synthetic replay → unique region match → bounded x/width corrections**, source evidence preserved.

All original Linux Node and full Chrome F1–F5 regressions remain mandatory and unchanged.

## How to run the Windows smoke on the owner's machine

Run in a private PowerShell session after cloning or updating this repository:

```powershell
git pull --ff-only
npm test
npm run check:launcher
node scripts/windows-studio-startup-smoke.mjs
npm run studio
```

The last command starts the interactive Studio at `http://127.0.0.1:4320/`; stop it with Ctrl+C. The smoke test creates temporary files in the system temp directory and deletes them. It does not modify existing `%LOCALAPPDATA%\WebREAStudio\runs` data or load the user's external dashboard.

To run the independent offline Chrome P4/F5 tests manually, set `CHROME_BIN` to the absolute path of an installed Chrome executable (for example `C:\Program Files\Google\Chrome\Application\chrome.exe`), then run `node tests/p4-chrome-e2e.mjs` and `node tests/p5-saved-geometry-chrome-e2e.mjs`. These tests create separate temporary fixtures and do not visit the original external site.

## Interpretation and remaining gates

- A successful `windows-latest` runner job confirms Windows process/file/path/loopback/CDP compatibility **in GitHub's runner image**, **not on the owner's particular laptop**.
- The Windows smoke does not prove REA third-party provider installation/capture. The existing `p0-rea-smoke.ps1` and actual owner-side controlled fixture inspection remain independent P0 acceptance.
- These tests do not grant permission for a secondary API origin or restore the target site's dynamic data; Q1 real URL/CORS remains blocked pending explicit ownership/scope consent.
- Passing static RGB, position and screenshot comparisons is not proof of functional backend, JavaScript, input interactions, responsive views or product readiness.
- If Windows CI is red, do not report Windows compatibility as verified. Record the exact failing step and code SHA, fix the identified cause, then rerun CI.

## Windows issues discovered by real runner

- A preexisting `tests/storage.test.mjs` assertion expected literal Unix `/tmp/custom`, but `node:path.resolve` correctly produces drive-qualified paths on Windows. Fixed the cross-platform test to compare the platform-normalized `resolve('/tmp/custom')` without changing real storage policy.
- An initial hostile-Host probe used `fetch`, which the runner normalized to the actual request URL's Host. Fixed the test to send a raw HTTP request so the server's 403 Host rejection is genuinely exercised.
