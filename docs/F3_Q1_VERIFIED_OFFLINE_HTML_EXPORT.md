# F3/Q1 — Verified-Only Anonymous Offline HTML Download

Date 2026-10-17 KST. Verified feature SHA `491275b4c3d9705db7b9db1c119a2a61ea247e17`. Final GitHub Actions [39036995736](https://github.com/hibi89/web-rea-studio/actions/runs/39036995736) **first attempt required 3/3 jobs SUCCESS**: Linux Node22 **280/280 PASS**, Windows Node22 **280/280 PASS**, Windows Node24 mandatory offline Chrome/owner-style job SUCCESS.

## Goal and non-goals

Previous units created only a **coarse synthetic anonymized 3×3 HTML sheet** and issued a separately initiated, stored two-viewport Chrome receipt (`VERIFIED_SYNTHETIC_LAYOUT_ONLY`). The legacy general preview download was deliberately available without Chrome acceptance. This unit introduces a **different export URL** gated on the existing saved acceptance. It does **not** certify the original site, backend, real data, JS behaviors, API/CORS readiness, visual/mobile parity, security permission or production readiness; nor does it deploy or bill anything.

## Implementation contract

- New read-only `GET /api/runs/:id/f3-q1-verified-offline-export`. Must be a stored **failed/interrupted dynamic-passive** run with saved inspection. Unsupported modes: 404; incompatible run status: 409; missing inspection or acceptance: 404. These errors respond JSON **without any HTML**.
- `readAcceptanceReceipt({store,id,mode,inspection,report,diagnosis})` checks the previous **explicit, persisted 1440×900 and 390×844 Chrome success** against the current evidence SHA-256 and regenerated HTML SHA-256; missing, malformed, stale, or forged stored results do not automatically unlock the export. If a stored receipt disagrees: HTTP 409.
- Before returning HTML, independently recompute SHA-256 of the **actual HTML bytes to be sent** and confirm both the accepted receipt's HTML hash and the regenerated preview's own receipt hash, and compare its `Buffer.byteLength` to the regenerated receipt length. A mismatch => 409 JSON, not partial bytes.
- Successful GET returns **identical bytes** to `buildAnonymousGeometryPreview`'s synthetic HTML, but as a separate download `rea-verified-synthetic-offline-only.html`. Headers include `Content-Disposition: attachment`, `Content-Security-Policy` with `sandbox`, `script-src 'none'`, `connect-src 'none'`, `form-action 'none'`, `navigate-to 'none'`, `X-Content-Type-Options:nosniff`, `X-REA-Verification-Scope: synthetic-offline-only` and `X-REA-HTML-SHA256`.
- Studio failure diagnostics has a **separate** HTML download link. It is visible only when the existing read-only acceptance GET validates a positive receipt, hidden otherwise and cleared on run switches. Each actual download independently rechecks current evidence: a stale visible link cannot override the server gate.
- **No GET creates files, initiates Chrome, contacts original external websites, performs automated click/form/action, grants access, modifies stored source evidence, or runs acceptance again.** The original unverified HTML preview paths remain unchanged.

## Verification evidence

Added `tests/f3-q1-verified-export.test.mjs` with 3 Node/HTTP tests:
1. Missing receipt denies HTML with 404; wrong completed run status 409; unsupported synthetic mode 404; missing passive inspection 404; no browser launches.
2. Explicit same-origin acceptance POST, then verified GET outputs exactly the regenerated anon HTML bytes, identical digest and byte count; checks CSP, download filename, scope header and absence of private input, hostnames and active controls. Four repeated verified GETs trigger no new Chrome replay or source capture.
3. Tampered saved Chrome receipt's mobile column immediately returns 409 JSON; old unreviewed preview remains separate. After restoring receipt, changing stored report invalidates evidence hash and keeps verified download blocked. The positive receipt cannot be used to authorize different content.

**First code SHA** `0ecaaf67fd2f9d3f6178317d0fe41d25a7110ca6` produced Node 279/280 because test 3 prepared its saved acceptance directly with a standalone synthetic `diagnosis` value instead of the current Studio-computed saved-run diagnosis, and the gate properly denied it with 409. This was a **test-provenance error**, not a source site API or Chrome failure. The test was changed to invoke the same explicit POST the UI uses; **no security gate or approval scope was loosened**. Final feature SHA `491275b4c3d9705db7b9db1c119a2a61ea247e17` CI [39036995736](https://github.com/hibi89/web-rea-studio/actions/runs/39036995736) passed Linux/Windows Node22 **280/280** each, Windows Node24 mandatory job SUCCESS, and original isolated synthetic Chrome acceptance E2E. No physical user Windows latest commit run was performed.

## Next

Consider a self-contained **offline pair/bundle** of the accepted HTML and matching acceptance JSON receipt, with a bounded file list and exact digest validation; no source data/secret/hostnames. Failure, absent acceptance or changed evidence must not create a bundle. This is packaging of **synthetic offline material only** and should not be described as a live website replica, data/backend/API restoration, deployment or commercial readiness.
