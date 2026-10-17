# F3/Q1 Anonymous Noninteractive Wireframe — Saved Passive Evidence Only

Date: 2026-10-17 (KST). Functional SHA `6eb0a923780c9ea3e873fea0f305ef596f25f57a`. [GitHub Actions 39031300211](https://github.com/hibi89/web-rea-studio/actions/runs/39031300211) **first attempt 3/3 required jobs SUCCESS**. Linux Node22 **266/266 PASS**, Windows Node22 **266/266 PASS**, Windows Node24 mandatory job SUCCESS.

## Why this output is deliberately limited

Prior F3/Q1 gates distinguish anonymous, observed control categories/counts from unverified behavior, original CSS/layout, API/data fields, server/database and permission. This feature adds an *actual* HTML artifact for the **former only**. It must not be described as a replica of any external website. Alternative rejected: replay a source DOM/UI with native enabled controls, labels or network calls based on passive signals — that would invent interactions and could disclose private material. Selected: a fixed generic, noninteractive HTML/CSS placeholder sheet; category + bounded count is the entire dynamic surface.

## Implementation and routes

- New `studio/f3-q1-wireframe.mjs`: recomputes `planF3Q1Work` from the same stored passive evidence. Requires `UI_PRESENCE_PLANNING_ONLY` + `OUTLINE_NONINTERACTIVE_UI_CATEGORIES_ONLY`, validates allowed category/status/count (each 1–100, total max 100, 8 categories), and renders only fixed English category text + integers with static HTML/CSS. Displays max 12 anonymous placeholder shapes per category; never imports source coordinates or labels.
- Literal DOM uses `div`, `span`, `section`, headings, text; no `button`, `input`, `select`, `textarea`, `form`, `a href`, `script`, `img`, `iframe`, external font or URL. Placeholders are not interactive, and all dynamic IDs/labels/strings are from strict literal allowlists.
- New `GET /api/runs/:id/f3-q1-wireframe` serves inline HTML with `Content-Security-Policy: default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; navigate-to 'none'; sandbox`; `...-download` serves identical HTML as attachment; `...-receipt` returns deterministic `sha256`, byte count, categories/counts, limitations. The HTML also embeds a restrictive CSP meta tag.
- All three GET endpoints require a saved failed/interrupted `dynamic-passive` run. Missing inspection => 404; mismatched mode 409; incompatible run state 409; unsupported modes 404. Missing/contradicting evidence => 409 with a non-HTML blocked receipt. **No GET performs new Chrome capture, network fetch, modification or source replay**.
- Studio failed-passive diagnostics expose preview/download/receipt links after receipt eligibility check. Switching runs clears prior links; never bypasses API gate.

## Verified evidence

Node/HTTP suite `tests/f3-q1-wireframe.test.mjs` added three tests: determinism and receipt SHA; malicious raw source values never appear, no active DOM tags or URLs, strict CSP; conflicting or absent passive observation returns `BLOCKED` without HTML; HTTP repeat-get, equal inline/download bodies, receipt match, no capture, state/mode denies.

Linux required **real isolated Chrome** suite `tests/f3-q1-wireframe-chrome-e2e.mjs`: generated a synthetic anonymous document from fake approved saved passive evidence; `runDynamicAnalysis` served exactly one in-memory HTML response to a synthetic HTTPS fixture and blocked other resources. Chrome verified the rendered screenshot **1440×900**, **0 native interactive controls**, **0 external requests**, **scripts not executed**; HTML SHA-256 `0a2d10b40f24f4089b0aaef10f6c959d39570efd36e3f6335670ccc2b1f375db`. All existing isolated synthetic planner/catalog/analytics F4 and prior P4/F5 real Chrome checks passed. Windows Node22 **266/266** and Node24 full mandatory acceptance job succeeded. The hash belongs to the fixed synthetic fixture output, **not** the user's original website.

No original site was contacted or approved for new actions. No original site appearance, data, backend, database, API readiness or behavior equivalence was established. The user's latest physical Windows workstation was not used for these CI results.

## Next bounded implementation

If the saved, permitted passive evidence contains reliable **redacted geometry/viewport**, carefully improve only the anonymous placeholder layout based on measurable structure. Reject absent or conflicted geometric evidence; never translate source labels, URLs, active controls or scripts. Require isolated Chrome desktop/mobile viewport gates and no external requests. Do not duplicate existing P4 static reconstruction code or infer source functionality.
