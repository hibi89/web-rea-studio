# P2-2a: passive approved HTTPS Chrome inspection (2026-10-16)

## Purpose and verification state

A new, **opt-in** mode for the exact HTTPS target in `config/approved-targets.json` renders the site using a new temporary Chrome profile and stores one screenshot plus a small DOM/network summary. It does **not** perform clicks, form submission, recursive browsing, authentication, or original-source recovery. It does not claim parity with the original website.

- P1: `rea-agents@6.5.0` still handles the synthetic controlled fixture only.
- P2-1: `static-html` mode remains the default for the approved real URL.
- P2-2a: `dynamic-passive` uses direct Chrome DevTools Protocol with no extra npm dependencies. It is a separate browser adapter, **not** a claim that REA's browser scenario has a safe external-URL allowlist.

## Boundaries and requests

1. URL must already be explicitly approved as an exact HTTPS URL; same-origin subresource GET requests are permitted only when triggered by this page. Subsequent top-level document navigation is only allowed to the originally approved URL. Any different origin, form POST, other HTTP method, iframe navigation, and unsupported resource types are rejected.
2. Chrome starts in an isolated temporary profile in headless mode, without user cookies, credentials, saved browser history, or extensions. The Chrome subprocess uses `--host-resolver-rules=MAP * ~NOTFOUND` and `--no-proxy-server` as defense-in-depth against independent outgoing browser connections. The debugger socket binds to the local loopback.
3. Chrome's intercepted GET requests are fulfilled only by the Node HTTPS gateway: fresh DNS lookup, public IPv4 checks, DNS-pinned HTTPS/TLS validation, no cookies/authentication headers, no redirects, no compressed payloads. Maximum 64 resource requests, 12 MiB total, 2 MiB per resource, limited MIME types, and bounded request timeout.
4. The document response adds a restrictive CSP. Third-party fonts, scripts, APIs, and images remain blocked, so visual fidelity can be partial. Request path logs intentionally exclude URL query values and credentials.
5. A one-page screenshot and bounded headings/control counts are saved under `%LOCALAPPDATA%\WebREAStudio\runs\<uuid>` along with a report. The API exposes only the summary, a PNG screenshot and allowed-path network event metadata. It does not publish raw HTML/JS payloads.
6. **This is application-level policy enforcement plus browser restrictions, not a hardened operating-system/network namespace firewall.** Do not use it with untrusted URLs, sensitive signed-in browser sessions, or high-risk sites. The first run should be the supplied, user-controlled site only.

## Windows test

From the existing private `web-rea-studio` checkout, stop the running Studio server with Ctrl+C first:

```powershell
git pull --ff-only
npm test
npm run studio
```

Open `http://127.0.0.1:4320/`. Verify the selected URL is `https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/`, select **Passive Browser · 화면 렌더링 / 클릭 없음**, then press **분석 실행 once**. A PASS should include a screenshot, one navigation step, captured page heading/button counts and a network resource summary. If some resources were blocked, render fidelity is `partial` or `unverified`, never assumed equivalent to the original design.

If the run fails, use the visible `error_code`; do not run repeated retries without identifying the failure. Failures should not reveal raw credentials or environment variables. A live Windows + Chrome P2-2a capture is **not yet verified**; do not call this code production-ready.

## Testing limits

Node unit and Studio API tests validate URL admission, same-origin GET rules, private-address blocking, mock HTTPS transport and a simulated Chrome DevTools transport, as well as persisted API results. In the authoring container, Chromium process startup required special sandbox privileges and navigation to an HTTPS hostname was rejected by `net::ERR_BLOCKED_BY_ADMINISTRATOR`. That environment did not yield a legitimate live screenshot. Windows user-host end-to-end validation is therefore a separate acceptance gate.

## Remaining P2-2b

- Observe user-approved individual interactions only after a per-action risk review and a verifiable network policy (not the current passive mode).
- Capture screenshots before/after and correlate DOM changes and same-origin API results.
- Build a source-attributed UI specification and compare independent reimplementations against recorded evidence.
- Consider hardened OS-level network containment and an automated Windows browser E2E in a controlled isolated environment before broadening beyond the selected site.

## 2026-10-16: request-completion and diagnostics regression

A real Windows browser capture showed `FAILED / resource_requests_unsettled`: two
intercepted requests, only one fulfilled, and a screenshot displaying
`보고서를 불러오지 못했습니다 / Failed to fetch`. Previously the passive inspector
sampled network tasks shortly after navigation and could leave before delayed
JavaScript fetches settled.

Changes:
- Bounded idle barrier waits for late JS requests, then a quiet interval after
  the last request settles; deadline still caps the wait at 22 seconds.
- CDP Fetch requests remain explicitly pending until the Chrome fulfillment
  or failure command resolves, rather than being counted as fulfilled before
  delivery to the browser.
- Network events record request starts, same-origin pathnames only (no query
  strings), third-party hostnames (without paths/queries), and sanitized browser
  failure categories. No new host is authorized automatically.
- A screenshot of an app error, or a page with pending resource requests,
  remains a FAIL. The failed screenshot is preserved for diagnosis.
- `npm run diagnose` now includes bounded, redacted network diagnostics for
  the latest failed passive-browser run, **without initiating another run**.

Tests cover late request settlement, permanently pending request deadlines,
redaction of third-party URLs, and local diagnostic file interpretation.
All tests are Node/mock or local HTTP tests; the authoring container's Chrome
still returns `ERR_BLOCKED_BY_ADMINISTRATOR` when navigating externally.
**Live Windows re-verification is required.** A different-origin report API,
redirect, CSP/CORS issue, or TLS/network timeout can still require a separate
explicitly approved remedy after inspecting the diagnostic evidence.
