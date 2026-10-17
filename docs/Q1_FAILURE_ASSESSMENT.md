# Q1 Saved Failure Assessment — policy compatibility is not causality

Date: 2026-10-17 KST. Scope: **failed/interrupted previously saved `dynamic-passive` runs only**. No live API, browser invocation or permission change.

## Design choice and constraints

| Option | Performance/cost | Maintenance | Main issue |
| --- | --- | --- | --- |
| A. Append a text message to the existing diagnosis | Cheapest | Low implementation cost | No independent, portable evidence consistency test; easy to misread a generic failure as proof |
| **B. Separate bounded read-only assessment (selected)** | Small constant-time scan (at most 40 saved groups), no remote calls | Deterministic pure assessment, separately testable and additive to existing JSON schema | Still cannot prove a live API cause or obtain missing request paths |

The user previously authorized advancing bounded local-only steps with `3`. This feature does **not** authorize new origin access or change security controls.

## Implementation

- `studio/q1-failure-assessment.mjs`: compares the existing redacted `support-packet` and `permission-preflight`, verifies counts and host-level matches internally, and inspects the **current local source policy** through the existing `approveBrowserRequest` and `LOCKDOWN_CSP`. Synthetic `*.example.org` URLs are passed to the **pure approval function only**; no DNS lookup or HTTP request.
- `GET /api/runs/:id/q1-assessment`: persists nothing and uses only saved inspection/report/diagnosis; only failed/interrupted passive records are eligible. Wrong run mode `404`, completed passive `409`, missing inspection `404`.
- Studio failure panel includes a JSON download and a message explicitly distinguishing *compatible with the local browser policy* from *the remote cause has been proven*. GET/history viewing does not execute captures, apply network permissions or change existing files.
- The new JSON deliberately exports **no hostname, full URL, path, query, page label, response body or credentials**. It contains only allowlisted reason codes, small counters, known unknowns, and fixed boolean policy evaluations.

## Evidence contract

- `LOCAL_POLICY_BOUNDARY_COMPATIBLE_NOT_CAUSAL`: failed capture, consistent observed `fetch` rejection at the same external host, current same-origin GET guard and `connect-src 'self'`. **Not** a verified CORS, server health, endpoint, authorization or per-request causal diagnosis.
- `FETCH_FAILURE_CAUSE_UNATTRIBUTED`: a rejected `fetch` without a consistent same-host candidate.
- `CAPTURE_FAILURE_NOT_CONFIRMED`: this redacted snapshot did not establish a failed capture.
- `EVIDENCE_CONFLICT`: source formats, counts, host-class matching or permission state conflict; fail closed.
- `evidence_status` is `BOUNDED`, `PARTIAL` (missing/omitted events) or `INCONSISTENT`. `BOUNDED` does not mean complete original network instrumentation.
- For every result, `cause_identified=false`, `cors_verified=false`, `remote_api_healthy_verified=false`, `network_permission_granted=false`, `decision=BLOCK_NETWORK_EXPANSION`.

## Verification boundary

New unit tests cover consistent host-level records, missing and omitted details, completed capture, malformed/mismatched packet and host confidentiality. New local HTTP test exercises error statuses, no extra executor invocation after GET, safe downloaded response, and UI link. Both tests are included automatically by `npm test` and the existing Linux/Windows GitHub Actions workflow. **A CI run is not the same thing as actual Windows PC manual testing or a real site/API recovery.**

The user's two saved redacted JSON files were reviewed locally: they agree on 1 `fetch` attempt, 1 rejection, one matching external-host candidate and 3 omitted events. Only this abstract numeric evidence is recorded here; neither raw file nor the actual hostname/IP is committed. This maps to **policy-compatible observation with partial evidence** if the local current policy remains unchanged, not a recovered data-ready dashboard.

Do not auto-approve an observed hostname (particularly DNS/IP-encoded wildcard services), introduce credential forwarding or relax CSP. Exact host ownership, paths/methods, quota, DNS/TLS/SSRF and explicit owner approval remain separate blockers.

## Next step

Continue independent synthetic F1–F5 regression work. For real Q1 authorization, establish target and API ownership, precise read-only access scope and request budgets before any permission or external relay change. Final real-site product acceptance is not yet possible on this evidence alone.
