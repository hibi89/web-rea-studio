# F1 → F5 controlled synthetic evidence-chain audit (2026-10-17)

## Objective

Connect existing F1/F2 bounded observed synthetic state changes, F3 evidence manifest, F4 independently generated branching app, and the **saved F5 Chrome replay claim** by checking that all retained artifacts describe the same observed program. This is a **read-only consistency check**, not a replacement for real Chrome, new observation, or original API/data reconstruction.

## Alternatives

| Choice | Advantage | Tradeoff |
| --- | --- | --- |
| Add another CSS primitive | Quickly improves one synthetic screenshot | Does not close a product-level observation→app verification gap |
| **Validate persisted cross-stage chain (selected)** | Detects forged, missing, inconsistent HTML, graph, F3 spec and replay claims | Synthetic only; must separate stored proof from fresh behavioral replay |
| Resume autonomous real-site interactions | Could collect real behavioral evidence | Exact host/path/action permission not approved; prohibited |

## Implemented boundary

- Pure `studio/controlled-chain-audit.mjs` accepts a *completed* `fixture-generic-catalog` or `fixture-generic-analytics` record only. The saved controlled-action permission report and observed source must have the correct synthetic scope and no unapproved actions.
- Rebuilds F3 `buildEvidenceManifest(inspection,report)`, requiring exact JSON content match to the saved `manifest.json`.
- Reads the saved F2 `function-graph.json` with bounded nodes/edges, reconstructs synthetic observation states and transitions, and independently rederives the F1/F2 route graph with `buildObservedFeatureGraph`. Requires exact graph agreement and matching report/inspection counts and permission scope.
- Regenerates F4 `generic-prototype.html` from bounded synthetic state transition evidence and compares the **entire generated HTML byte-for-byte** with the locally stored HTML. Any modified runtime/JS, unknown branch, different action label or altered state blocks coherence.
- Recomputes the *expected structure* of the saved F5 replay verification counters/route references. **No Chrome run is performed by the audit.** `CONSISTENT_SAVED_CLAIM` is never presented as a newly verified replay; a successful current read-only check only corroborates the saved interstage record.
- `GET /api/runs/:id/controlled-chain-audit` reads existing local files only. It neither starts a job, mutates stored runs, accesses a source host, nor bypasses user authorization. Mode mismatch returns 404 and unfinished synthetic records return 409. A read-only label and JSON export appear in the F4 synthetic panel.
- Three result categories: `SYNTHETIC_SAVED_CHAIN_CONSISTENT`, `INCOMPLETE`, `EVIDENCE_CONFLICT`. Response contains only generic stage status, bounded counts and privacy flags, not source URL, HTML, secrets, raw action payloads, private input values or screenshot bytes. `real_site_verified`, `product_ready` and `replay_independently_reexecuted` remain false.

## Verification and limits

New `tests/controlled-chain-audit.test.mjs` covers valid catalog synthetic branching evidence, tampered F2 graph, F3 manifest, F4 generated HTML, F5 counters, missing files, wrong mode, missing permission. The test also deposits one synthetic completed run into an isolated local Studio, calls the new GET three times, checks no new browser executor invocation, no secret output, 404/409 and UI link. Existing Node/Windows/real isolated Chrome suites remain required; the pre-existing F4 Chrome test separately proves the synthetic catalog/analytics branching behavior is replayed.

**Important limitations:** The cross-stage audit reconstructs a logical witness using **saved evidence from the same run**, not a fresh independent acquisition of the original site. A simultaneous coordinated alteration of all stored evidence could escape detection without external authenticated provenance; this is **consistency, not tamper-proof attestation**. It is not applicable to `static-visual` (use its separate saved pipeline audit), `fixture-causal`, or any real remote site. It does not prove original application functions, backend/database parity, media assets, or production readiness. The earlier Q1 off-origin data fetch remains blocked until separately approved.

Final CI SHA, counts and outcomes to be appended after terminal CI, not guessed from previous runs.
