# Web REA Studio: requirements baseline

## Goal
Authorized website observation → evidence graph → behavior/spec inference → independently implemented UI and backend where feasible → behavior/screenshot comparison.

## Scope
P0 source audit, host compatibility, controlled fixture, REA interaction smoke. P1 guided exploration and evidence browser. P2 AI spec and code generation. P3 verified compare-and-repair. P4 own adapters beyond the original REA.

## Functional
1. URL and exact-origin + allowed path approval before capture.
2. Passive CDP capture (non-mutating), owned Playwright scenario capture (explicit actions) are separate capabilities.
3. Store evidence and each inference with provenance and unknown coverage.
4. Capture runs are user initiated; reloading the UI is read-only.
5. Export source files, independent tests, and verification reports without assuming original backend/database equivalence.
6. Resume jobs at a safe checkpoint, deduplicate same requests, bound actions/tokens/budget.

## Nonfunctional
- Safe by default: deny unexpected origins, IP/localhost targets unless explicit local-test mode, stop on navigation outside approved origin; respect robots/site permissions and legal constraints.
- Credentials and observed secrets must not leave the approved local device without separate consent.
- Bind CDP to loopback with a dedicated browser profile.
- One actual successful browser fixture run is required before P0 completion.
- Planned technologies: Node.js/TypeScript, React/Vite, SQLite, Playwright/CDP, REA via pinned CLI/MCP. Actual adapter APIs require runtime verification.

## Acceptance
Refer to `docs/P0_CHECKLIST.md`; P1 requires verified P0 runtime observations.

## P1-1 boundary (implemented)
- Local studio binds `127.0.0.1`, validates Host/Origin, and accepts only exact controlled fixture URL.
- Every run must be explicitly requested with POST; GET routes only read saved metadata, reports, or screenshots.
- At most one active run; previous interrupted states are retained, not silently retried.
- Evidence is stored in `results/` and excluded from Git. Current storage is JSON files and local PNG, **not** the planned SQLite schema.
- Real Windows execution under `npm run studio` remains an acceptance gate, separately from mock tests.
