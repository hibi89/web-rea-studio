# Owner Windows PC: one-command offline REA Studio acceptance (2026-10-17)

## Objective

The existing **GitHub Windows runner** tests prove that the application can start and render synthetic Chrome fixtures on a clean Windows runner. They do not prove it works on the owner's particular laptop. This workflow adds a **repeatable, user-triggered owner-machine check** that does not contact an actual target website or alter existing WebREAStudio evidence.

## Local commands

Open PowerShell in the private `web-rea-studio` project directory after reviewing changes. If the project is a Git clone already on `main`, update it:

```powershell
git pull --ff-only
npm run accept:local
```

The acceptance entrypoint requires a supported Node version (22.19+, 24.11+, or 26+) and Google Chrome. It uses a standard Windows Chrome installation or `REA_BROWSER_EXECUTABLE` / `CHROME_BIN` when set. Run through `npm run accept:local` rather than calling the entrypoint directly, so the local npm launcher path is recorded by npm itself.

This command runs only five **offline/synthetic** checks:

1. Complete local Node regression tests; read the real test count and require at least 205 with no failures.
2. Locally installed npm `npx-cli.js --version` preflight (no `npx -y rea-agents` or package downloads).
3. Launch the *actual* Studio entrypoint and a local fixture, with a separate temporary run directory containing spaces. Check loopback-only HTTP, hostile Host 403, invalid query 400, and zero captured runs.
4. Chrome P4 static capture and independent scriptless reconstruction for an in-memory synthetic page.
5. Chrome F5 of a separately stored synthetic draft, requiring two real, independently observed `x,w` coordinate/size improvements, full-screenshot MAE reduction, five browser replays, original site not revisited and external requests = 0.

The command stops at the first failed check, with a generic failure code. It **does not** read the owner's prior app run directory, cookies, site tokens, private dashboard or OneDrive; it does not expand browser network permissions, install REA, or upload reports. Standalone fixture/browser checks use transient system temp folders and clean them on exit.

## Local receipt

Every invocation writes a new *local-only* JSON receipt under `results/acceptance/acceptance-<timestamp>-<short-id>.json`, already excluded from Git by `results/*`. It records only: platform category, ISO timestamp, check IDs, PASS/FAIL/BLOCKED status, generic failure codes, and narrowly curated nonprivate numeric test/Chrome measurements. It intentionally omits original URLs, absolute Chrome path, user home directory, error stack, raw child process output, cookies, personal page data, credentials and tokens.

If the output is `PASS` on the owner's computer, it verifies the Windows local process, loopback, browser and synthetic F5 correction there. This is stronger evidence than GitHub Windows CI but **still** does not verify live dashboard behavior, API/CORS, REA provider capture, real interactive states, responsive implementation or backend parity.

If `BLOCKED`, see the receipt for one of: `WINDOWS_REQUIRED`, `NODE_UNSUPPORTED`, `NPM_RUN_REQUIRED`, `CHROME_NOT_FOUND`. `FAIL` codes include `CHECK_EXIT_NONZERO`, `CHECK_TIMEOUT` and `CHECK_PROOF_MISSING`. No raw error messages or absolute local paths are included in the receipt.

The owner can share this specific JSON report for troubleshooting after a personal review. Do not ask for whole run folders, cookies, environment variables, raw REA captures or browser profiles.

## Development and CI boundary

- Pure policy: `scripts/local-acceptance-core.mjs`; bounded CLI process orchestration: `scripts/local-acceptance.mjs`; command: `npm run accept:local`.
- `tests/local-acceptance.test.mjs` verifies success, unsupported versions, missing browser/npm, injected fake private strings excluded from receipts, malformed proof rejection, and strict stop-first behavior.
- GitHub `.github/workflows/local-studio-ci.yml` runs the **same command** in a real `windows-latest` job after the existing Windows Node/launcher/Chrome checks. This proves the packaging, actual child process contract, receipt and semantic parsing on the runner. The user laptop acceptance remains separate until the owner runs it.
- Existing Linux full Chrome CI remains mandatory. An offline fixture success must never be described as successful arbitrary third-party website reconstruction.

## Remaining development priorities

After owner-machine acceptance, inspect a personally reviewed redacted Q1 support/permission preflight packet for the specific failed dashboard. Do not grant external API access or alter target scope without explicit approval of the exact domain/path/method/rate and data handling. Improve generic multi-state/visual repair within the fixed original safety limits.

## First verified integration run (GitHub Windows runner, 2026-10-17)

Functional SHA `c77a5e8d6a29e67c4a1266bfb5375d21eee7c937`, [Windows GitHub Actions run 39006172347](https://github.com/hibi89/web-rea-studio/actions/runs/39006172347):

- **Owner-style `npm run accept:local` executed by the actual Windows runner: PASS.** Five proof-gated steps passed, and a locally ignored `results/acceptance/acceptance-*.json` receipt was actually generated. The CLI itself was exercised end-to-end; this is not only a mocked unit test.
- Windows Node **209/209 PASS**, local npm launcher PASS, local Studio startup/Host rules PASS, actual Chrome P4 PASS, actual Chrome F5 saved-draft pass with **two accepted `x,w` changes and MAE 2.41→1.61**.
- The receipt contains only allowlisted results; tests check that injected credential-like strings and actual browser/user paths are not included.
- **Both mandatory jobs (Windows and full Linux Chrome regressions) concluded SUCCESS** in this same Actions run. The owner-PC acceptance remains separate.
- Owner's actual PC is still **UNTESTED**. Running this command on GitHub infrastructure cannot inspect, validate, or modify a user's own Windows installation.
