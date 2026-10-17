# F3/Q1 Independent Offline ZIP Verifier

Date: 2026-10-17 KST. Feature commit `c944b2810f985ab14e5b72fbdc3f6c32a974cb70`. GitHub Actions latest result: **unconfirmed**; the GitHub connector does not list push-triggered runs for a commit. Source and test files were committed and re-read from main. Prior generator commit `7e9ac0c3` had three mandatory CI jobs succeed; those results do **not** prove this new verifier.

## Purpose and choice

Previous work exports exactly two bounded, synthetic-only artifacts. An external recipient needs to check that transfer did not change ZIP structure, HTML or acceptance data. Options were (A) run a generic unzip tool and manually inspect files (low coding cost but no complete allowlist/security checks), (B) build an independent strict ZIP32 STORE parser (selected; offline, small fixed format, robust rejection), or (C) reuse the ZIP writer as a parser (lower effort but correlated defects). Chosen B avoids depending on the implementation being checked.

## Run on Windows/Linux with Node 22+

```sh
node scripts/verify-offline-bundle.mjs ./rea-verified-synthetic-offline-only.zip
node scripts/verify-offline-bundle.mjs ./rea-verified-synthetic-offline-only.zip --expected-zip-sha256 <64-character-lowercase-digest>
```

The optional expected hash must be acquired separately, e.g. from the issuing Studio HTTP `X-REA-Bundle-SHA256` header that the user can trust. Without an independent trusted digest or signature, **a forged unsigned ZIP with internally consistent checksums can pass**. Output includes `VALID_SYNTHETIC_OFFLINE_BUNDLE`, hashes, file count and explicit `source_authenticity_verified:false`; invalid input returns nonzero and `REJECTED` with a bounded reason. No files are extracted, modified, or sent over a network. The CLI reads only the explicit local ZIP file argument.

## Strict checks

- Exact two files and order: `rea-verified-synthetic-offline-only.html`, `rea-two-viewport-acceptance.json`; no third file, traversal, alternate paths, duplicate entries, trailing bytes, comments, symlinks, ZIP64, encryption, compression or data descriptor.
- Entire archive ≤ 2×256KiB+4096 bytes; each entry nonempty and ≤256KiB; fixed ZIP32 STORE local/central headers and immutable DOS timestamp; contiguous entries and central directory offsets; independent CRC32 per entry.
- Strict UTF-8; generated anonymous HTML markers and absence of active HTML controls/scripts/external URLs; its SHA-256 must match canonical JSON receipt. JSON must match the known writer's allowlisted fixed keys and formatting with no extra/missing properties.
- Receipt requires two approved **synthetic** Chrome measurements: 1440×900 3 columns and 390×844 1 column, nine zones each, zero native controls, external requests or scripts, no horizontal overflow, valid screenshot sizes, `NOT_APPROVED` original permission, original-site and mobile parity flags false, unsigned status. The evidence hash is format-validated but cannot be independently rederived without the separately saved original evidence, which the bundle intentionally excludes.
- Optional out-of-band bundle SHA-256 check. No original site is fetched or compared.

## Tests and limitations

`npm test` automatically picks up `tests/f3-q1-offline-verifier.test.mjs`: 7 cases for valid transfer and CLI, modified content with CRC mismatch, CRC-valid content with old SHA, altered acceptance, injected properties/active HTML, ZIP central/local conflicts and forged extra entries, checksum mismatch and ZIP comments. The focused 7-case suite was executed in isolated Linux Node.js 22.16.0: 7 passed and 0 failed. Three local source files (verifier, test and ZIP writer) had Git blob SHAs matching their committed GitHub originals. The ZIP writer's separate acceptance dependency was an import-only stub and was not invoked by these seven tests. The full npm test suite, actual Studio HTTP ZIP transfer, Windows hardware and official GitHub Actions CI remain unverified. The generated HTML may be valid but is still only an anonymized, noninteractive offline layout sample. It is neither a website clone nor proof of backend, authenticated site behavior, provenance, real responsive parity or permission. No deployment or permission expansion in this step.

Next: secure the exact new SHA's GitHub Actions job conclusions and test counts, fix only verified failures, and then check one actual Studio-produced ZIP against the CLI without opening the original website. Do not silently treat previous SHA's passing CI as acceptance for this code.

## 2026-10-18 HTTP bridge check and Studio regression wiring

The isolated Linux Node.js 22.16.0 test suite ran **8/8 PASS**: the existing seven verifier cases plus one in-memory Node localhost HTTP test. The additional case built an actual fixed ZIP with `buildVerifiedOfflineBundle`, served the binary over HTTP, fetched it as bytes, compared `X-REA-Bundle-SHA256`, checked it with `verifyOfflineBundle` and independently ran the file-based CLI. The original acceptance import in that isolated fixture was replaced with a stub because the full project code was not available in the test container. **This is not a successful run of the real Studio HTTP route.** The eight-case standalone output is not GitHub Actions evidence.

To verify the real Studio transport when its test environment runs, commit `bb9310b95924890e5035143ae36ca2530fbf4ce2` adds `verifyOfflineBundle` to the existing `tests/f3-q1-offline-bundle.test.mjs` Studio server integration test. That test already POSTs a saved, anonymized two-viewport acceptance, requests the actual server `GET /api/runs/:id/f3-q1-offline-bundle` and reads the response into a buffer. It now checks the same returned bytes with the independent ZIP consumer, agrees with the HTTP hash header, and fails when arbitrary bytes are appended. This committed additional assertion has **not been observed running in official GitHub CI**. The connected GitHub action only exposes PR-triggered workflow run associations and cannot confirm a push run. Do not treat Vercel status contexts, historical CI checks or source code inspection as this new test's execution.

The user has not been asked to run Windows commands at this stage. No live source was revisited; no new deployment, permission or credential change was requested or performed.
