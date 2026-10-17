# F3/Q1 saved passive reconstruction readiness gate

Date 2026-10-17. Verified code SHA `532065ec3a349d3a7bf274e2e0e6744902b85d71`. Workflow [39029733634](https://github.com/hibi89/web-rea-studio/actions/runs/39029733634): first attempt **three mandatory jobs SUCCESS**, Linux Node22 **260/260 PASS**, Windows Node22 **260/260 PASS**, Windows Node24 required launcher/Chrome/owner-style acceptance SUCCESS.

## Objective and security boundary

F3 already describes the functional/data evidence missing from saved passive inspection; Q1 separately describes unresolved host authorization and the *possible* relationship between local policy and observed fetch rejection. Joining them should produce a useful **offline readiness gate**, not speculative reconstruction. The genuine external site's API schema, original source, backend, database, behavioral parity and even its data-ready browser render are still unverified.

Rejected option: promote matched request hostnames or a "local-policy-compatible" failure into permission, a working API contract, or a reconstructed live application. Selected: cross-check a single already-stored passive run's bounded counters, missing proof categories, Q1 permission state and Q1 conflict codes; **always block live network expansion and actual-site reconstruction** until a separate, specific authorization and evidence path exists.

## Implementation

- New pure `studio/f3-q1-readiness.mjs` computes existing `buildPassiveGapContract`, `buildPassiveSupportPacket`, `buildPassivePermissionPreflight` and `assessSavedQ1Failure` from one inspection/report/diagnosis, with no side effects.
- Checks capture-verdict consistency, saved same-origin/external event group counts and bounded fetch/fulfilled counts, Q1 provenance/count/host-pair conflicts, and all F3 causality/contract/permission flags remain unverified. Disagreements yield `CONFLICTING_SAVED_OBSERVATIONS` and prevent even UI-category-only planning.
- Returns fixed `decision: BLOCK_REAL_SITE_RECONSTRUCTION`, `network_decision: BLOCK_NETWORK_EXPANSION`, `permission_status: NOT_APPROVED`, missing authorization field identifiers, unresolved F3 gap identifiers and controlled next-evidence categories. A consistent visible-controls inventory permits only `OBSERVED_UI_CATEGORIES_ONLY` **offline structural planning**, never actions or data parity. It never creates a code-generation approval or policy.
- Local GET `/api/runs/:id/f3-q1-readiness` requires `dynamic-passive` and a stored `failed`/`interrupted` run, returns 404 for other modes or missing inspection, 409 for an incompatible status or stored inspection mode. Browser/network capture code not executed.
- Studio failure diagnosis panel has a new **F3/Q1 재구성 가능성 차단 판정 JSON** download link; switching runs hides the prior link. Output contains only approved fixed labels/numeric counts/booleans: no original hostname, path/query, input/control label, API body, cookies or credentials. Existing Q1 preflight JSON remains a separate local-only diagnostic that may contain sensitive hostnames.

## Verification

New `tests/f3-q1-readiness.test.mjs` (3 tests):
1. Coherent saved failed capture with a matched host attempt/rejection, observed UI controls, Q1 compatible local boundary, and sensitive raw data: blocked result, missing proof fields, privacy assertion and zero claimed external requests.
2. Contradictory fetch attempt/rejection counts and partial/legacy observations must yield conflict/partial and maintain `NOT_APPROVED`. Synthetic input modes cannot be promoted.
3. HTTP: a bounded local fake passive capture creates a failed run once; two repeated GETs return identical decisions without repeating source capture. Successful-run status gives 409, synthetic mode gives 404, missing inspection gives 404; Studio UI and script expose the corresponding link.

GitHub Actions `39029733634` first attempt: Linux/Windows Node22 **260/260 PASS**, Windows Node24 required full job **SUCCESS**, **3/3 SUCCESS**. Existing isolated synthetic Chrome P2/P4/F2/F4/F5 tests and Windows owner-style runner acceptance succeeded. This is **not a real website recreation test** and owner physical Windows current checkout was not invoked.

## Remaining work

1. Prioritize safely implementable UI structure evidence vs unresolved actions/data/API/database per feature, without pretending observed controls imply working behavior.
2. If the owner later chooses real backend reconstruction, obtain explicit origin/host/path/method, credentials policy, byte/time/rate budgets, and ownership/authorization **before** any live tests. DNS/SSRF/CORS/redirect safety stays fail-closed.
3. No new host calls, target recaptures, developer CLI outside local fixtures, user PC involvement, deployment or paid resource use in this work unit.
