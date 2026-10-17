# P2 one-click offline failure support packet (2026-10-17)

## Motivation and tradeoffs
A. Ask the owner to share raw screenshots, inspection JSON, browser logs and URLs separately. May supply more detail but risks exposing credentials, page labels, query strings or private payloads. **Rejected.**
B. Build a strict, bounded diagnostic JSON from already saved run evidence, with only status counters, coarse endpoint classes, sanitized external hostnames and reason codes. **Chosen.** Zero new website requests or analyzer launches.

## Implementation
- `studio/support-packet.mjs`: pure, shape-whitelisted construction using `buildPassiveDependencyReview`, without reading raw page labels, page HTML/JS, input values, screenshot, stderr, full URL or external path.
- `GET /api/runs/:id/support-packet`: local, read-only JSON download, only for failed/interrupted `dynamic-passive` runs whose saved inspection mode matches. Normal completed and non-passive runs are denied; missing evidence stays unavailable.
- `studio/public`: failed-run diagnosis exposes `안전 진단 패킷 JSON` after the local saved-dependency review loads. Selecting history and GET do not launch a new capture.
- Output includes observed hostnames when available, approved-origin **path category only** (not paths), request counts, failure classifications, limited HTTP status/reason codes, control counts, and explicit unverified causal relation.
- Output includes `privacy.review_before_sharing=true`. Hostnames may reveal site architecture even without credentials; owner must inspect downloaded file before sharing it.

## Verification and boundaries
- Node tests use injected sensitive URLs, labels, passwords and token strings to assert no leakage, unknown legacy fields, and explicit unapproved status.
- Local HTTP route tests assert 200/404/409, content-disposition, no raw secrets, and no POST/analyzer re-execution from GET.
- Existing synthetic Chrome regression continues in GitHub Actions; **this does not resolve** the previously observed `Failed to fetch` in the real target application or prove external API availability.
- No new host approval, cross-origin gateway relay, user credential access, deployment, Vercel config change or remote API probes.

## Owner Windows acceptance, after pulling latest code
1. Run `npm run studio`, open `http://127.0.0.1:4320/`.
2. Choose an existing **failed Passive Chrome** history item, not a new analysis.
3. In `실패 원인 진단`, select `안전 진단 패킷 JSON` after the saved dependency summary appears. If inspection evidence is unavailable, the link remains hidden.
4. Review JSON locally. Share only if comfortable with included hostnames and counts; do not share raw run directories, screenshot, credentials or unrestricted reports.
5. Review which host the prior failure tried to reach and seek explicit host ownership/authorization before changing network permissions.

## Next step
Analyze the returned saved support packet, distinguish observed facts from hypotheses, then choose a narrowly scoped, authorized next verification. Do not assume the dashboard is fixed.
