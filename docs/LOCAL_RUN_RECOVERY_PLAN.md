# Saved-run read-only recovery guidance

**Scope:** A failed or interrupted REA Studio analysis may retain partial output. This capability identifies saved artifacts and evidence conflicts before the user decides whether to submit a new authorized run. **It never executes a recovery, resumes the browser, opens the original website, copies session data or adds permissions.**

## Design options

- Automatically replay the last observed action / restart a queued run: faster apparent recovery but requires a durable, verified checkpoint, idempotency and permission gates not currently present. **Rejected for this step.**
- Read-only saved-evidence assessment with explicit manual next step: low runtime cost, no capture risk, transparent uncertainty, small maintenance surface. **Selected.**

## API

`GET /api/runs/:id/recovery-plan` is available only when the run status is `failed` or `interrupted`. It reads the current persisted run metadata, report, inspection and manifest, then responds with a no-store redacted JSON attachment. Completed/active runs return HTTP 409; missing runs return 404.

`evidence_status`: `SAVED_ARTIFACTS_PRESENT`, `PARTIAL_SAVED_EVIDENCE`, `NO_SAVED_EVIDENCE` or `EVIDENCE_CONFLICT`. A present saved file is **not** proof it represents a complete or truthful capture. Known mode mismatch and inconsistent verdict fail closed. Fields are allowlisted booleans/statuses rather than copied metadata, URL, errors or raw network observations.

Always: `auto_resume_allowed:false`, `checkpoint_verified:false`, `new_run_requires_explicit_post:true`, `prior_evidence_reusable_for_automatic_execution:false`, `original_site_parity_verified:false`. The Studio diagnostics panel shows the recovery assessment and download link only for failed/interrupted records, cleared when switching runs.

## Tests and limitations

Four pure-classifier cases passed in an isolated Linux Node.js 22.16.0 test run: redacted failed run, interrupted partial evidence, missing/conflicting evidence, and refusal of running/completed/unknown-mode records. A separate Studio HTTP integration regression ensures GET causes no executor calls, does not alter the metadata revision, refuses completed/missing runs, and offers the UI link. **The new integration test and whole repository npm test await GitHub Actions CI and have not been independently observed passing.**

No durable action-level checkpoints exist; do not call this automatic resumability. Do not initiate a new browser capture or expand target approval without the user's separate explicit action. Existing official GitHub Actions #234, 291/291 Linux22 and Windows22/24 each, predates this change.
