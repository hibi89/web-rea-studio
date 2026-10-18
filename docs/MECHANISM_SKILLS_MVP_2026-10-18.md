# REA Mechanism Skills MVP — 1h fast path / 2–3h hard stop (2026-10-18)

> **CURRENT AUTHORITATIVE PRODUCT DIRECTION.** Supersedes the legacy 3-mode, pixel-fidelity-first design goals in `docs/PRODUCT_CONCEPT_3_MODE_MVP.md`, `docs/MVP_TODAY_20261018_BUILD_PLAN.md`, historical README/STATUS/HANDOFF entries. Keep legacy code functional but **do not spend the MVP budget improving faithful CSS, screenshot similarity, hero images or exact branding**. No user/competitor site copying or asset redistribution.
>
> User goal: learn functional patterns from authorized reference dashboards, save reusable **mechanism skills**, apply selected skills to **the user's own CSV/JSON** to generate a new interactive dashboard with independent design. UI polish is later. Product is a **dashboard mechanism analyzer + skill composer**, NOT a general website copier.

## Definition of DONE today

One end-to-end locally runnable demonstration:
1. Input a **saved/authorized** reference observation (or an explicitly labeled, bundled demonstration fixture; do not pretend a fixture was reverse-engineered from a real public site).
2. Export `mechanism-spec.json` describing chart dimensions/measures, filters, aggregations, data dependencies and interactions. Every field/edge has `provenance: observed | inferred | template | unknown` and a confidence/limitation statement; unknown APIs or server algorithms are never fabricated.
3. Build **three standalone, independently implemented mechanism skills** in `skills/dashboard/` (e.g., `group-by-sum`, `dimension-filter`, `chart-crossfilter`) with explicit input schema, output contract, executable logic and fixture tests. Not downloaded source code or copied proprietary JS.
4. Accept user's own **CSV or JSON** (fixture CSV/JSON initially acceptable, user-provided upload if easy), suggest/validate column mapping to those skills, allow explicit mapping override; do not silently mis-map.
5. Combine **at least two skills** into an independent HTML dashboard: visible chart(s), region/time filter, working recomputation, independent theme, user-data values—not hardcoded demonstration numbers. Verify selecting a different filter changes KPI **and** chart consistently, and outputs can be downloaded/opened without the original site.
6. Produce a reproducible offline smoke test and report: source/fixture type, observed vs inferred vs template fields, passed test commands, and limitations. Record exact Git SHA / CI status.

**PASS:** skills and data flow demonstrably work with an offline fixture, two different filter selections result in expected different numbers, output contains no remote dependencies, no proprietary design/assets. **NOT PASS:** static screenshot; dummy filters; an unverified API claim; design-only transformation; documentation or architecture without running code.

## Timeboxed execution — first 60 minutes preferred, maximum 180 minutes

### 0–10 min: Inspect/reuse
- Read `AGENTS.md`, `HANDOFF.md`, this document, `studio/interaction-blueprint.mjs`, `studio/frontend-blueprint.mjs`, `studio/mvp-builder.mjs`, `studio/mvp-api.mjs`, `studio/public/mvp.js`.
- Verify available assets/tests. Existing controls are **read-only**, frontend HTML inspection gives **structural hints** only, 3-mode `schema` output supports table search/sort; NONE of these proves chart-data-flow or original backend extraction.
- Do not rewrite old REA pipeline. Add a separate clean `/mechanisms` workflow or small offline CLI (whichever gets a verified working result first).

### 10–30 min: Three minimal skills (start from public concepts / test fixtures, not unverifiable real sites)
- `group-by-sum`: rows + group column + numeric measure → grouped counts/sums (reject non-finite numbers; define blank handling).
- `dimension-filter`: rows + selected categorical value → filtered rows and totals (explicit `all` convention).
- `chart-crossfilter`: filter selection → recompute KPI + chart data using same result, not separate mocks; report trace from user input to output.
- Provide schema validation and unit tests, independent implementation. Treat these as **template-derived skills** until actual inspected reference evidence is added.

### 30–60 min: Working vertical slice and acceptance
- Load bundled local CSV and JSON (e.g., `region,month,revenue`; >=2 regions, >=3 months); map three columns with type checks. Prefer a simple native HTML+SVG bar chart (no chart library/CDN) and region select; avoid new dependency installs.
- Generate `output/dashboard.html` (or secure local download endpoint) with inlined sanitized data and CSP, responsive basic layout, visible aggregation. Re-open offline; change region and assert both total and graph change. Add one regression for malicious cell text/XSS and one for invalid schema.
- **If working at 60 minutes, STOP scope growth**; run tests + update handoff. Do not spend remainder on UI polish.

### 60–120 min: Only if pass gate still incomplete
- Connect existing saved run passive controls/HTML analysis to `mechanism-spec.json`, but do not invent exact API mappings: simple HTML chart markers and labels are **structural hints**, real request-response edges require authorized network observation.
- Add browser smoke test using controlled localhost fixture. If browser impossible, prove JS behavior through an existing tool or report browser validation as pending.

### 120–180 min: Stabilize or pivot, HARD STOP at 180 min
- Fix highest-priority blocker; run existing focused/full test suite as practical.
- If same approach fails twice without progress, pivot (local fixture → offline CLI → static generator). No more than 2 nonproductive attempts at a reference URL/technique.
- **At 180 min** stop expansion and report whether a working MVP was actually obtained. Never claim 1h/3h completion as verified before tests.

## Authorized reference selection & evidence

- Existing `daily-dashboard-ldh-1013.clevertide128.chatgpt.site` URL has repeatedly been **unreachable**; stop retrying it. No bypass.
- W3C original captured in one-time CI was a **visual homepage test, NOT a chart/data-mechanism reference**. Do not mislabel it as an analyzed dashboard.
- Prefer **bundled authored demo** to secure today's functional MVP. Later inspect accessible publicly documented examples such as Vega-Lite crossfilter demos / Plotly examples **only after explicit origin approval**, preserving permission rules, instead of wasting time on blocked sites.
- Do NOT broaden exact-origin allowlist, rerun live W3C one-shot, log into accounts, capture credentials/cookies/PII, or traverse protected pages without separate explicit authorization.
- A screenshot or DOM alone does **not** reveal backend DB, SQL or proprietary algorithms. For API link confidence, record actual observed safe request/response evidence from an explicitly approved environment; otherwise `unknown` / `inferred`.
- Existing network/CSP/SSRF protections must remain intact. Own CSV/JSON stays local unless expressly approved.

## Minimal mechanism spec (example; TEMPLATE, not observed from a real site)

```json
{
  "version": 1,
  "reference": {"kind": "local-fixture", "provenance": "template"},
  "inputs": [
    {"column": "region", "type": "category", "provenance": "template"},
    {"column": "month", "type": "category", "provenance": "template"},
    {"column": "revenue", "type": "number", "provenance": "template"}
  ],
  "skills": [
    {"id": "dimension-filter", "input": ["region"], "output": "selected-rows", "provenance": "template"},
    {"id": "group-by-sum", "input": ["selected-rows", "month", "revenue"], "output": "monthly-revenue", "provenance": "template"},
    {"id": "chart-crossfilter", "input": ["monthly-revenue"], "output": ["kpi-total", "bar-chart"], "provenance": "template"}
  ],
  "api": {"status": "not-observed", "server_algorithm": "unknown"}
}
```

## Implementation/review contract

- Suggested new files (adjust to codebase): `studio/mechanism-skills.mjs`, `studio/mechanism-spec.mjs`, `studio/mechanism-dashboard.mjs`, `tests/mechanism-skills.test.mjs`, `tests/mechanism-dashboard.test.mjs`, one small sample CSV/JSON; optional `/mechanisms` UI.
- Preserve existing 3-mode routes/tests; do not delete old code to meet timebox.
- Run targeted Node tests first; run existing suite/CI when possible. Clearly distinguish **new tests PASS** vs historic **315/315** baseline; CI triggered by documentation changes is not feature verification.
- Commit code and update `HANDOFF.md`/`STATUS.md` after each working bounded slice, branch `mvp-three-mode-20261018`, no production deploy or main merge.
- End with: commands to run, output location, evidence that filter changed values, three skill contracts, provenance coverage, git SHA, unresolved blockers, and next action (only if needed).

## Copy-paste next-chat / Codex command

```text
p1 개발을 이어가라. GitHub hibi89/web-rea-studio, 브랜치 mvp-three-mode-20261018 최신 HEAD를 조회하고 AGENTS.md → HANDOFF.md → docs/MECHANISM_SKILLS_MVP_2026-10-18.md → STATUS.md → 관련 소스 순서로 확인하라.

제품 방향 변경 확정: 원본 사이트 시각 복제는 중단한다. 공개/허가된 대시보드에서 메커니즘을 학습해 스킬 라이브러리에 저장하고, 내 CSV/JSON 데이터에 맞게 2개 이상 스킬을 조합한 완전히 다른 디자인의 작동하는 대시보드를 만드는 것이 MVP다. 막혔던 chatgpt.site URL은 재시도 금지. W3C는 차트 사례가 아니다. 동의 없는 새 외부 사이트 탐색 금지.

위 MVP 문서의 0–60분 최단 경로부터 바로 코딩: group-by-sum, dimension-filter, chart-crossfilter 3개 구현, CSV/JSON 매핑, KPI+SVG 차트 동시 갱신, 단일 독립 HTML 출력, 실제 필터 변화 테스트. 기존 시스템 재사용, 신규 의존성 최소화, 기능 우선. 60분에 동작하면 완료하고 검증·커밋. 늦으면 120–180분 보완, 180분 하드스톱. 반복 실패 2회면 다른 접근으로 전환. 검증하지 않은 외부 API/알고리즘 추출 성공 주장 금지. 구현·테스트·커밋·HANDOFF/STATUS 갱신까지 스스로 수행하고, 유저 개입 요청을 최소화하라. 결과는 실제 성공/실패 근거와 SHA로 보고하라.
```
