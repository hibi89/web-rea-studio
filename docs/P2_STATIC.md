# P2-1: authorized HTTPS static structure inspection (2026-10-16)

## What is implemented

- P1 controlled fixture remains the *only* REA/Chrome browser scenario, with the already verified 7-step smoke and screenshot.
- P2-1 additionally supports **one passive HTTPS document GET** for an explicitly approved exact URL. It extracts a bounded page title, H1-H6 headings, structural button/input/form counts, total links, and up to 25 same-origin pathnames. No query strings, form values or HTML bodies are served via the Studio API.
- Output is stored as a separate `static-html` run under `%LOCALAPPDATA%\WebREAStudio\runs` on Windows. The report explicitly says **not** a REA browser capture. No screenshot is claimed or displayed.
- Refresh and result polling are read-only; no second network fetch occurs without a new button click. A single-active-job restriction is retained.

## Windows usage

In a PowerShell window after entering the private project folder:

```powershell
git pull --ff-only
npm test
$env:WEB_REA_ALLOWED_URLS='https://YOUR-AUTHORIZED-DOMAIN.example/'
npm run studio
```

The example domain above is a placeholder; replace it with an exact real HTTPS URL that you own or have explicit permission to inspect. **Never run the placeholder.** If you want only P1 local browser mode, do not set this environment variable.

Open `http://127.0.0.1:4320/`. Paste exactly the approved URL into TARGET URL and press **분석 실행** once. The GUI lists the approved URLs. `WEB_REA_ALLOWED_URLS` may include up to 12 comma-separated exact HTTPS URLs, with no query, fragment, credentials or custom ports. Restart Studio after changing the environment variable.

## Boundaries

1. An unapproved URL cannot be scheduled; no wildcard, subdomain expansion or arbitrary URL submission.
2. HTTPS only, original TLS certificate verification enabled. A single DNS lookup chooses an IPv4 address after filtering; globally routable IPv4 is required and the chosen address is pinned in HTTPS request. Private, loopback, metadata, multicast, documentation and benchmark IPv4 targets are blocked; IPv6 connectivity is not supported.
3. Strict one-request limit. No redirect following, no cookies, no authentication, no JavaScript, no POST, no image/CSS/JS requests, no browser action. Maximum 512 KiB HTML, 10-second HTTPS request timeout, and only `text/html` with no content encoding.
4. HTML parser is intentionally approximate. Client-rendered frameworks can yield an incomplete structure; scripts and runtime API calls are **not** executed or inspected.
5. No generic REA browser navigation is enabled for outside URLs. REA's browser-scenario contract alone does not enforce outbound request restrictions, so an independently enforced browser egress boundary remains a prerequisite for external browser mode.
6. All tests for external HTTPS mode use injected in-memory mock transports. **Actual authorized external-site HTTPS integration has not yet been run on the user's Windows machine**. P2-1 should be treated as code complete / real-host verification pending.

## Next P2-2

After one authorized site passes the passive static capture, add an independently enforced browser request allowlist/redirect containment, content and secret redaction, opt-in click scenarios, and screenshot/dynamic DOM capture; verify on the owner's Windows machine before advertising generalized website cloning.
