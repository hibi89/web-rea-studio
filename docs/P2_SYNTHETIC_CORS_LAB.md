# P2 cross-origin data loading: real Chrome synthetic proof (2026-10-17)

## Why the original dashboard is still failing

The real-site `dynamic-passive` adapter currently enforces both **same-origin GET** in `approveBrowserRequest` and `connect-src 'self'` in `LOCKDOWN_CSP`. A cross-origin API needed for an application's data cannot work through that security boundary. The prior real screenshot showed `Failed to fetch` and a saved, unapproved external-host fetch attempt/rejection. This evidence does **not** prove that the remote backend is available, that CORS is correctly configured, or that permitting it would fix the page.

## Two approaches considered

- **A: Enable the observed external hostname automatically.** Faster to try but unsafe: unknown ownership, URL paths, query secrets, backend behavior, origin controls, CORS and SSRF exposure. **Not implemented**.
- **B: Before any live change, reproduce the cross-origin boundary in a completely synthetic, local-only browser experiment.** Delivers evidence about CSP and CORS while protecting external hosts and preserving the original gateway. **Implemented**.

## Synthetic experiment

- `studio/synthetic-cross-origin-browser.mjs`: fixed two-origin HTTPS fixture names under `*.example.org`. No user-provided target URL, no credentials, no external HTTP requests, no configuration or policy changed in the real passive browser.
- Chrome runs with a fresh profile, independent DNS disabled, no proxy, and Chrome DevTools `Fetch` interception. Both the page and JSON API response are **generated in memory**.
- The only synthetic API permission, if explicitly enabled by a **test-only flag**, is one exact GET URL and resource type `Fetch` or `XHR`; arbitrary origins, POST, redirects, credentials, other paths and navigation are denied.
- Three cases are tested:
  1. Default `connect-src 'self'`, API not approved → the JavaScript fetch fails.
  2. API is named in CSP and test interceptor, but response lacks `Access-Control-Allow-Origin` → the browser rejects the fetch due to CORS.
  3. API is named in CSP and test interceptor and synthetic response has an exact-origin `Access-Control-Allow-Origin` → the browser can read the response.
- `tests/synthetic-cross-origin.test.mjs`: policy and admission unit tests. `tests/p2-cross-origin-chrome-e2e.mjs`: **actual isolated Chrome**, required in `.github/workflows/local-studio-ci.yml`.
- Success in this laboratory means only that a CORS-capable, explicitly permitted *synthetic* response is readable. It is **not** authorization or evidence of live API access.

## Production boundary unchanged

No change to `studio/dynamic-browser.mjs`, `studio/dynamic-gateway.mjs`, `config/approved-targets.json`, saved user data, Vercel or CSP in real-site mode. The browser remains passive and blocks off-origin APIs.

## Next milestone

1. On the owner's Windows PC, open the saved Failed `dynamic-passive` run and inspect `안전 진단 패킷 JSON`; inspect locally before sharing hostnames.
2. Obtain **specific** owner authorization for host, methods, path bounds, request/byte budgets, and retention before adding an explicitly opt-in real-origin relay.
3. If approved, design a production-safe origin-specific policy with pinned public DNS/TLS, no credential forwarding, no redirects, CORS behavior, an auditable allowlist, and a kill switch. Re-run tests and compare the real app to the original only with evidence.

No live API integration or functional website reconstruction has been verified.
