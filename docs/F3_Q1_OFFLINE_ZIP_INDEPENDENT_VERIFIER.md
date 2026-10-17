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

`npm test` automatically picks up `tests/f3-q1-offline-verifier.test.mjs`: 7 cases for valid transfer and CLI, modified content with CRC mismatch, CRC-valid content with old SHA, altered acceptance, injected properties/active HTML, ZIP central/local conflicts and forged extra entries, checksum mismatch and ZIP comments. All new tests **await CI verification**. The generated HTML may be valid but is still only an anonymized, noninteractive offline layout sample. It is neither a website clone nor proof of backend, authenticated site behavior, provenance, real responsive parity or permission. No deployment or permission expansion in this step.

Next: secure the exact new SHA's GitHub Actions job conclusions and test counts, fix only verified failures, and then check one actual Studio-produced ZIP against the CLI without opening the original website. Do not silently treat previous SHA's passing CI as acceptance for this code.
