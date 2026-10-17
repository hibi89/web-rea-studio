# P2 passive browser app-render verdict hardening — 2026-10-17

## Alternatives
- Open automatic cross-origin gateway permissions: may display missing data but increases network/security exposure and requires explicit host authorization. Not selected.
- Tighten the current passive verification from already observed fetch/CDP failures: no additional target requests and no permissions change. **Selected.**

## Behavior
- `fetchRejections > 0` adds `fetch_requests_rejected` to `assessPassiveRender` failures even when the UI does not print "Failed to fetch".
- Failed relay of a core `Document`, `Script`, `XHR` or `Fetch` increases `criticalBlocked`; adds `critical_resources_blocked` to the failure verdict and `critical_resources_blocked` to the saved report.
- Cosmetic favicon/image errors by themselves can leave capture `PASS` with `render_fidelity=partial`. A PASS screenshot still never proves full UI or API equivalence.
- The original failing dashboard and its backend are **not fixed** here. Prior runs are not regraded. External hosts are still disallowed absent separate authorization.

## Regression scope
- Node test: invisible fetch rejection fails.
- Node test: critical resource block fails.
- Node test: cosmetic resource block stays partial, not assumed full fidelity.
- Existing CI includes Node tests and isolated synthetic Chrome integration. Real Windows and target-host behavior remain unverified until observed.

## Saved-run read-only diagnosis extension
- Matched cross-origin fetch attempt + rejection hostnames appear as **unapproved permission review candidates**, not guaranteed required backend hosts.
- Core resources blocked and rejected fetch without matching external host get separate conservative diagnoses.
- Only previously stored local evidence is inspected. No external network request, no allowance change and no sensitive request path/query exposed.
