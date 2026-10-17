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

## Field report: owner Windows runner stopped at node-regressions (2026-10-17)

The owner ran `git pull --ff-only` and `npm run accept:local` in the project directory. The first child Node regression process exited successfully (`RESULT node-regressions completed`), but the owner acceptance receipt recorded `CHECK_PROOF_MISSING`; **it is not evidence that any Node unit test failed**. The prior proof reader recognized only TAP's exact `# tests / # pass / # fail` footer, and the tool intentionally did not keep raw private stdout. Therefore the precise on-device output format is **unknown**. Do not assert this was a Node 24 default reporter without corroboration.

Fix: the child `node --test` invocation now requests `--test-reporter=tap` explicitly so Node's machine-readable footer is stable even when the owner uses a different supported Node release or terminal. The receipt reader also accepts Node's alternate `ℹ tests / ℹ pass / ℹ fail` spec summary or ANSI-colored TAP, but always requires **one internally consistent final count**, **at least 205 executed**, **all passed** and **zero failures**. Missing or conflicting totals remain blocked; no exit-code-only pass.

Regression tests cover both output styles, ANSI and intentionally inconsistent/missing/forged totals. Windows CI now tests the same one-command acceptance on **both Node 22 and Node 24**. Verified **GitHub Actions run 39007508598** at functional code SHA `546a791c0fd9dae1fe18df64d5b32d15803d4b98`: Windows Node 22, Windows Node 24 and Linux Node 22 **all SUCCESS**. Both Windows environments ran **210/210** regression tests and actually completed the same owner-style one-command **5/5** acceptance, including synthetic Chrome F5. The owner's original Windows PC remains unverified until they rerun after pulling this fix.

Owner retry after the corresponding GitHub CI passes:

```powershell
git pull --ff-only
npm run accept:local
```

The new JSON filename will differ from the previous failed receipt. Share only its sanitized `status` and `checks` if further troubleshooting is needed.

**Privacy note:** `results/acceptance/` is Git-ignored but is inside the clone. If the clone is under a OneDrive-synced Desktop or other synced directory, the receipt can also synchronize through that user's configured service. It is designed to omit credentials, URLs and personal paths, but a Git ignore rule is not a cloud-sync exclusion.

## Second owner laptop attempt: synthetic Studio loopback check failed

The owner ran `git pull --ff-only` and `npm run accept:local` after the TAP-proof fix. The new receipt reported **210/210 Node PASS** and **local-npx-launcher PASS**, then the disposable `windows-studio-loopback` step exited nonzero (`CHECK_EXIT_NONZERO`) before either Chrome P4/F5 step ran. The original smoke's stderr was intentionally not included in the public receipt, so the actual laptop-specific error **cannot be conclusively diagnosed from the receipt**.

The previous smoke also read `results/studio/runs` via Studio's automatic legacy migration, despite writing to an isolated temp directory. On an owner machine with older project data, this could copy/lock private legacy artifacts, unexpectedly populate the disposable run directory and cause a false smoke failure. This is a concrete risk found in the actual implementation, **not a proven cause of the owner's failure**.

The acceptance smoke now sets `WEB_REA_ACCEPTANCE_SMOKE=1` together with a private `WEB_REA_DATA_DIR` override. Only in that exact opt-in combination, `studio/start.mjs` **skips legacy data migration and uses zero approved external target URLs**. Normal interactive Studio startup is unchanged. The test still launches the actual Studio/fixture processes at loopback ports, exercises Host/query safety, and asserts the ephemeral run folder remains empty. Required Windows CI also creates a **fake old legacy run** before invoking the smoke, so importing it would fail the acceptance.

If a genuine machine-specific failure remains, the Windows smoke emits a **single allowlisted JSON category** on stdout with the phase of failure and a generic reason. The parent acceptance tool stores only `checks[].diagnostic.phase` and `checks[].diagnostic.reason` for a failed loopback check, not raw stdout/stderr, paths, credentials or HTML. This does not falsely convert failure to PASS or alter the first-failure stop policy.

After the relevant CI succeeds, the owner can retry the unchanged commands:

```powershell
git pull --ff-only
npm run accept:local
```

If it stops again at `windows-studio-loopback`, report the new sanitized `status`, `checks` and optional `diagnostic` only. The old failed receipts remain unchanged.

## Verified local smoke-isolation fix (GitHub CI)

GitHub code SHA `a5585bbcc8a53590ec5186e1287c9e13b3c0f11b`, [run 39009659884](https://github.com/hibi89/web-rea-studio/actions/runs/39009659884): **Windows Node 22 and Node 24 211/211 PASS each, owner-style `npm run accept:local` five checks each PASS**, Linux full existing Chrome acceptance PASS. Every required job **SUCCESS**. The Windows workflow deliberately seeds a fake old `results/studio/runs/<synthetic-id>` folder before the startup smoke; the smoke passes because its temporary capture no longer reads or imports that legacy data. The original user site's permissions are not broadened.

This is runner evidence only. **The owner's second personal laptop result remains `CHECK_EXIT_NONZERO` from the prior version**, and no third run of the fixed version on their laptop has been supplied. If a local issue remains, new receipt fields `diagnostic.phase` and `diagnostic.reason` classify only the failure phase without private paths or raw child output.
