# Web REA Studio — P0

Private source repository for a **controlled local web reverse-engineering smoke test**, not a production cloning service.

## First-time Windows setup

Do not overwrite your previous ZIP folder. From its parent directory:

```powershell
git clone https://github.com/hibi89/web-rea-studio.git
cd web-rea-studio
npm test
node scripts/check-host.mjs
powershell -NoProfile -File .\scripts\p0-rea-smoke.ps1
```

Review the plan and runner. To allow npm download of the pinned REA package and run it against **only** the synthetic loopback fixture:

```powershell
powershell -NoProfile -File .\scripts\p0-rea-smoke.ps1 -Execute
```

If an organization policy blocks script execution, do not bypass it without authorization. This runner changes no global Codex/Claude MCP configuration. Evidence is written to `results/`, which is excluded from Git.

For subsequent source changes: `git pull --ff-only` in this checkout, then rerun `npm test`.

## What is and is not verified

- Owner's previous local fixture test: 7/7 pass.
- Current GitHub version: requires testing on owner machine.
- Pinned release: `rea-agents@6.5.0`.
- Windows REA browser run: **NOT VERIFIED**. The previous attempt stopped on npm stderr handling; the new runner delegates the command to `cmd.exe` and checks exit code.
- Successful JSON parsing alone does not certify click action fidelity or source equivalence.

Upstream: https://github.com/morluto/rea ; https://github.com/morluto/rea/blob/rea-agents-6.5.0/docs/browser-scenario-contract.md

## P0 enhanced evidence verification

The Windows REA 6.5.0 command completed and saved a JSON Evidence envelope on the owner machine, but the original validator checked JSON syntax only. This new revision records DOM, accessibility, and URL after every scenario action and checks action status, digest integrity, visible changes, API request/response, origin and cleanup.

From the GitHub checkout:

```powershell
git pull --ff-only
npm test
powershell -NoProfile -File .\scripts\p0-rea-smoke.ps1 -Execute
```

Only a report with `"verdict": "PASS"` passes our controlled-fixture criteria. Do not share raw Evidence from unrelated websites. This does not demonstrate full website reconstruction, source recovery, or generalized security isolation.
