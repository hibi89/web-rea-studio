# F4 independent replay: negative transition guard

Date: 2026-10-17. This is a **controlled synthetic-only verification** step. It does not grant any origin permissions, analyze additional sites, or claim remote API equivalence.

## Alternatives and choice

| Design | Performance/cost | Maintainability | Proof quality |
| --- | --- | --- | --- |
| Unit tests inspecting the generated JavaScript text | Very low | Simple but fragile when renderer changes | Cannot prove Chrome event behavior |
| **Independent negative-event Chrome replay (chosen)** | Small addition to already-mandatory isolated Chrome flow; no new browser session or external request | Reuses current F4 source/reconstruction state reader and per-route traversal | Measures state, completed-actions count and mock API count *after* a forbidden event |

## Verified contract and implementation

- Only on the already generated, independently rendered **synthetic F4** app, after each observed successful edge, inspect which `button[data-action]` nodes are disabled in the current reconstructed state.
- For each disabled action, use Chrome CDP to **temporarily clear the DOM `disabled` attribute**, dispatch a synthetic `MouseEvent('click')`, and restore `disabled` in a `finally` block. This directly tests the JavaScript transition guard rather than relying on the browser's native disabled-button event suppression. No page is reloaded and the source target is not operated.
- Compare the page's observed state fields, completed action counter, simulated API counter and intercepted in-memory endpoint request count before/after. All four must be exactly unchanged. Otherwise stop the regression with `F4G_UNOBSERVED_TRANSITION_CHANGED_STATE`.
- Fail closed on missing/invalid CDP proof and require at least one rejected action. The result records only `unobserved_transitions_rejected`, not DOM HTML, credentials, input values, URLs or private page data.
- Existing positive-path verification, origin restrictions, source-scenario fixture allowlist, `connect-src 'none'`, two-app test coverage and saved user artifacts remain unchanged.
- `tests/f4-generic-chrome-e2e.mjs` requires at least four negative checks per synthetic app (`catalog`, `analytics`), as well as all existing positive route/metric assertions.

## Boundary and acceptance

This proves only that the bounded generated replay resists the specific **unobserved state/action pairs** present in the two fixtures. It does **not** prove complete negative coverage, arbitrary user inputs, third-party site functional cloning, live API/CORS, authentication, or browser JavaScript security in real targets. Extra Chrome synthetic requests remain forbidden.

The test runs on Linux Chrome via the existing required GitHub Actions suite. Windows jobs exercise their existing Node/P4/F5 acceptance, but not the dedicated F4 Chrome end-to-end script. Any CI failure must be repaired and rechecked; do not count pending runs as success.

Next: after independent Chrome CI succeeds, continue evidence-linked F1/F2/F3→F4 reconstruction. Actual source-site/API authorization and live behavioral parity remain separate gates.

## Verified GitHub Chrome evidence (2026-10-17)

Functional code SHA `da27ef615d87f55a92f985c27cc2aa86d49d46e5`, [GitHub Actions run 39013744143](https://github.com/hibi89/web-rea-studio/actions/runs/39013744143) **completed SUCCESS** for Linux Node 22, Windows Node 22 and Windows Node 24. Each Node environment: **216/216 PASS, 0 FAIL**; both Windows jobs also ran the owner-style offline acceptance steps successfully.

Required **real Linux Chrome** F4 replay logs independently confirm `catalog`: 3 positive observed transitions, **5 denied unobserved transition probes**, 1 simulated API count, **0 real API requests**; `analytics`: 3 positive transitions, **5 denied probes**, 1 simulated API count, **0 real API requests**. A probe temporarily removed the button's disabled flag and emitted a synthetic event to validate the JavaScript handler guard itself.

Historical nuance: an earlier intermediate code run [39013618409](https://github.com/hibi89/web-rea-studio/actions/runs/39013618409) had a Windows Node 22 **owner-style acceptance P4 smoke failure**, though its separate preceding P4 test passed and Windows Node 24/Linux jobs passed. That single failure's root cause was not proven. The final distinct functional SHA's Windows Node22 **and** Node24 jobs passed; do not attribute the earlier smoke failure to the F4 code or claim a proven environmental repair.
