# Web REA Studio: requirements baseline

## Product v1 — 사용자 확정 상위 요구사항 (2026-10-18)

**최종 목적:** 허가받은 사이트 URL 하나로 독립된 실행형 웹앱을 생성하는 3모드 제작기. 전체 사용자 경험과 3모드 MVP 골격을 **기존 P0–P5 부품의 미세 보강보다 우선**한다. [제품 계약 및 오늘 MVP 기준](docs/PRODUCT_CONCEPT_3_MODE_MVP.md)을 현재 제품의 단일 상위 명세로 사용한다.

- **MODE 1 원본형:** 관찰된 시각·동작을 최대한 독립 재구성. 99%는 장기 지향 목표이지 보증되는 일반화 성능이 아니며 측정 대상과 메트릭별 실측 필수.
- **MODE 2 디자인 변형형:** 동일 분석 결과에서 색상·타이포·레이아웃을 사용자의 명세대로 바꾼 독립 앱.
- **MODE 3 내 데이터 기반형:** 동일 사이트의 디자인 패턴을 바탕으로 사용자가 제공한 데이터/스키마/설명에 맞게 콘텐츠, 필드, UI와 지원되는 상호작용 변경.
- **오늘의 실행 MVP:** 하나의 유효한 저장 증거 → 세 모드 각자 독립 HTML 출력 → 브라우저 미리보기 → 다운로드, 최소 1개 로컬 기능/데이터 수정 확인. 미확인 원본 API/JS/DB는 작동 복제로 속이지 않음.
- **개발 순서:** 최종 화면 고정 → 전 섹터 기본 연결 → end-to-end 검증 → 이후 세부 충실도 향상. 안전한 정확 URL allowlist와 사용자 승인 경계 유지.

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
