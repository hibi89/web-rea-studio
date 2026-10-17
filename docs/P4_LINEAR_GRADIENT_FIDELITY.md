# P4 bounded two-color CSS linear-gradient fidelity

Date: 2026-10-17. Scope: **passive, scriptless static geometry only**. This is not a general CSS extractor or JavaScript-driven chart implementation.

## Gap and options

The existing P4 HTML generator draws solid backgrounds, headings, CSS chart rectangles and observed shadows. A panel with `background-image: linear-gradient(...)` and transparent solid `background-color` can therefore appear empty in the independent reconstruction.

| Option | Tradeoff |
| --- | --- |
| Ignore gradients | Safe and cheap, but visibly omits large painted areas |
| **Allow only bounded two-stop computed RGB linear-gradients (selected)** | Low overhead; no extra DOM text or network; narrower fidelity |
| Copy arbitrary `background-image`, full CSS, SVG or `url()` | Wider coverage but unapproved remote-resource, asset and style-injection exposure |

## Implementation

- `P4_GEOMETRY_PROBE` reads the **computed `backgroundImage` CSS string** for the *already observed and visible* large body/main/div/section/etc. rectangles (same 1,400 scanned nodes and 180 stored boxes). A gradient-painted region is included even when its computed solid color is transparent, if it otherwise satisfies existing geometry/visibility bounds.
- `sanitizeP4Geometry` accepts only a **single** `linear-gradient(angle, rgb(r,g,b) [0%], rgb(r,g,b) [100%])`. Angle is integer degrees 0–360; each integer RGB channel is 0–255; a short 175-character cap applies. Arbitrary stops, named colors, opacity, color functions, multi-layer gradients, `url()`, CSS custom variables, external image URLs and semicolon injections are all rejected. This deliberately prioritizes safety over coverage.
- Generated independent static HTML sets optional `background-image` only when the exact bounded value survived sanitation. Scripts stay denied under CSP; images, network, interaction and origins are unchanged.
- Older saved geometry that lacks `background_image` or has `none` produces **byte-identical P4 HTML**. Saved runs and existing independent draft integrity checks are not rewritten.

## Acceptance

- `tests/p4-linear-gradient.test.mjs`: positive exact RGB gradient; byte-exact backward compatibility; malicious/multilayer/unsupported gradients rejected; fabricated primitive gradients rejected; transparent-solid gradient-only regions captured without body text, input state or active network.
- `tests/p4-linear-gradient-chrome-e2e.mjs`: in-memory original synthetic gradient panel, old no-gradient generated HTML and newly measured generated HTML, all independently rendered by **real Chrome**. Strictly require **full-canvas RGB MAE improvement by more than 1.0**, original width/height agreement, three synthetic HTML responses, no source scripts and zero unexpected remote requests. No screenshots or private site content are committed.
- Required workflow remains Linux Node 22 + full isolated Chrome F1–F5 acceptance and Windows Node 22/24 regressions and owner-style P4/F5 Chrome acceptance.

## Limits

This does not support radial/conic gradients, layered backgrounds, arbitrary typography, remote images, SVG/canvas, complete chart components or authentication/API behavior. The gradient example is a *single 1440px controlled static fixture*. Any later real-site claim requires independent authorized source/feature testing. GitHub Actions Windows runners are not the user's physical Windows PC.

## Current verification

Awaiting complete latest functional commit CI result and measured Chrome before/after MAE. Record precise functional SHA and log evidence after terminal checks; do not project prior CI onto new code.
