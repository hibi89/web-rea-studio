# P4 bounded colored primitives — CSS-only chart bars

Date: 2026-10-17. A bounded improvement to **scriptless static visual geometry**; not a semantic or interactive chart reconstruction.

## Rationale and alternatives

P4 already captures larger boxes (min 80x36) and H1–H3 headings. Thin colored bars in CSS-only charts were omitted, so the independent HTML could preserve a chart container while missing its contents.

| Alternative | Complexity | Fidelity and risk |
| --- | --- | --- |
| A. Keep ignoring small shapes | Minimal | Omitted bar appearance stays visibly wrong |
| **B. Record bounded small solid-color `div` rectangles (selected)** | Low, reuses existing getComputedStyle data | Preserves visible static bar geometry, no new text/network |
| C. Copy SVG/canvas or chart JavaScript | High | Scripts, potentially private data, DOM identity and third-party resources; not approved |

## Implementation and trust boundary

- The pre-existing read-only P4 probe inspects visible `div` candidates from its same 1,400 DOM nodes. `primitives` is an optional array of **at most 48** solid-color rectangles. A candidate must differ in computed background color from its parent, be at least 8px by 8px and 144px², and fit the compact rule `width < 80` **or** `height < 36`. Candidate width ≤800, height ≤480 and position within the bounded captured document. **Only x, y, w, h, background and border radius** are retained; no HTML, URL, text, chart values, SVG, canvas bitmap or input state.
- The server-side sanitizer independently limits coordinates, dimensions, bounded count and allowed palette/radius. Missing/non-finite coordinates, extra fields, unrecognized CSS (including `url()` or declaration injection), invisible or oversized geometry are rejected. This is a static geometric observation and does **not** establish that a shape is semantically a chart bar, or its numerical data.
- The independent scriptless renderer creates absolute positioned inert `<div class="primitive" aria-hidden="true">`s, painted after large regions but before already-known titles. No page scripts, origins, assets, fetch or interactive handlers are copied.
- **Compatibility:** Old saved geometry lacking `primitives` or containing an empty array produces the identical legacy P4 generated HTML (including CSS selector text and SHA validation). Existing saved runs are neither rewritten nor replayed automatically.
- The same DOM candidate cap, origin/CSP restrictions and static visual privacy boundary apply. No fresh external website capture has been conducted.

## Verification

- New `tests/p4-compact-chart-bars.test.mjs`: visible six-property geometry render, unchanged legacy HTML, malicious/invented CSS and bounding rejection, max 48 cap, isolated fake passive DOM with ignored sensitive bar text.
- Mandatory Linux real Chrome `tests/p4-compact-chart-chrome-e2e.mjs`: one synthetic static page with six 30px-wide colored `div` bars; source observation, independent legacy HTML without primitives, independent measured HTML with primitives; both generated pages must remain scriptless. **Require full-canvas RGB MAE to improve by ≥0.25**, no screenshot cropping and exactly three in-memory synthetic responses. Every non-fixture URL is denied.
- Existing Linux Chrome F1/F2/F4/F5/P2, Windows 22/24 Node and their owner-style offline Chrome acceptance remain required.

## Limitations

This **does not implement** arbitrary Chart.js/D3/Recharts/ECharts, axis labels, chart data extraction, tooltips, SVG/canvas chart reconstruction, API data recovery, responsive fidelity or user interaction parity. It reproduces only geometrically observed small CSS-colored shapes at a single captured viewport. A real authorized target would require separate live-permission and functionality tests.

## CI evidence

**Verified PASS**: functional SHA `e64151d6cab8db07dcc6cfc2d831969a00086554`, [GitHub Actions run 39016306602](https://github.com/hibi89/web-rea-studio/actions/runs/39016306602). All three mandatory jobs SUCCESS. Linux Node 22, Windows Node 22 and Windows Node 24 each **229/229 Node tests PASS**, no failures. Both Windows jobs additionally completed established local launcher, real Chrome P4/F5 and owner-style offline acceptance. The required Linux Chrome P4 compact chart differential output reports **six colored bar primitives**, full-canvas RGB MAE **4.43 legacy → 1.60 measured** (decrease **2.83 / 63.9%**) and exactly two independently generated replays, zero external requests, zero source JavaScript execution. Linux also passed the established P2/F2/F4/F5 and previous P4 Chrome regressions.

The source for this proof is **one controlled synthetic static six-bar chart**. It does not establish real-world chart behavior, original data, alternative chart libraries, mobile responsiveness or API recoverability. The owner was not asked to test their own local PC, which remains a separate final acceptance gate. Early incomplete intermediate commits are not used to infer final CI success.
