# Source audit (2026-10-16)

Upstream: https://github.com/morluto/rea, release `rea-agents-6.5.0`.

- CLI and MCP surfaces coexist; package name is `rea-agents`. Node supports 22.19+, 24.11+ or 26+.
- `docs/browser-observation.md` exposes passive CDP target inspection, screenshot and JavaScript metadata analysis.
- `docs/browser-scenario-contract.md` exposes declarative Playwright-owned browser scenarios. No independent origin allowlist or request interception.
- `docs/website-script-export.md` allows captured script export with provenance caveats.
- `docs/installation.md` distinguishes one-shot CLI from setup that modifies global agent registrations.
- MIT code and separately licensed integrations must be distinguished.

Decision: P0 invokes pinned CLI once, no global setup. A future adapter should enforce independent authorization and origin/action constraints.
