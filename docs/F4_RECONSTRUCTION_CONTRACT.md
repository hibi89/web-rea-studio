# F4 bounded F1/F2 → F3 → F4 reconstruction contract

Date 2026-10-17. Verified functional source `3e4d7ea6ee88002d94bd01f5a413a155328dc4ad` and [Actions 39024305628](https://github.com/hibi89/web-rea-studio/actions/runs/39024305628).

## Design comparison
| Option | Benefit | Cost and limitation |
| --- | --- | --- |
| Add another P4 CSS fidelity feature | Quick, narrow improvement | Does not close the functional reconstruction gap |
| **Bind observed state graph, F3 evidence and F4 standalone app** | A reusable executable data/behavior contract | Offline, limited to existing controlled fixtures — **selected** |
| Fetch or replay new remote site APIs automatically | More real-world data | External permissions and security scope not approved |

## Implemented
- `compileObservedStateContract` normalizes bounded controlled Chrome evidence, verifies a previously independently replayed state graph and canonical HTML, and emits safe observed fields, actions, transitions, simulated API counters and SHA-256 digests.
- `compileF3LinkedReconstructionContract` checks that F3 synthetic manifest metrics, permission scope and provenance match the observed/replayed controlled fixture. Only existing catalog/analytics Studio modes may persist this F3-linked contract.
- New `reconstruction-contract.json` and read-only `GET /api/runs/:id/reconstruction-contract` verify persisted graph, F3 manifest and HTML checksum consistency. Conflicts return 409; unsupported or absent contracts return 404. This GET does not launch a browser.
- An unseen `planner` synthetic state schema is exercised through the shared normalizer/HTML generator at the Node test level, but no new permission-gated Studio fixture or separate source Chrome observation has been authorized.
- Output explicitly records unknown unobserved effects, no recovered original API/data/database, no real network calls, and `product_ready:false`. Digests are unsigned and are not site/source authenticity proofs.
- Original source, old local results, existing HTML generator output and Vercel settings are untouched.

## Verification
- `tests/reconstruction-contract.test.mjs`: new schema, F3 association, negative provenance, mutated HTML/graph/manifest/replay and stored digest mismatch cases.
- `tests/generic-studio.test.mjs`: actual local Studio POST with injected controlled evidence → new JSON GET, modify saved graph → 409, restore → 200.
- `tests/f4-generic-chrome-e2e.mjs`: both existing isolated real Chrome fixtures produce a checked F4 contract, including denied transitions and zero live API requests.
- [Actions 39024305628](https://github.com/hibi89/web-rea-studio/actions/runs/39024305628): Linux Node22 **253/253 PASS** and required isolated Chrome steps SUCCESS; Windows Node22 **253/253 PASS**, Node24 required tests/Chrome/owner-style acceptance SUCCESS; **all three mandatory jobs SUCCESS**.

## Remaining blockers
Only local synthetic evidence consistency and bounded independent replay are established. Actual external-site data-ready rendering, authorized actions, live API and database equivalence, genuine cross-viewport multi-state parity, an independently reproduced third source, and current user physical Windows acceptance remain unverified. Live network policy and external host/method/path scope are not expanded by this task. On next `3`, prioritize practical unseen-app coverage and trustworthy data contracts rather than further cosmetic CSS.
