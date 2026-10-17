# F5 saved independent draft → offline observed geometry correction (2026-10-17)

## User-facing workflow

After a completed `Static Visual` capture, the owner downloads the sanitized P4 geometry starter, edits a **separate static layout JSON**, and explicitly saves it in local Studio. The draft is stored as `STORED_UNVERIFIED`. This new step adds a **second, separate opt-in button**: `오프라인 위치·크기 검증 및 보정`.

Only after the owner presses the new button, Studio:

1. Checks a completed original capture, saved original PNG/P4 geometry, P5 v2 comparison, stored independent P4 geometry/HTML and the immutable draft receipt.
2. Recalculates the canonical HTML from stored sanitized geometry, checks its exact equality to the stored HTML, its SHA-256 and receipt byte count. Missing or changed local draft artifacts are rejected **before launching Chrome**.
3. Uses a fixed synthetic HTTPS address `https://p5-saved-geometry-offline.example.org/` with a memory-only, exact-URL relay and JavaScript disabled. Chrome captures **the stored draft**, never the original live website.
4. Uses the independent Chrome observation of the draft, not merely the user's claimed JSON positions, to run strict source/draft paint-region alignment. Unknown, duplicate, unmapped or multiple defects do not get repaired.
5. Before editing, re-renders the normalized starting HTML and checks its image agreement against the previously observed saved draft. Only after this independent draft preflight passes does the bounded P4 rectangle repair engine correct at most two x/y/w/h fields.
6. Each proposed edit must independently improve the full-canvas Chrome comparison and respect geometry, text, visual-quality and nonregression gates. If no safe candidate exists, a **stop/no-op receipt** is saved, with no improved HTML.
7. Only when at least one patch was measured and accepted, a separate `geometry-repair.html` is stored as a sandboxed scriptless downloadable attachment. Original source screenshot, analysis inspection, report and stored user draft files remain unchanged.

## Read/write API contracts

- POST `/api/runs/:id/geometry-repair` requires same-origin, `application/json`, at most 256 bytes and exactly `{"confirm":"offline-geometry-review"}`. It does not accept URLs, selectors, raw HTML, target changes, headers, credentials or altered network scope.
- Completion status and summary are read-only GET `/api/runs/:id/geometry-repair`. While a job runs the GET reports 202, and when it finishes the saved `geometry-repair.json` reports the sanitized assessment, source-draft SHA-256, original source untouched, external network requests 0, confirmed color/coordinate measurements and explicit limitations. Reading the page or history never executes Chrome.
- `/api/runs/:id/geometry-repair-download` returns an attachment with no-script/no-connect/sandbox CSP only when the finished receipt proves at least one accepted improvement and an improved HTML file exists.
- A single Chrome concurrency lock covers regular analyses, F5 color review and this geometry review. Repeated concurrent POST or an already persisted receipt returns a conflict; GET remains read-only. A crashed/interrupted run without a completed receipt may require deliberate repeat execution; there is no background automation guarantee.
- Scratch Chrome captures are under the private run folder and removed afterward. Actual original site URL is not forwarded to Chrome, the memory-only relay or its renderer.

## Explicit engineering limitations

- The imported draft is user-authored static P4 geometry, not arbitrary HTML or verified independent site functionality.
- Only large uniquely identified painted regions with a bounded single defect can be repaired. Repeated cards, changed paint, nested complex layers, large changes or missing source evidence fail closed.
- The original screenshot is **only one viewport**. No real cross-viewport robustness or API/JS behavior parity is claimed.
- The independent Chrome proof is synthetic in GitHub Actions and not an actual Windows owner acceptance. Original real-site `Failed to fetch` and Q1 third-party API host approval remain unresolved.
- A successful receipt means a measured static improvement, not a finished functional website.

## Verification

- `tests/p5-saved-geometry-repair.test.mjs`: re-hash/tampering rejection without browser launch, safe stop receipt and source preservation, HTTP same-origin confirmation/duplicate/GET/read-only/attachment gate.
- `tests/studio.test.mjs`: opt-in UI and conditional download.
- `tests/p5-saved-geometry-chrome-e2e.mjs`: truly isolated Chrome with separately captured synthetic original and explicitly stored independent draft; observes changed painted `div`, verifies normalized draft preflight, independently approves x and width correction, persists only verified HTML, original and draft intact, external HTTP 0.
- GitHub CI includes all prior P4/F2/F4 and F5 color/viewport/geometry regression steps; record verified SHA and CI status in `HANDOFF.md` before calling this complete.
