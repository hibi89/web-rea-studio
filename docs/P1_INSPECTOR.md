# P1-2 local evidence inspector and failure diagnostics

Scope: only the controlled local fixture `http://127.0.0.1:4317/` can be analyzed. This update does not authorize remote sites, crawl links, or reconstruct proprietary source code.

## Data flow

1. The Studio owns a user-clicked POST analysis job and writes one `scenario.json` in its own UUID directory.
2. REA `rea-agents@6.5.0` captures the declared six actions and outputs a raw Evidence JSON to local disk.
3. The strict P0 verifier checks browser process ownership, action states, DOM/accessibility digest integrity, required API events, and completeness.
4. The inspector creates a **fixture-only** projected `inspection.json`: action names/status/durations, final page control IDs, sanitized URL origin/path, and network request/response status. Query strings, headers, cookies, storage, DOM bodies, network bodies, and screenshots are excluded from this projection.
5. The Studio serves stored `report.json` and `inspection.json` read-only; GET never triggers another analysis. Raw capture stays local in `.gitignore`-protected results.
6. The UI shows per-step and network rows, a visible status failure banner, and a fixed local path to the error log. It does not return raw stderr to the browser.

## Failure investigation (local only)

Run `npm run diagnose` in the project root to classify the **latest failed run**, including earlier P1 attempts. Optionally specify a run UUID with `npm run diagnose -- <uuid>`. The command inspects filesystem metadata and the local stderr log, prints only categorical diagnosis and byte counts, and never submits or prints the raw log text.

Known diagnosis categories: `EXECUTABLE_OR_MODULE_MISSING`, `BROWSER_LAUNCH_FAILED`, `NPM_OR_NETWORK_ERROR`, `REA_TIMEOUT`, `FILE_ACCESS_DENIED`, `INVALID_OUTPUT`, `REA_EXIT_NONZERO` or `UNKNOWN`.

If diagnosis is `UNKNOWN`, inspect `results/studio/runs/<uuid>/rea-stderr.log` privately. **Do not publicly upload credentials, auth headers, session cookies, or raw Evidence.**

## Verification boundary

- Fixture API/security test and deterministic fake-executor tests run locally in CI via `npm test`.
- The current authoring environment does not have the owner's Windows/Chrome session. Real Studio REA execution must be confirmed by the owner after `git pull`.
- A successful P0 PowerShell CLI invocation is not the same as a successful P1 spawned CLI subprocess. Never claim the latter without local run evidence.
- Browser URLs and screenshots outside our test fixture remain unsupported in this phase. Future external-site support requires an explicit authorization mechanism, redirect/network containment and secret redaction.
