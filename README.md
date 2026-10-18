# Web REA Studio

> **CURRENT PRODUCT DIRECTION (2026-10-18): MECHANISM SKILLS, NOT VISUAL REPLICATION.** Analyze authorized dashboard composition, data links, chart interactions and inferred computations; store provenance-labeled reusable independent skills; map own CSV/JSON to generate a **new functional dashboard**. Immediate target: 3 skills + >=2 combined + offline HTML dashboard where changing filter updates both KPI and chart. **Functional MVP implemented on the feature branch; focused local prototype tests 10/10 PASS, exact GitHub source browser-script simulation PASS, official CI/native Chrome pending.** Run `npm run build:mechanisms` and open `output/dashboard.html` offline. See [runbook](docs/MECHANISM_SKILLS_RUNBOOK_2026-10-18.md) and [execution plan](docs/MECHANISM_SKILLS_MVP_2026-10-18.md) and [handoff](HANDOFF.md). Historic faithful/remix/schema functionality and W3C pixel benchmark below are legacy context, not current acceptance criteria. No new public-site captures without approval.


> **Latest 2026-10-18 — First actual public-site Chrome benchmark completed.** Authorized one-time W3C homepage capture (scriptless, no cookies or interactions) → saved geometry → independent faithful HTML → Chrome pixel comparison. **83.88% sampled full-page pixel match, RGB MAE 23.29, but only ~53.28% match among high-contrast source edge pixels**; major images/logo and body text remain missing. This is **not** a verified 70–80% human-perceived design reproduction or functional clone. Official CI [#39100919436](https://github.com/hibi89/web-rea-studio/actions/runs/39100919436): **4/4 jobs SUCCESS**, Linux Node22/Windows Node22/24 **315/315 PASS each**, one-time public W3C benchmark PASS. See [actual-site visual baseline](docs/REAL_PUBLIC_W3C_BASELINE_2026-10-18.md) and [HANDOFF.md](HANDOFF.md). Older dated notes below are historical and may be superseded.


> **Latest 2026-10-18 11:35 KST — local three-mode MVP committed on `mvp-three-mode-20261018`.** `/mvp` now offers faithful geometry, remix, and schema-data HTML generation using a previously completed static-visual run; individual independent previews and downloads. Isolated Node unit/HTTP **6/6 PASS**; full Studio integration/Chrome/branch CI/fidelity **not yet verified**. Existing main preserved. See `HANDOFF.md`. Historical initial design note below was written before this implementation.


> **2026-10-18: MVP execution branch (mvp-three-mode-20261018).** Execution plan: [docs/MVP_TODAY_20261018_BUILD_PLAN.md](docs/MVP_TODAY_20261018_BUILD_PLAN.md). All three outputs and measured visual fidelity are yet to be implemented; no new source site visits have occurred.


> **최종 제품 방향 (2026-10-18):** REA Studio는 허가된 사이트 하나에서 ① 원본형 독립 구현, ② 디자인 변형, ③ 사용자 데이터·스키마·설명에 맞춘 재구성형 웹앱을 생성하는 **3모드 로컬 제작기**로 개발한다. [확정 제품 계약 및 오늘의 3모드 MVP 완료 기준](docs/PRODUCT_CONCEPT_3_MODE_MVP.md). 현재 코드는 분석/정적 미리보기와 합성 실험 도구 위주이며, **세 모드로 독립 실행형 결과 3개를 만드는 통합 화면은 아직 구현 전**이다. 외부 실사이트 99% 완전 복제를 주장하지 않는다.


Private local-first website analysis project. **Current project state, limits, latest verified code and next steps: [HANDOFF.md](HANDOFF.md)**. P1 controlled Windows fixture and P2 static HTTPS have been observed working; the real-site P2 passive-browser app rendering is **not** verified (`Failed to fetch`). Recent F1–F4 behavior work is synthetic-fixture-only.

## Saved-run recovery guidance (read-only)

For a saved failed/interrupted run, `GET /api/runs/:id/recovery-plan` returns a **redacted offline-only recovery assessment**. The diagnostic panel also displays evidence availability and offers a JSON download. It checks report/inspection/manifest presence and conflicting modes/validation but does **not** verify action-level checkpoints, retry captures, grant permissions, expose stored target URLs or automatically reuse partial evidence. A new run still requires a fresh explicit POST and authorized exact target. Completed/running runs receive HTTP 409; nonexistent IDs return 404. The pure classifier's 4 focused tests passed locally; full integration and GitHub CI for this revision remain unverified. See [recovery plan scope](docs/LOCAL_RUN_RECOVERY_PLAN.md).

## F3/Q1 independent offline ZIP verification (CLI)

The CLI now preflights input files **before reading**: it rejects non-regular files, symlinks and input larger than 528,384 bytes, then reads only the bounded number of bytes and detects mid-read truncation/growth. A focused regression was added; official CI for this **new** change remains unverified. Previous GitHub Actions [#234](https://github.com/hibi89/web-rea-studio/actions/runs/39043665707) did pass Linux Node 22 and Windows Node 22/24 at 291/291 each, **before** this input hardening. See the [verifier documentation](docs/F3_Q1_OFFLINE_ZIP_INDEPENDENT_VERIFIER.md).

Run `node scripts/verify-offline-bundle.mjs <bundle.zip> [--expected-zip-sha256 <64-character-lowercase-hash>]` on Node 22+ to validate an already downloaded ZIP entirely offline. The verifier independently checks fixed two-entry ZIP32 STORE structure and paths, local/central headers, CRC32, HTML SHA-256, canonical two-viewport acceptance fields and unsigned synthetic-only limitations. Failed validation exits nonzero without extracting files. Optional expected ZIP SHA must be obtained separately from a trusted source; an unsigned self-contained bundle cannot authenticate its origin or prove original-site functionality. The seven new focused regression tests **PASS 7/7** in isolated Linux Node.js 22.16.0; one additional local Node HTTP→ZIP→CLI transport test also passed (**8/8 total**) using a stubbed acceptance dependency. This is **not** a full Studio-server test. A real Studio HTTP response→independent-verifier assertion is now committed in `tests/f3-q1-offline-bundle.test.mjs` and awaits official CI execution. The full project test suite, actual Studio HTTP test execution and official GitHub Actions CI are **unconfirmed**. Details: [independent offline verifier](docs/F3_Q1_OFFLINE_ZIP_INDEPENDENT_VERIFIER.md).

## F3/Q1 verified anonymous offline ZIP bundle

Studio now provides a separate **2-file ZIP download** only after the persisted explicit two-viewport Chrome acceptance receipt still matches the current saved passive evidence and synthetic HTML SHA-256. The ZIP contains exactly `rea-verified-synthetic-offline-only.html` and `rea-two-viewport-acceptance.json`; it is deterministic ZIP32 STORE with bounded entry sizes, a fixed file list, CRC32 and an allowlisted receipt (no original source labels, hosts, credentials, actions or API responses). `GET /api/runs/:id/f3-q1-offline-bundle` is read-only and returns a ZIP SHA-256 and HTML SHA-256 in headers; missing/changed acceptance refuses ZIP. **Original-site appearance, behavior and backend parity remain unverified.** See [verified two-file offline ZIP contract](docs/F3_Q1_VERIFIED_OFFLINE_ZIP_BUNDLE.md).

## F3/Q1 verified-only anonymous offline HTML download

The **separate** `GET /api/runs/:id/f3-q1-verified-offline-export` returns a fixed synthetic-only HTML attachment **only** when the previous explicit two-view Chrome acceptance receipt remains valid against the *current* saved passive evidence and regenerated anonymous HTML SHA-256 and byte count. It sets strong script/network/form/navigation-denying CSP and includes verification-scope and HTML digest headers. A missing/modified/failed acceptance returns no HTML; GET triggers **zero new Chrome/source access**. Studio offers the link after validated saved acceptance and hides it when switching runs. Legacy anonymous previews remain distinct. This verifies **synthetic generated HTML only**, not the original site. Details: [F3/Q1 verified offline HTML export](docs/F3_Q1_VERIFIED_OFFLINE_HTML_EXPORT.md).

## F3/Q1 explicit saved two-view Chrome acceptance receipt

The existing anonymous 3×3 HTML can now be **separately accepted** by a user-triggered local `POST /api/runs/:id/f3-q1-layout-acceptance`. It runs only isolated **in-memory generated HTML** in Chrome at 1440×900 and 390×844, checks computed CSS with zero active controls/source requests, then stores a write-once positive receipt bound to **both the HTML SHA-256 and saved evidence SHA-256**, only after both views pass. Its corresponding GET/download is **read-only** and rejects changed evidence, missing verification and tampered receipts. This is not an original-site fidelity certificate and makes no new network approval. Details: [F3/Q1 saved two-view acceptance](docs/F3_Q1_SAVED_TWO_VIEW_ACCEPTANCE.md).

## F3/Q1 measured responsive layout acceptance (offline)

The existing anonymized three-by-three geometry sheet now has a required [isolated Chrome computed-layout gate](docs/F3_Q1_COMPUTED_LAYOUT_GATE.md). A **fixed, opt-in, scriptless, in-memory-only** CDP probe reads computed grid columns, nine zone rectangles and document width without touching the original site. The gate verifies desktop 3-column and mobile 1-column order, no horizontal document overflow, and zero native action controls. An intentionally corrupted four-column variant must fail. It is **synthetic generated-output verification only**, not original-site responsive or functional parity. GET/download routes remain unchanged and do not launch Chrome.

## F3/Q1 anonymous 3×3 geometry preview (offline)

When the same saved failed/interrupted passive capture has consistent F3/Q1 counts, **fully valid observed control rectangles**, a measured computed-DOM viewport, and matching screenshot/report dimensions, Studio can additionally offer a [coarsely geometry-binned anonymous HTML preview](docs/F3_Q1_ANONYMOUS_COARSE_GEOMETRY.md) via `/api/runs/:id/f3-q1-geometry-preview` and separate download/receipt endpoints. Only coarse 3×3 positions and width bands are reflected; exact source pixels, labels, URLs, actions or data are never exported. Conflicted/incomplete evidence returns 409 without HTML. Actual isolated Chrome exercised both desktop (1440px) and mobile (390px) *generated output* with **zero real controls or external requests**. This does **not** prove original website appearance, mobile behavior or functional/backend parity.

## F3/Q1 anonymous noninteractive HTML wireframe (offline)

A saved failed/interrupted **Passive Browser** record with consistent F3/Q1 evidence can now produce an actual **anonymous HTML/CSS structural preview**, built solely from *observed control categories/counts*, not source layouts, text or behavior. Studio offers a preview, HTML attachment and [SHA-256 receipt](docs/F3_Q1_ANONYMOUS_WIREFRAME.md) via `GET /api/runs/:id/f3-q1-wireframe`, `...-download`, and `...-receipt`. Generated DOM contains **no native buttons/links/forms/inputs/scripts** and enforces script/network/form/navigation denial via CSP/sandbox. Missing or conflicting evidence returns 409 without generating a page. A real isolated Chrome synthetic render test confirmed no actionable controls or external requests. **Original site's look, data, actions, network/API, backend/DB, and functional parity remain unknown and blocked.**

## F3/Q1 evidence-based implementation priorities (offline)

A saved failed/interrupted **Passive Browser** run now supports `GET /api/runs/:id/f3-q1-work-plan`, which exports a bounded ordered [implementation priority plan](docs/F3_Q1_OFFLINE_IMPLEMENTATION_PRIORITIES.md). If saved evidence is consistent and a control is actually observed, only its **anonymized category/count** can inform a noninteractive offline wireframe *planning task*. All live actions, API link proofs, response fields, original backend/database, network permission and source-site equivalence remain **blocked**. Conflicts or missing evidence block even that UI planning. This is JSON work planning only: it does **not** generate HTML, working buttons or policy files.

## F3/Q1 evidence and authority readiness gate (offline)

The new `GET /api/runs/:id/f3-q1-readiness` endpoint is available only for **saved failed/interrupted passive Chrome runs**. It intersects F3 missing action/data proofs, F1/F2 observed event counts, the existing Q1 exact-permission preflight and saved local-policy failure assessment. It never infers an original API or creates any authorization. **Real-site functionality and network expansion remain blocked**, while verified *presence only* may inform a limited offline UI structure plan. Conflicted evidence blocks even that planning. The resulting report omits hostnames, paths, labels, form values, response bodies and secrets. Details: [F3/Q1 offline readiness](docs/F3_Q1_OFFLINE_READINESS.md).

## F3 passive functional and data gaps (offline)

The Studio's stored approved **Passive Browser** run can now export a read-only [F3 functional/data gap contract](docs/F3_PASSIVE_FUNCTION_DATA_GAPS.md) via `GET /api/runs/:id/passive-gap-contract`. The JSON summarizes only coarse observed control categories/counts and network event totals, explicitly marking action effects, state changes, control/API causality, response schemas, backend/DB and external permissions **unknown or unapproved**. Hostnames, URL paths, form values, labels, response bodies and credentials are omitted. It runs on **saved evidence** only; reloading this report makes no new requests or user actions and does not recover real source behavior.

## Full local planner Studio evidence, contract and reviewed export (offline)

The controlled third `planner` app is available as `fixture-generic-planner` **only when the exact local fixture URL is selected**. Its date-change and view-change transitions are observed using isolated Chrome with an in-memory calendar response, then passed through the same persisted F1/F2 graph, F3 manifest, F4 generated standalone HTML + reconstruction contract, F5 saved-chain audit, reviewed HTML export and unsigned SHA-256 receipt as catalog/analytics. A separate end-to-end **real Chrome → Studio POST → saved artifacts → reviewed HTML** test verifies the chain, including rejecting a tampered saved manifest with HTTP 409. The browser/API interactions are controlled **synthetic** only; this does not recreate an original external application's backend or database. See [planner Studio end-to-end acceptance](docs/F4_PLANNER_STUDIO_END_TO_END.md).

## Third independent state-machine fixture in real isolated Chrome (offline)

The F4 controlled generic Chrome suite now includes **planner** beside catalog/analytics. A new synthetic calendar page exposes date and layout state changes, a locally intercepted API response, permission-gated buttons and prohibited controls. The existing generic inference/generation engine builds a standalone HTML state machine from observed states, then an independent Chrome replay checks 3 transitions, 2 branches, 4 states and denial of unobserved click events with zero real external API requests. It was first introduced as a **CI-only browser fixture**, and is now separately integrated into the explicit local Studio mode and F3/F5 reviewed chain. New live-site behavior, source API and original DB are still unverified. See [third-fixture Chrome scope](docs/F4_THIRD_FIXTURE_CHROME.md).

## F4 F1/F2-to-F3-to-standalone-app reconstruction contract (offline)

Completed controlled synthetic `catalog`, `analytics` and `planner` runs now save a bounded `reconstruction-contract.json`. The contract ties observed action/state transitions, F3 manifest and the independently generated F4 HTML to exact SHA-256 digests, safe simulated-call counters, and explicit unknown real-world effects. `GET /api/runs/:id/reconstruction-contract` is read-only and returns 409 when linked saved graph, manifest or HTML no longer matches. The underlying HTML generator and old runs remain unchanged. A new planner-shaped synthetic schema is covered by Node tests only; source Chrome/real-site behavior is **not** proven for it. This does not recover any external backend or original API. See [bounded F4 reconstruction contract](docs/F4_RECONSTRUCTION_CONTRACT.md).

## F5 reviewed standalone export + SHA-256 delivery receipt (offline)

For completed `static-visual` and the two verified **synthetic-only** branching app run types, Studio now provides a `delivery-receipt` JSON link and a separate **reviewed HTML download**. The download is available only when the corresponding existing saved-artifact audit succeeds. Static pages additionally must meet their recorded visual quality gate; controlled synthetic apps must have consistent saved replay evidence. A failed, incomplete or modified artifact is **blocked** from this reviewed export path; legacy unreviewed download options remain available.

Receipts include the **exact HTML SHA-256 and byte count**, an explicit static/synthetic scope, and non-parity warnings. The receipt is not signed and **does not certify the original website's behavior, API, database or production readiness**. Rechecking downloaded SHA-256 proves the pair matches, not that the source site was authenticated. No live URL fetch, Chrome run, local capture mutation, Vercel deployment or outside origin approval is involved. See [reviewed delivery boundaries](docs/F5_REVIEWED_DELIVERY.md).

## F1→F5 controlled synthetic app integrity audit (read-only)

Completed `fixture-generic-catalog` and `fixture-generic-analytics` runs now provide a **cross-stage saved evidence audit** in Studio's F4 panel and at `GET /api/runs/:id/controlled-chain-audit`. It checks that a synthetic permitted state graph, F3 evidence manifest, F4 generated standalone branching HTML, and **previously recorded** F5 Chrome replay counters describe a consistent saved chain. Canonical HTML is independently regenerated and compared byte-for-byte. Altered/missing artifacts are marked `EVIDENCE_CONFLICT` or `INCOMPLETE`.

This GET starts no browser, does not revisit original URLs, and never claims fresh replay or real-site data/functional parity. It deliberately supports only the two already authorized **isolated synthetic** branching fixtures, not third-party websites. See [controlled F1–F5 saved chain audit](docs/F1_F5_CONTROLLED_CHAIN_AUDIT.md).

## Saved P4→P5 static pipeline integrity audit (read-only)

A completed `static-visual` run now offers **저장된 정적 재구현 검증 보고서 JSON** in the local Studio P4 results panel. `GET /api/runs/:id/static-pipeline-audit` reads previously saved artifacts only: it checks that the generated scriptless HTML matches the stored sanitized geometry byte-for-byte, recomputes full-canvas P5 screenshot metrics from the two locally saved PNGs, and detects inconsistent stored comparison or threshold claims. It reports `OFFLINE_ARTIFACTS_VERIFIED`, `INCOMPLETE` or `EVIDENCE_CONFLICT`.

A verified artifact audit **does not prove** that the visual threshold was met (a separate stage) or that any source interactions, API data or backend have been restored. It never launches a browser, calls an outside host, rewrites saved runs or exports raw site HTML, private text, URLs or screenshot bytes. See [saved pipeline integrity audit](docs/F5_SAVED_PIPELINE_AUDIT.md).

## P4 observed two-color CSS linear gradients (offline)

P4 now recognizes a visible gradient-only large panel in the existing passive Chrome geometry sweep and optionally preserves a **single bounded two-stop RGB `linear-gradient()`** in scriptless standalone HTML. Unsafe or unsupported CSS, images, layered gradients, URLs, private page text and JavaScript are not copied. Historical captures without the optional key remain byte-compatible.

The required Linux real Chrome test independently renders a synthetic original gradient, legacy reconstruction and gradient-aware reconstruction and checks full-canvas RGB error decreases; it does **not** imply real website/backend functionality. See [P4 gradient fidelity](docs/P4_LINEAR_GRADIENT_FIDELITY.md).

## P4 compact CSS chart-bar geometry (offline)

The existing script-disabled P4 observer now optionally captures up to 48 **small solid-color `div` rectangles** (e.g. basic CSS chart bars) as inert geometry: coordinates, dimensions, background color and radius only. The independent static HTML paints the observed rectangles without copying scripts, chart values, labels, SVG/canvas data, private text or any external resource. Input geometry is bounded and validated, and old captures with no `primitives` continue to generate exactly the same legacy HTML.

This is a **static chart-shape approximation**, not Chart.js/D3/Recharts/ECharts reverse engineering, functional graph reconstruction, or live backend data retrieval. An offline real Chrome CI fixture with six visible bars measures independent screenshot improvement. See [P4 compact chart primitives](docs/P4_COMPACT_CHART_PRIMITIVES.md).

## P4 measured card-shadow fidelity (offline)

The read-only P4 geometry probe now optionally preserves **one safe, bounded CSS box shadow** for an observed card/panel, including a visible shadow-only div where appropriate. Each value is independently sanitized and only rendered in generated **scriptless standalone HTML**. CSS `url()`, multi-layer/inset shadows, out-of-bounds offsets and source scripts are never copied. Stored geometry lacking the optional key keeps its previous exact generated output.

This improves only **visual depth/edge resemblance**, not paragraphs, icons, live charts, backend functionality or real-site behavior. A required fully in-memory real Chrome fixture compares the original synthetic card against legacy and measured reconstructions; acceptance requires improved full-canvas RGB MAE. Details: [P4 card-shadow fidelity](docs/P4_CARD_SHADOW_FIDELITY.md).

## P4 observed heading layout fidelity (offline)

The script-disabled static visual capture now reuses already observed **H1/H2/H3** data to preserve bounded Chrome-computed `white-space`, `line-height` and `text-align` values in standalone HTML. Values are strictly sanitized; no additional text categories, input values or external resources are collected. Old saved analyses lacking these fields retain their original generator defaults and HTML compatibility.

The mandatory in-memory Chrome test creates a wrapped heading, independently renders a legacy reconstruction and a measured reconstruction, and requires the **measured version to have lower full-canvas RGB error**. This is typography-only fidelity for a controlled fixture, **not** real website behavior, responsive design or backend equivalence. See [P4 heading typography](docs/P4_HEADING_TYPOGRAPHY.md).

## Product quality standard

Our goal is independent, runnable website reconstruction on multiple **authorized real sites**, not a screen-only clone or synthetic-only demonstration. See [quality-first completion contract](docs/QUALITY_FIRST_ROADMAP.md) for F1–F5 evidence gates, security boundaries, closed-loop correction and acceptance milestones.

P5 comparison v2 measures the **full screenshot canvas**, penalizes missing/cropped areas and exposes a static visual-only quality gate. This does **not** certify real-site JavaScript, API behavior, server data or autonomous repairs. Existing historical P5 comparison files are not automatically upgraded or regraded.

## F4 bounded negative action coverage

The two in-memory synthetic F4 Chrome fixtures now verify both **observed action transitions** and that synthetically dispatched events on normally disabled, unobserved actions (with the DOM disabled flag temporarily bypassed) leave the independent app state and simulated API counters unchanged. This extends the existing generated-state-machine quality gate without calling an external site, opening permissions or changing original data. It is **not** proof of functionality for arbitrary external websites. See [F4 negative transition guard](docs/F4_NEGATIVE_TRANSITION_GUARD.md).

## F5 owner-triggered saved draft geometry review

A previously registered **independent P4 draft** can now be explicitly reviewed from local Studio. The action verifies the local HTML's SHA-256 and canonical scriptless template, uses a **fixed synthetic in-memory URL** for fresh Chrome draft evidence, uniquely aligns painted regions against the saved original and applies at most two measured static x/y/width/height corrections. It saves a separate result receipt; a downloadable improved HTML is exposed **only after independently accepted visual improvement**. Normal GET/read-only history causes no browser actions. This is still a static, single-viewport bounded experiment, **not** a complete functional clone or a new external API permission. See [F5 saved independent geometry review](docs/F5_SAVED_GEOMETRY_REPAIR.md).

## F5 safe independent draft intake (local, explicit)

Local Studio now provides a **Static Visual → F5 independent draft** workflow: download the sanitized P4 geometry JSON, modify the separate static layout draft, select the edited JSON and explicitly register it. Studio deterministically generates a scriptless standalone HTML and saves it **once per run**, without changing original analysis files, contacting the original website, executing uploaded HTML or expanding network permissions. Strict canonical HTML+geometry bundles are also accepted via the API; arbitrary HTML uploads are **rejected**. Receipt status remains **STORED_UNVERIFIED**; real Chrome visual identity, geometry repairs, behavior and backend equivalence must be proven separately. See [safe local draft intake](docs/F5_LOCAL_DRAFT_INTAKE.md).

## F5 observed independent source/draft correspondence

The [observed-region alignment gate](docs/F5_OBSERVED_ALIGNMENT.md) now accepts **independent source and scriptless-draft Chrome captures** even when the original uses `aside` or `main` and generated DOM uses reordered `div` elements. Only uniquely matched large painted rectangles may be projected into the existing bounded geometry repair engine, after a separate screenshot preflight proves the projected HTML matches the real observed draft. Ambiguous, mixed, changed, or multiple defects fail closed. This is still an isolated **synthetic** acceptance path, not yet a new local Studio UI action or evidence of external-site reconstruction.

## F5 bounded observed rectangle geometry repair

The new [position and size repair prototype](docs/F5_GEOMETRY_REPAIR.md) can correct one mismatched, independently observed **static P4 rectangle** field (`x`, `y`, width or height) at a time. It is fail-closed when region identity is ambiguous, the change exceeds 64px, a title/painted peer overlaps, a Chrome replay fails, visual quality does not improve or another supplied viewport regresses. This is an isolated engine with mandatory synthetic Chrome evidence, **not** automatic correction of arbitrary live responsive sites, nor currently another Studio UI action. The existing color-repair and real-site permission policies are unchanged.

## F5 independent cross-viewport guard

The bounded F5 engine can now receive **separately captured reference evidence for up to two other viewport sizes**. It replays the exact same proposed scriptless HTML at each size and rejects a desktop paint fix when any observed secondary view worsens (or cannot be independently measured). A new synthetic-only Chrome viewport override is permitted only for memory-relayed, script-disabled capture; real-site capture defaults and authorization are unchanged. **The ordinary local Studio still has only a single saved source viewport and does not claim multi-viewport verification.** See [independent viewport acceptance and scope](docs/F5_MULTIVIEWPORT_GUARD.md).

## F5 opt-in saved-only review in local Studio

A completed Static Visual run with existing P5 v2 evidence now offers **오프라인 색상 재검증 실행**. This is an explicit, one-time local Chrome replay of the **generated scriptless reconstruction** using a fixed synthetic interception URL. Loading run history or reading the result does not recapture the original site. No external host permissions, network relay or original run data change. The saved screenshot path can now infer **one paint color at a time** when a large, unobscured region differs strongly and is near-uniform in both original and independently rendered images. Gradients, textures, text-heavy areas and uncertain evidence remain unsupported; **NO_SAFE_COLOR_PATCH** stays an expected safe outcome. An improved HTML is downloadable only after a fresh replay proves a measurable benefit. See [limitations and acceptance](docs/F5_STUDIO_OFFLINE_REVIEW.md).

## F5 measured bounded repair (synthetic proof only)

The new [F5 bounded-repair experiment](docs/F5_BOUNDED_REPAIR.md) proposes at most **two** evidence-backed static color changes, re-renders every proposal in a new isolated Chrome capture, and keeps only measured improvements. Failed or non-improving proposals are rejected. This is a reusable **engine and CI experiment**, not yet a user-facing general repair button, an authorized real-site result, or proof of application/API/behavior equivalence.

## Q1 offline failure attribution (saved evidence only)

Failed passive browser runs now expose **Q1 실패 원인 판정 JSON** from
`GET /api/runs/:id/q1-assessment`. It cross-checks the existing redacted
support packet and permission checklist against the actual local same-origin
GET/CSP policy, and marks evidence as bounded, partial, or inconsistent.
A finding of `LOCAL_POLICY_BOUNDARY_COMPATIBLE_NOT_CAUSAL` means a rejected
off-origin fetch is **compatible** with current local policy; it does **not**
prove the remote server is reachable, CORS-correct, necessary, or authorized.
The export contains no original external hostnames/URLs/paths/credentials.
It makes no external request, changes no allowlist and never marks a product
functional. See [Q1 failure assessment](docs/Q1_FAILURE_ASSESSMENT.md).

## Q1 offline permission planning (read-only)

For an already failed/interrupted passive analysis, the local Studio failure inspector now offers **Q1 권한 사전 점검 JSON**. It reports saved evidence for rejected external hostnames, missing explicit authorization and path/method/budget requirements, with extra warnings for local/IP-coded DNS hostnames. The output is **never an executable allowlist** and every verdict blocks new external access pending approval. It makes **no outbound request**. See [Q1 preflight](docs/Q1_PERMISSION_PREFLIGHT.md). The user's original dashboard data-loading error remains unresolved.

## What it does today

| Mode | Site | Engine | Output |
|---|---|---|---|
| Controlled browser | `http://127.0.0.1:4317/` | pinned `rea-agents@6.5.0` / Chrome | Seven scripted actions, DOM/accessibility, network events, verified report, final screenshot |
| Authorized HTTPS static | Exact URLs in `WEB_REA_ALLOWED_URLS` | Restricted single HTTPS GET, **not REA** | HTML page title, headings, controls/forms, same-origin path summary, digest and limited report |

**Limitations:** The tool does **not** reconstruct private server source, analyze unauthorised domains, bypass authentication or make unrestricted external browser requests. Static external analysis does not execute JavaScript or take screenshots.

## Windows owner acceptance: isolated legacy data and safer diagnosis

On the owner's second local test the Node regressions **210/210** and npx launcher passed but the disposable `windows-studio-loopback` process failed. A real safety bug was found in that **smoke test**: the temporary Studio could import old results from the user's actual repository. The offline smoke now explicitly skips this migration and real approved-target file while still verifying the real loopback Studio endpoints. An allowlisted `diagnostic.phase`/`diagnostic.reason` is returned on failure, without raw private logs. [Windows Node 22/24 + Linux all-green CI](https://github.com/hibi89/web-rea-studio/actions/runs/39009659884) includes a seeded legacy-run case and **211/211 Node + 5/5 owner-style smoke** in each Windows environment. The user's third local `npm run accept:local` now reports **211/211 Node and 5/5 PASS** on their own PC. The specific cause of the earlier second failed run remains unverified.

## Owner Windows one-command offline self-test

The owner can run `npm run accept:local` **in the local Windows clone** to verify the actual machine's Node regression suite, locally installed npm/Chrome, loopback Studio startup and real synthetic P4/F5 Chrome repair. This is a **user-triggered offline check**, not a live-site replay, a third-party REA install or source API permission. Every run creates a new **private redacted** result JSON in `results/acceptance/` (already Git-ignored), with stage results and generic error codes but no site URLs, raw HTML, browser profile, token or local user path. CI separately exercises this same entrypoint, and the owner's third run has now provided **211/211 Node + 5/5 PASS** with real local Chrome P4/F5. External-site/API functionality remains unverified. [Detailed commands and limits](docs/WINDOWS_OWNER_ONE_COMMAND_ACCEPTANCE.md). The owner-PC regression probe now pins Node's TAP test reporter and also strictly recognizes Node 22/24 spec/TAP summaries to prevent a successful test run from being incorrectly labeled `CHECK_PROOF_MISSING`. The owner's first local attempt was blocked at this proof-parsing stage; a successful GitHub runner does not replace a new owner-PC acceptance result.

## Verified GitHub Windows offline compatibility (2026-10-17)

Beyond Linux, [both Windows and Linux CI jobs now pass](https://github.com/hibi89/web-rea-studio/actions/runs/39004521346) at code SHA `ee839bf2`: real Windows Node **205/205**, no-download npx launcher preflight, actual local Studio startup with a path containing spaces and loopback Host protection, real Windows Chrome P4 capture, and stored user P4 draft → Chrome F5 x/width correction (RGB MAE **2.41 → 1.61**, two accepted edits). No real third-party website or API is contacted.

This verifies the **GitHub Windows runner**, **not** the owner's **subsequently accepted offline laptop run**, real REA-provider capture, or the previously failed external dashboard. [Windows test scope and local steps](docs/WINDOWS_OFFLINE_ACCEPTANCE.md).

## Windows quick start

In the checked-out `hibi89/web-rea-studio` directory:

```powershell
git pull --ff-only
npm test
npm run check:launcher
npm run studio
```

Open `http://127.0.0.1:4320/`. Click **분석 실행** with the default local fixture URL to exercise the P1 browser workflow.

For a domain you own or have permission to analyze, stop Studio and set an exact HTTPS authorization in your PowerShell session **before** starting it:

```powershell
$env:WEB_REA_ALLOWED_URLS='https://your-approved-actual-site.example/'
npm run studio
```

The domain above is a placeholder; use an actual authorized URL. Copy that same exact URL into Studio. This performs a **single static HTML request** only. An unapproved URL is rejected.

Only one run executes at a time. Refresh and viewing history do not re-run the analyzer. On Windows, results stay in `%LOCALAPPDATA%\WebREAStudio\runs`, outside the OneDrive-synced source checkout.

## Tested vs untested

- **Owner Windows real P1 evidence**: `COMPLETED`, strict `PASS`, 7/7 steps, HTTP 200 observed, screenshot saved, inspector populated (2026-10-16; owner provided UI screenshots).
- **P2 static HTML**: offline local tests of scope, DNS filtering, TLS request parameters, redirect refusal, HTML size checks, extraction, and API persistence. **No live external HTTPS test on owner Windows yet.**
- REA 6.5.0 is pinned; direct Node → `npx-cli.js` launcher is used instead of Windows `cmd.exe /c` to avoid quoting failure.

## Documentation

- [P2 authorized static analyzer](docs/P2_STATIC.md)
- [P1 console and persistence](docs/P1_CONSOLE.md)
- [P1 evidence inspector](docs/P1_INSPECTOR.md)
- [P0 REA acceptance](docs/P0_CHECKLIST.md)
- [Architecture and requirements](REQUIREMENTS.md)

No unrelated GitHub repositories or Vercel projects are modified by this Studio.

## P2 first real HTTPS target

The user-selected exact HTTPS URL is listed in `config/approved-targets.json`.
`npm run studio` now loads it and pre-fills it in the analysis console.
This runs **one read-only static HTML GET**, not REA browser capture and not
website cloning. No extra `WEB_REA_ALLOWED_URLS` environment variable is
needed for the checked-in target. The existing REA-controlled fixture remains
available by entering `http://127.0.0.1:4317/` manually.

## P2-2a passive live-page browser preview

The approved HTTPS site can now be analyzed in **Static HTML** (unchanged default)
or an explicitly selected **Passive Browser** mode. The passive mode uses a fresh
Chrome DevTools session with restricted same-origin GET relay requests. It runs
page JavaScript and records a screenshot, basic DOM structure, blocked/fulfilled
resource metadata. No clicks, sign-in, full crawling, browser-source recovery,
or external-domain fetches are enabled. See [P2_DYNAMIC.md](docs/P2_DYNAMIC.md).

This is a first developer preview; real Windows end-to-end success has not been
established. The existing P1 REA fixture and P2 static HTML tests remain intact.


## P2-2 live site failure (2026-10-16)

The owner successfully captured a real PNG and DOM for the approved site, but the
captured page displayed `Failed to fetch` instead of the working dashboard.
Older P2-2a reports incorrectly used `PASS` to mean screenshot stored, even when
the application's report failed. The revised code marks visible fetch failure
or unsettled requests as `FAIL`, saves the diagnostic screenshot, and keeps
browser-only capture status separate from working application rendering.
A broken data request is **not yet repaired**. Inspect the saved network event
summary before allowing additional origins or changing the request policy.

## Local failure diagnostics

The public Vercel deployment is a **mock UI**. Actual browser analysis runs on
the Windows PC at `http://127.0.0.1:4320/`. Storage is local, outside OneDrive.

Pull the latest code, run `npm test`, then `npm run studio`. Select any
previous **FAILED** run from the left sidebar to see **실패 원인 진단**:
a bounded summary of failure codes, network request counts, path-only network
metadata and the recommended next check. **진단 복사** copies the sanitized
summary; it never includes raw stderr, request query strings, cookies or tokens.

This viewer makes no new browser request and never retries an analysis.
If the site displays `Failed to fetch`, the screenshot is diagnostic,
**not** proof that the site was successfully reconstructed.


## P2 cross-origin fetch diagnosis (local only, 2026-10-16)

When a previously recorded passive capture reports a rejected JavaScript fetch
to a different host, the local diagnosis panel now classifies the captured
evidence as `PASSIVE_EXTERNAL_FETCH_REJECTED`, without probing or authorizing
that host. The current Chrome CSP `connect-src 'self'` and the Node gateway's
same-origin policy can prevent such data requests. The diagnosis does **not**
establish that the remote server is reachable, that CORS is configured correctly,
or that the failure is solely attributable to CSP.

The owner must explicitly confirm authorization of any additional backend host
before introducing an opt-in cross-origin allowlist. Never weaken the current
gateway by a wildcard, accept raw URLs, expose cookies, or treat the browser's
requested URL as permission. Inspect failed runs first; no repeat capture needed.
