# Q1 external API permission preflight — saved evidence only (2026-10-17)

## Objective
Prevent the next real-site step from silently interpreting a failed fetch as permission to contact a second host. The first real dashboard remains blocked on locally saved Windows evidence and explicit host ownership / access scope.

## Competing designs
- A: Automatically approve previously rejected hostnames and broaden the gateway CSP/relay. Faster but cannot establish ownership, safe methods, exact paths, byte/request budgets, remote CORS or public DNS; rejected as unsafe.
- B: Produce a deterministic, **non-executable** offline preflight from the stored, already-redacted support packet. Explicitly list missing proof and risk classes, deny every network expansion until authority and controls are independently reviewed. Implemented.

## Implementation
- `studio/permission-preflight.mjs`: pure function using the existing privacy-minimized `support-packet` generator. Never reads private HTML, page labels, request bodies, full URLs/queries, or remote response content.
- Local GET `/api/runs/:id/permission-preflight` returns JSON only for stored failed/interrupted `dynamic-passive` analyses with matching inspection mode, otherwise HTTP 404/409. GET never triggers a capture or a new target request.
- Studio failure inspector shows `Q1 권한 사전 점검 JSON` and displays `BLOCK_NETWORK_EXPANSION` with observed candidate and blocker counts.
- Review candidates appear only when saved `fetch-attempt` and `fetch-rejected` occur for the same sanitized external hostname. Browser resource failure alone is not enough. This does not establish request-level causality or API necessity.
- Host classifications include special-use/local names, direct IPv4 and dynamically IP-encoded DNS names such as `sslip.io`, `nip.io`, `xip.io`; they require additional manual DNS/IP/SSRF scrutiny before any real connection. This detection is conservative and is **not** an actual DNS resolution.
- Authorization checklist values are all **null/not_verified**: ownership, exact HTTPS origin, path scope, safe methods, request/byte/time limits, credential behavior, CORS, redirects, pinned public DNS/TLS/SSRF defenses, rollback and audit.
- Every response has `permission_status: NOT_APPROVED`, `decision: BLOCK_NETWORK_EXPANSION`, `network_requests_issued: 0`, `executable_policy_generated: false`, `auto_allowlist_changes: 0`.

## Verification and limitations
- Tests cover evidence-backed host matching, missing data, reserved/local/IP-encoded names, privacy redaction, no rerun on GET, wrong-mode/completed status rejection, and UI link.
- CI: Node regressions and isolated Chrome P4/F2/P2-CORS/F4 suites. None of those tests establishes the actual dashboard API is reachable or authorized.
- **The real production gateway, approved targets and CSP remain unchanged.** No external API probe, user data upload, new permission, deploy or running local Windows evaluation.

## Next step
On the owner's Windows PC: `git pull --ff-only`, `npm run studio`; open a previously failed Passive Chrome run, read `안전 진단 패킷 JSON` and `Q1 권한 사전 점검 JSON` locally. Inspect candidate hostnames, then share the sanitized report only after reviewing it. Obtain exact scoped permission before designing an opt-in real-origin adapter.
