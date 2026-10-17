# P4 measured card shadows — bounded offline geometry fidelity

Date: 2026-10-17. This is a **static-only, scriptless** enhancement on the existing authorized P4 geometry probe. It does not retrieve private page text, network responses, SVG/image sources, icon files, or third-party APIs.

## Why shadows before paragraphs, icons or charts?

A broad body-text extraction could capture private content and input-adjacent data. Raw SVG, icons or remote image copies introduce active content and fetch/privacy risks. The safer next meaningful visual step is to preserve already rendered panel/card **box-shadow** computed styles, which can significantly affect full-canvas screenshots with no new text or origin access.

| Option | Cost / performance | Accuracy | Scope risk |
| --- | --- | --- | --- |
| Ignore card shadow (prior behavior) | No overhead | Flat-looking panel edges | None |
| **Single verified simple shadow (selected)** | One computed style property on existing bounded candidate set | Preserves meaningful card/panel depth | Low: strict numeric/palette sanitizer |
| Capture arbitrary computed CSS or DOM/SVG | More complex | Potentially more complete | High: inherited hidden data, CSS `url()`, remote requests, scriptable SVG |

## Contract

- The existing `P4_GEOMETRY_PROBE` reads `getComputedStyle(node).boxShadow` only for the **existing bounded body/div/main/aside/section/article/header/footer geometry set**; it also includes a visible shadow-only `div` candidate if the shadow makes it a distinct painted region. The same width/height, visibility, first-N cap and document bounds apply.
- The sanitizer accepts a **single layer**, non-inset, computed solid RGB/RGBA or hex color, four pixel-length offsets (x/y ≤64px magnitude, blur 0–80px, spread ≤32px magnitude) and a short total length. Invalid colors, oversized or multiple/inset shadows, `var()`, `calc()`, `url()` and CSS declaration separators are dropped entirely.
- The generated **independent static HTML** emits an optional `box-shadow` style only when evidence is present and valid. Existing saved geometry without `box_shadow`, or with `none`, produces unchanged legacy HTML byte-for-byte (important for immutable, SHA-validated independent drafts).
- A real isolated Chrome test renders 1 synthetic card with shadow, independently generates/replays the old no-shadow layout and new evidence-backed layout. Full-canvas P5 RGB MAE must strictly improve while the whole replay remains scriptless, in-memory, and without original or external network requests.
- CSP, GET/POST policies, real-site blocked external fetch, F1–F5 behavior claim, user local storage and Vercel are unchanged.

## Acceptance and boundaries

New Node unit suite `tests/p4-card-shadow.test.mjs` covers safe shadow, explicit legacy default preservation, malformed/injected CSS rejection, and shadow-only bounded div discovery without input values. New Linux real Chrome mandatory step is `tests/p4-card-shadow-chrome-e2e.mjs`. Existing Linux/Windows Node and Chrome/owner-style acceptance remain mandatory.

**This is only card shadow visual fidelity on an offline controlled fixture.** It is not general icons, paragraphs, charts, source JavaScript, live API functionality, responsive behavior or authorization for a new domain. Before claiming finished, cite exact updated functional SHA, full GitHub Actions run and both the baseline/after RGB MAE from real Chrome; if the test fails, report the failure and stop instead of claiming improvement.
