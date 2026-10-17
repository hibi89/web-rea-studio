# P4 measured heading typography — backwards-compatible visual fidelity

2026-10-17. This work is restricted to the **already existing H1/H2/H3 read-only static geometry probe**. No added external origin, browser click, API, credential, or non-heading content collection.

## Problem

P4's independent HTML already preserves heading text, color, font size, weight and rectangle, but forces `white-space:nowrap;line-height:1.45` and left/start alignment. Real observed headings can wrap and use different line spacing or center/right alignment, so the generated page can be measurably less similar despite correct rectangle geometry.

## Alternatives and decision

| Approach | Benefit | Regression risk |
| --- | --- | --- |
| A. Change generated CSS defaults for every saved draft | Very small patch | Could silently alter already-stored legacy reconstruction and independent draft integrity |
| **B. Optional measured heading properties** | Recreates what Chrome actually saw, leaves legacy snapshots and generated HTML behavior untouched | Requires extra strict-value sanitation and Chrome differential test |

Selected B.

## Implementation

- The existing passive P4 Chrome probe adds computed **`white_space`, `line_height`, `text_align`** only for already-observed H1/H2/H3 heading nodes. It never reads input values, hidden DOM text, page storage, JavaScript handlers or HTTP responses.
- The sanitizer permits `white_space`: `normal`, `nowrap`, `pre-line`; `text_align`: `start`, `end`, `left`, `right`, `center`; `line_height`: bounded pixel values, modest numeric unitless values or `normal`. Invalid/unsafe CSS strings including `url(...)` and injection fragments are discarded, not echoed.
- The independent scriptless HTML now adds **inline overrides only when the measurement exists**. For legacy stored geometry without these optional keys, `generateP4Reconstruction` retains the original CSS defaults and per-heading HTML (important for stored independent draft SHA verification).
- No new text classes (paragraphs, input labels, personal content), remote fonts or external resources are added. CSP still disables script, external fetch and forms.

## Proof plan

- Node regressions: bounded safe CSS, injection rejection, observed H1/H2/H3 collection, legacy output compatibility, no network/action/storage use.
- Mandatory real Linux Chrome regression `tests/p4-heading-typography-chrome-e2e.mjs`: render a **synthetic scriptless multi-line heading**, independently generate/render both legacy typography and new measured typography, compare the same complete original screenshot with P5's full-canvas RGB metric. Acceptance requires strictly lower MAE with measured typography; all three pages must be in-memory Chrome targets, **zero real external network requests**, and script execution disabled.
- Existing Linux P4/F2/F4/F5 and Windows Node22/24 smoke tests remain mandatory.

## Limits

This is only a **heading-layout fidelity** improvement within static visual reconstruction. No claim is made for arbitrary document text, privacy-safe text extraction beyond the existing heading policy, remote fonts, multi-viewport responsive fidelity, interactive functionality, original API or backend parity. The Chrome demonstration is synthetic; final authorized real-site tests require separate permission and evidence.

## Verification status

Awaiting completed GitHub Actions result for final functional SHA. Do not cite earlier CI on different SHA as proof for this feature.
