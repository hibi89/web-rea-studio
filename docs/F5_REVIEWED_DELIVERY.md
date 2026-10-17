# F5 reviewed output delivery — SHA-256 receipt and fail-closed export

Date: 2026-10-17. All checks are **read-only, offline, scoped to already saved local runs**. The feature creates no ZIP, cloud copy, remote deployment or new independent app; it adds a verified *download path* for already generated HTML plus a matching content-addressed JSON receipt.

## Problem and decision

Previously, the Studio offered raw generated HTML downloads and separate static/controlled evidence audits. Users had to manually decide whether an HTML file was actually consistent with the saved observed evidence, and had no cryptographic checksum to pair it with the verification result.

| Option | Result | Why |
| --- | --- | --- |
| Keep independent downloads without a receipt | No change | Download can be confused with verified parity |
| **Add a gated reviewed HTML download plus SHA receipt** | Safe, reproducible delivery boundary | Selected |
| Automatically publish or package entire captured site | Broader but risky | Requires new authorization/credentials/data controls; not approved |

## Contract

- `studio/reviewed-delivery.mjs`: pure deterministic function builds `rea-reviewed-offline-delivery-receipt`. Includes supported scope, eligible/blocked status and a **SHA-256 digest of the exact HTML bytes**, byte count and filename **only when eligible**. The digest is *not digitally signed*, not provenance attestation, and not proof that the original website is the source.
- Two new local GET endpoints on completed supported runs:
  - `/api/runs/:id/delivery-receipt` returns only safe JSON including explicit non-parity flags. A blocked run still gets a receipt naming the reason.
  - `/api/runs/:id/reviewed-export` returns HTML as an **attachment** only if the same read-only saved-evidence audit **passes its stricter gate**. Otherwise it returns 409 with no HTML bytes. Both use one local in-memory snapshot for the particular request and do not mutate previous files.
- **Static visual:** `auditSavedStaticPipeline` must report `OFFLINE_ARTIFACTS_VERIFIED` AND separate static visual gate `THRESHOLD_MET` AND canonical stored HTML ≤250 KB. Mere presence or a reported `PASS` flag does not qualify. The served HTML is scriptless and the response adds a strict no-script/no-network CSP.
- **Controlled synthetic branching:** `auditSavedControlledChain` must report `SYNTHETIC_SAVED_CHAIN_CONSISTENT` with `CONSISTENT_SAVED_CLAIM`, and stored HTML ≤50 KB. This is **synthetic-only**, not external app reconstruction, and does **not** rerun Chrome. The served HTML is the bounded original generated synthetic replay app; its CSP allows inline fixture logic but blocks network, frames and forms.
- Unsupported run modes return 404, unfinished supported modes 409. No new source domain, API call, Chrome run, external upload, saved-file overwrite or Vercel deployment. Pre-existing unreviewed HTML downloads remain unchanged; new reviewed path is separately labeled in Studio.
- Studio shows one global **F5 reviewed export panel** on completed `static-visual` and the two controlled synthetic types. JSON receipt is always available for those runs, reviewed HTML download is shown **only when `export_eligible=true`**. Its copy expressly says original data/backend/feature parity is not verified.

## Security and verifiability

The receipt does **not** contain source URL, hostname, screenshot pixels, recovered page HTML, sensitive content, form data, cookies, tokens or credentials. SHA-256 hash and byte length can be matched against the exact downloaded HTML. This is content integrity **between two downloaded artifacts from the same local service**. It does not certify the artifacts' origin, protect against malicious changes to *all* stored evidence, or mean they are ready to sell or deploy.

Tests cover deterministic hash, static gate pass/fail, controlled two-app scope, missing/malformed/oversized artifacts, tampered HTML, unchanged stored run status, supported/unsupported mode and incomplete run responses, content disposition and CSP, and exact downloaded bytes/receipt digest. Existing Linux real Chrome synthetic and Windows owner-style tests remain mandatory.

**Actual authorized third-party source-site feature parity is still unresolved**; no off-origin network approval is implied. Final verified functional SHA, test count and CI result are recorded only after the newest code run finishes, separate from any documentation-only commits.
