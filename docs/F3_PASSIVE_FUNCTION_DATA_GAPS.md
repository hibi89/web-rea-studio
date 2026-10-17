# F3 — passive F1/F2 evidence to functional/data gap contract

Date 2026-10-17. Source SHA `763a13b6f6cb3eb875f24151fc696bde5bfcd3a6`. Verification: [Actions 39029029219](https://github.com/hibi89/web-rea-studio/actions/runs/39029029219), first attempt, **3/3 jobs SUCCESS**.

## Purpose and decision

The project can already observe passive DOM controls and group network attempts, but a real site's working behavior and actual data contract remained unconfirmed. Rather than guessing from button labels, external hostnames or suspected APIs, expose a **bounded F3 unknown/gap contract** derived exclusively from the saved passive evidence.

Two considered designs: (1) infer API routes, schemas and button effects from passive event names or text — seemingly convenient but unsupported and potentially sensitive; (2) **aggregate observed evidence and enumerate exact missing proofs without asserting causal links** — chosen. No remote requests or scope expansion.

## Implementation

- New pure `studio/passive-gap-contract.mjs`: requires `dynamic-passive` inspection and compatible report; builds upon the existing F1/F2 `buildPassiveSiteBlueprint` and `buildPassiveDependencyReview`. Returns coarse UI affordance categories/counts and same-origin/external event counters, without raw identifiers, labels, hostnames, URLs, query strings, paths, response contents, form values or credentials.
- Emits bounded F3 gap rows for **real action effects, response field schema, control-to-API causality, original backend/database contract, external dependency access and capture completeness**. Every row remains explicitly unknown, missing or not approved; never indicates product readiness or site parity.
- Read-only GET `/api/runs/:id/passive-gap-contract` provides JSON attachment only for already saved `dynamic-passive` runs. Missing inspection 404, mismatched saved mode 409, unsupported/synthetic modes 404. Does not relaunch Chrome, access source URLs or mutate stored files.
- Studio's F1/F2 inspector shows a separate **F3 미확인 기능·데이터 공백 명세 JSON** link for passive runs. The link is reset when switching runs, and is absent for other modes.
- Existing F1/F2 network evidence and F3 manifest remain unchanged; synthetic F4 Chrome and F5 reviewed exports are unaffected.

## Test evidence and limitations

`tests/passive-gap-contract.test.mjs` adds 3 Node tests: (a) a deliberately failed offline passive capture with sensitive labels, URL, headers, form input and response bytes still produces only coarse permitted counts and unknown states; (b) legacy missing evidence and synthetic mode fail-closed; (c) a local Studio GET is deterministic, makes **0 Chrome/source-network calls**, and rejects unsupported/missing runs. Existing HTTP, Windows launcher, Chrome F1~F5 regression gates preserved.

Workflow [39029029219](https://github.com/hibi89/web-rea-studio/actions/runs/39029029219): Linux Node22 **257/257 PASS**, Windows Node22 **257/257 PASS**, Windows Node24 required job **SUCCESS**, three required jobs **SUCCESS**, all in the first run attempt. No actual external application was revisited to collect new data this turn. Actual source-site data readiness, response schema, interactive controls, hidden backend, original database and commercial delivery readiness are still **unverified**. Current user physical Windows acceptance is deferred until final stage.

## Next bounded step

Offline cross-check the new gap contract against existing saved Q1 permission preflight and passive network evidence. Build fail-closed readiness decisions for what can be implemented from observed structure and what needs **separate explicit approval** for specific external origins/actions/data. Do not infer automatic permission from matching request hosts or attempt any new external fetch.
