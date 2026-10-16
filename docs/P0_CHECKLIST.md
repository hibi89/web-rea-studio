# P0 acceptance checklist — 2026-10-16

| Check | Result |
|---|---|
| Upstream REA source & licensing reviewed | PASS |
| User Windows Node 24.21.0 and Chrome | PASS |
| Existing local API test suite | PASS |
| Owner Windows REA 6.5.0 process | EXIT 0, JSON Evidence saved |
| Evidence top-level JSON / ID | JSON parsed, content still unreviewed |
| Each browser step completed | PENDING enhanced verification |
| DOM, accessibility, URLs and behavioral changes | PENDING enhanced verification |
| API request/response and browser errors | PENDING enhanced verification |
| Browser cleanup and controlled target scope | PENDING enhanced verification |
| No secrets / sensitive data exposed | Review only on controlled fixture |
| GitHub commits / authorship | Check release commit after push |
| Production deployment | Out of P0 scope |

Run `npm test` and `powershell -NoProfile -File .\scripts\p0-rea-smoke.ps1 -Execute` after pulling. The script prints an evidence verdict with failure codes and keeps `results/rea-capture.json` local (ignored by Git). Passes on synthetic test records are not evidence of a real Chrome run.

## Windows evidence review 2026-10-16
- [x] Pinned REA actually ran; captured seven completed steps, zero dropped events.
- [x] Identified a fixture/test design defect: alphabetical order equaled descending score order.
- [x] Changed synthetic scores and added order-difference regression tests.
- [ ] Rerun REA on Windows and verify `verdict: PASS`.
- [ ] Confirm provenance and ensure evidence files remain local/private.
