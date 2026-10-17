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

## Verified GitHub CI (2026-10-17)

Final functional SHA `f86d6a25b810427c1ddee8f79e3629f366de0d20`, [GitHub Actions run 39014676976](https://github.com/hibi89/web-rea-studio/actions/runs/39014676976): **all three required jobs SUCCESS** (Linux Node22 + Windows Node22 + Windows Node24); each Node regression suite **220/220 passed, 0 failed**. Linux additionally ran all established P4/F5/F2/P2-CORS/F4 real Chrome checks; both Windows jobs passed existing launcher, isolated Studio, Chrome P4/F5 and owner-style one-command acceptance.

The mandatory real Chrome synthetic typography fixture rendered one static original + the old heading layout + the independently generated measured heading layout, with **three in-memory synthetic HTML responses, zero external network requests, scripts disabled**. Heading rectangle height was **148 px** (wrapped text). Full-canvas RGB MAE for the old reconstruction **2.73**, measured reconstruction **1.61**, improvement **1.12 (approximately 41.0%)**. Both independent replay captures ran through the same Chrome screenshot comparator (no masking, stride 4). These metrics belong **only to this one synthetic typography fixture**, not a real source site's overall visual quality.

Early commits failed CI: one literal newline was accidentally inserted inside an escaped JavaScript probe string, fixed in `538ee318`; a test asserted globally that HTML did not include `position:fixed` even though the legitimate informational notice uses it, corrected by scoping the injection assertion to the generated title element in `f86d6a25`. The final **separate code SHA** passed. No code path or input-data exposure expansion was required.

Legacy drafts remain byte-compatible when the optional fields are absent; this particular compatibility is covered by deterministic Node unit tests, not retroactive user-PC checks. The new feature has not yet been independently exercised on the owner's current Windows checkout.
