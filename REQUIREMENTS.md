# Web REA Studio requirements v1

## Objective
Build a controlled web reverse-engineering assistant: authorized browser observation, evidence-based UI and behavior specification, independent implementation, and reproducible comparison.

## Stages
P0: source audit, local fixture and REA smoke test. P1: approved target capture and evidence explorer. P2: generation. P3: compare-and-repair. P4: proprietary adapters.

## Requirements
1. Explicit authorized origins, paths and actions. No auth bypass, credential harvesting, probing private hosts or state-changing requests by default.
2. Separate passive CDP from active Playwright capture.
3. Maintain provenance, unknown coverage and evidence completeness.
4. A browser refresh must never trigger analysis again.
5. Keep local evidence out of GitHub and external AI calls without separate consent.
6. Pinned upstream REA 6.5.0 and a removable adapter layer.
7. Stop and pivot after two unsuccessful materially equivalent attempts.
8. P0 exit condition: owner Windows browser REA evidence confirms clicks, DOM/accessibility and no private-data leaks.
