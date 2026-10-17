# P2 saved passive API dependency report (2026-10-17)

## Two considered approaches
- A: automatically route cross-origin API requests. Potentially fixes rendering, but expands host permissions and introduces SSRF, CORS and data boundary questions. **Not approved or implemented.**
- B: extract dependency evidence from existing local Chrome captures only, with no target request. **Implemented.**

## Function
- `studio/passive-dependencies.mjs` groups previously saved network events by approved-origin safe pathname, or by external **hostname only**.
- Read-only `GET /api/runs/:id/dependencies` returns downloadable sanitized JSON for stored `dynamic-passive` inspection. No analysis restart or network relay.
- Only hostnames with both `fetch-attempt` and `fetch-rejected` in saved evidence become **unapproved review candidates**.
- Event matching by host is not HTTP-level causation. XHR.open is not proof of send. CORS/root cause/backend reachability remain unknown.
- Report limits to 100 events and 40 dependency groups. Rejects sensitive or malformed paths, arbitrary reason fields, non-HTTPS-scope traces, queries, external paths and raw response payloads.
- Previous runs and data are unchanged.

## Testing and remaining boundaries
- Unit tests and local Studio route tests included in `npm test`; CI Chrome suites continue unchanged.
- Windows execution, target live rendering, external host authorization and real F1/F2 behavior remain unverified.

## Failure inspector UI
- Selecting a saved failed `dynamic-passive` analysis shows an up-to-ten-row dependency summary with data completeness warning and `API 의존성 JSON` download link. It reuses `GET /api/runs/:id/dependencies` and never re-runs analysis.
- Non-passive failed analyses have no dependency link. Local Windows UI acceptance is outstanding.
