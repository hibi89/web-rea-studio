# F3/Q1 — Verified Anonymous Synthetic HTML + Receipt (Two-File Offline ZIP)

Date: 2026-10-17 KST. Feature SHA `7e9ac0c3ad1528fc4d137a2e095ede11589cf8f2`. Final [GitHub Actions 39039484264](https://github.com/hibi89/web-rea-studio/actions/runs/39039484264): first attempt required jobs **3/3 SUCCESS**, Linux Node22 **284/284**, Windows Node22 **284/284**, Windows Node24 required Chrome/owner-style **SUCCESS**.

## Why ZIP and what it means

The previous work provided two separately downloadable components: a noninteractive anonymous 3×3 HTML view and a saved 2-viewport Chrome acceptance receipt. Transferring them independently can result in selecting unrelated files. New endpoint `GET /api/runs/:id/f3-q1-offline-bundle` requires acceptance of **one exact saved failed/interrupted dynamic-passive run** and returns those two files together. It must not cause Chrome replays, original source requests, grants, deployment, or payment. Scope is synthetic offline generated HTML; the original website's UI, backend, API, data, interactions, CSS or responsive layout **are not certified**.

## Security / evidence contract

The request first validates the stored Chrome acceptance via `readAcceptanceReceipt`, checking both defined viewports (**1440×900**, **390×844**), observed synthesized computed columns (**3**, **1**), 9 anonymous zones, no horizontal overflow, and current saved evidence and generated HTML SHA-256. The new ZIP builder independently checks the exact bytes of the regenerated HTML, its byte count, stored acceptance fields and evidence SHA. **No raw source input/URL/hostname is placed into the ZIP.**

The response carries precisely two fixed, flat, ASCII paths in order:
1. `rea-verified-synthetic-offline-only.html` — exact generated anonymous HTML bytes, no native interactive controls/forms/scripts, no external resources.
2. `rea-two-viewport-acceptance.json` — a **canonical subset** of the previously accepted receipt's validated fields: exact HTML/evidence SHA-256, only allowed 2-view measurement fields, denied permission state and explicit original-site parity=false. Malicious or extraneous stored JSON properties are not copied.

Implementation in `studio/f3-q1-offline-bundle.mjs` is pure and deterministic: ZIP32 with method 0 **STORE**, CRC32, fixed DOS date **1980-01-01**, no extra fields, no arbitrary paths, compression, symlinks, file system writes, or third entry, max 256KiB per file. No live network or browser used. HTTP sets `application/zip`, attachment filename `rea-verified-synthetic-offline-only.zip`, `X-REA-Bundle-SHA256`, `X-REA-HTML-SHA256`, `X-REA-Verification-Scope: synthetic-offline-only`, `Cache-Control:no-store`, `nosniff`.

Before explicit offline Chrome acceptance the bundle returns 404 JSON; unsupported mode/missing inspection is 404; wrong run status, tampered receipt, mismatched HTML/evidence hashes and rejected geometry return 409 JSON **without ZIP**. Existing general/verified single HTML downloads remain separate. Studio reveals the ZIP link after successful receipt GET and clears it on run change; the server always revalidates on download, so stale browser links cannot bypass the decision.

**Limit:** ZIP checksum and pair of SHA hashes provide content-consistency checking against the saved local receipt, **not independent authenticity of its source, evidence provenance, website functionality, mobile site behavior, or user permission**. Receipt is unsigned and can be forged if all stored files are under attacker control.

## Tests / CI

New `tests/f3-q1-offline-bundle.test.mjs` adds four tests:
- Validate deterministic ZIP names/count/local+central headers, order and 2 safe entries; reject path injection, extra entries and oversized content.
- Refuse ZIP for unaccepted, unrelated synthetic, completed, or non-evidence runs. No unintended Chrome recapture.
- Explicitly POST a saved synthetic 2-view Chrome acceptance, download the ZIP, independently parse exactly two entry bytes and central-directory structure, compare HTML SHA to JSON acceptance, verify bundle SHA header and repeat three read-only GETs while Chrome invocation count stays at 2 and source capture count stays 0.
- Alter stored acceptance/mobile column and saved report after successful issue; ZIP becomes 409 JSON while general anonymous preview is unaffected.

The first feature SHA `6fcef43b1b85a52fe8529544ba871d17a0e8b20b` failed 1 of 284 because a test filename regex used an extra backslash. **The actual ZIP response correctly returned the `.zip` filename.** Fixing only that test yielded final feature SHA `7e9ac0c3ad1528fc4d137a2e095ede11589cf8f2`: Linux/Windows Node22 **284/284 PASS**, Windows24 required job SUCCESS, [CI 39039484264](https://github.com/hibi89/web-rea-studio/actions/runs/39039484264) first attempt **3/3 SUCCESS**. Existing isolated real Linux Chrome two-viewport acceptance, P2/P4/F4/F5 regressions, and Windows Chrome/owner-style CI checks also passed. No latest user physical Windows local run was performed.

## Next bounded step

Develop a **separate offline ZIP inspection CLI**, usable on Windows without source-site contact or Chrome, which parses exact ZIP file entries/central-directory/CRC32, rejects any extra files/path traversal/compression or data descriptors and verifies HTML SHA against canonical acceptance JSON and known synthetic-only limits. Explicitly state that checking a self-contained unsigned ZIP cannot prove original provenance or unmodified source behavior. No outside deployment or permissions are implied.
