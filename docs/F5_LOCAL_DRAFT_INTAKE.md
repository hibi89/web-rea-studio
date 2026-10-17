# F5 — Independent static draft intake (2026-10-17)

## Scope and security

This step adds one explicit user-provided static draft to a completed Static Visual run. It does NOT accept arbitrary raw HTML for execution. Unsupported HTML could execute scripts, load external resources or access unapproved APIs.

Accepted: (A) P4 geometry JSON edited by the user, for which the server generates scriptless standalone HTML; or (B) P4 geometry with an HTML string that exactly matches the trusted P4 generator's result byte-for-byte. Any extra script, CSS URL, iframe, event handler or noncanonical HTML makes the request invalid.

## Local Studio workflow

1. Open a completed Static Visual run with P4 geometry and a reconstruction in the owner's local Studio.
2. Download **도형 JSON 초안 내려받기**. It contains sanitized source geometry. Inspect any title text for sensitive information before sharing.
3. Edit only the JSON geometry fields (e.g. coordinates or widths) as an independent static P4 draft.
4. Choose the edited JSON file and explicitly press **선택한 독립 초안 로컬에 저장**. An advanced API client may optionally attach the exact matching scriptless HTML to the geometry.
5. GET returns a compact receipt, and the HTML can be downloaded only as a sandboxed, no-script attachment. Import does NOT open Chrome, fetch the original target or attempt a repair.

## Validation and guarantees

- Only a completed static-visual run with a reconstruction report and matching saved P4 inspection is eligible. The POST never changes original target/allowed host.
- Same-origin POST, explicit confirmation, fixed envelope, at most 320KB total and 250KB canonical HTML. UTF-8 is reassembled as bytes. Frame size must equal the original observed viewport/document. A strict P4 sanitizer caps complexity to 80 regions and 24 titles.
- User-supplied HTML is NEVER executed. If present, it must exactly equal trusted regenerated scriptless HTML. With geometry-only input, the server generates the HTML instead.
- Files stored locally in the owner's run: independent-draft.html, independent-draft-geometry.json, independent-draft-receipt.json. The receipt is written last as a completion marker. Write-once mode and owner-private permissions, no original report, screenshot, reconstruction or inspection overwritten.
- One submission per analysis. GET never triggers capture. The receipt records SHA-256 and generic counts, not raw HTML, title text or user input. Stored status is **STORED_UNVERIFIED**, with browser_replay_executed:false, source_draft_alignment_verified:false and product_ready:false.
- HTML response is an attachment protected by script-src 'none', connect-src 'none' and sandbox CSP.
- If a disk crash leaves partial files before the receipt, upload cannot overwrite them. Manual local recovery is required; it never silently replaces evidence.

## Regression and Chrome proof

- tests/p5-independent-draft.test.mjs checks envelope validation, script/onload/remote-style rejection, viewport constraints, original evidence preserved, explicit same-origin API contract, duplicate prevention, read-only receipt and attachment security.
- tests/studio.test.mjs verifies download, file selection, explicit storage action and UI controls.
- tests/p5-independent-draft-chrome-e2e.mjs uses the saved canonical HTML with actual isolated Chrome and memory-only synthetic HTTPS source. It checks the user-provided geometry appears in a generated div, scriptless CSP is respected and original/external requests remain 0.
- Chrome fixture is synthetic, not the owner's actual Windows installation or a successfully recreated external site.

## Next quality gate

The saved artifact's geometry comes from user-provided JSON, not an independent Chrome observation. The later F5 matching step must independently render the saved HTML under a fixed synthetic document URL, collect its P4 geometry and PNG, compare it to source, and require the existing canonical replay preflight before any bounded repair. This needs a separate explicit opt-in action and stored evidence. Arbitrary HTML, original JS/backend, unknown API origins, dynamic behavior and real-site parity remain unsupported. Windows real-site API authorization and Failed to fetch are still unresolved.
