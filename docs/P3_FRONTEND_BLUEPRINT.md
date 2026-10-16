# P3 frontend evidence blueprint

## Verified code capabilities
- Static HTML mode still makes one HTTPS GET. It now parses element counts, inline JavaScript token markers, CSS colors, and redacted script/stylesheet references. This is HTML-only evidence, not a live JavaScript analysis.
- Passive Chrome mode additionally runs one read-only DOM geometry probe after screenshot capture. The probe records at most 64 visible semantic elements and a small set of computed CSS fields. It does not trigger fetch, click, navigation, or login.
- The local Studio inspector shows these blueprints even on an application-render failure when a screenshot and DOM summary were saved. A screenshot of `Failed to fetch` remains an application **FAIL**; it is not proof of a successful dashboard.
- No new hosts are approved, no n8n credentials are needed, and no API mock is run. JavaScript function-pattern matching is approximate; coordinates describe only the actual captured screen.
- HTML sources, raw script bodies, cookies, request queries and input values are not saved by the blueprint.
- A future opt-in local API mock will require an observed or otherwise verified response schema; it must not be confused with original backend data.

## Acceptance check
Stop the local Studio, run `git pull --ff-only`, `npm test`, then `npm run studio`.
Select the approved page, choose **Static HTML** to examine the static blueprint.
For a new **Passive Browser** capture, the computed layout should appear below
Evidence Inspector even if data loading is blocked. Windows Chrome verification
is still required; GitHub Node tests do not prove live third-party rendering.
