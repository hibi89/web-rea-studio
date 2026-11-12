> **[OWNER-FINAL-BLUEPRINT-100 | 2026-11-13 KST | 사용자 확정·전체 저장소 공통 최우선]** 제품의 **공식 최종완성률 분모는 사용자 확정 최종설계도 전체 100%만** 인정한다. 담당 총괄/작업자 임의로 설계 범위·가중치·완료 조건을 축소·변경하거나, 해커톤용 MVP·합성 테스트·CI PASS/개발 마일스톤 85%·95%를 최종완성률로 혼용하지 않는다. 최종 요구 ID→구현 코드→정확 SHA의 실제 검증→미구현/미검증을 추적하고 승인된 가중치로만 산정한다. 증거/가중치 없으면 **최종설계 기준 UNASSESSED(재산정 대기)**, 기존 수치는 **과거 내부 마일스톤**으로 보존. 크몽 상품은 반드시 해총 `kmong-productization` 원장에 최신 근거 동기화, [작업중]/등록완료/RELEASE HOLD·최종 승인 별도 보존. 모든 구형 상충 완성률 문구보다 이 사용자 최종 정책 우선. [공통 최종설계 산정 규칙](https://github.com/hibi89/hackathon-command-center-2026/blob/kmong-productization/docs/strategy/FINAL_BLUEPRINT_COMPLETION_STANDARD_20261113.md). 정책 반영만으로 기존 제품 점수 재산정·기능 완료·배포 증명이 아니다.

> **[KMONG_WORK_TARGET_GATE_20261112 | 사용자 최신 확정 | 필수 작업 규칙]** 이 저장소에서 크몽 상품·육성 후보를 작업하는 모든 AI 담당자는 새 채팅·`ㄱ` 시작 시 이 문구를 읽고 적용한다.
> - 실제 개발/수정/테스트 착수 즉시 [해총 크몽 최종완성률·후보 상태표](https://github.com/hibi89/hackathon-command-center-2026/blob/kmong-productization/docs/audits/KMONG_16_CURRENT_20261111.md)의 **해당 상품명 옆에 `**[작업중]**`을 표시하고 GitHub 커밋**한다. 확정 단계 목표(예: 95%)와 검증 기준을 제품 STATUS/HANDOFF에 남긴다.
> - **목표 완성률 달성 전에는 [작업중]을 삭제하지 않는다.** 일시중단·종료·보류·다른 제품 전환·담당 채팅 변경도 삭제 사유가 아니다. 예전 '전환·중단 시 삭제' 지시는 폐기한다.
> - **검증된 목표치에 도달한 뒤에만** 기능 SHA·PASS/FAIL/SKIP·미검증을 기록하고 자기 표시를 제거·커밋한다. 목표 하향/변경으로 표식 제거 시 사용자 명시 승인 필요. 다른 담당자 표시·기존 수치·RELEASE HOLD 보존.
> - 표식은 목표 미달 상태를 의미하며 **실시간 실행 증명은 아니다**. 허브 최신 HEAD 확인 후 안전하게 반영, 실패 시 `KMONG_HUB_SYNC_PENDING` 기록. 자동 동기화 없음. 크몽 외 작업에는 표시 불필요.

> **2026-10-28 해총 전 저장소 최상위 공통 운영 공지 (소유자 승인):** [개발 가속·로컬검증·병목제거 통합 정본](https://github.com/hibi89/hackathon-command-center-2026/blob/main/docs/DEV_ACCELERATION_AND_VERIFICATION_20261028.md)을 새 채팅에서 먼저 확인한다. 현재 활성 개발 4개 슬롯은 **KIC(+DL)·PayPal·UGREEN·LA**만이다. 본 프로젝트는 **임시 개발 대기(폐기·브랜치 삭제 아님)**: 소유자 재개 지시 전 `ㄱ`으로 임의 기능 구현·CI·배포하지 않는다. 활성 총괄의 일반 구현·검증은 **GPT-6 Instant**, 최초 설계·고위험 문제·해총 감독은 높은 추론. 파일 단위 GitHub 왕복·다중 상태 문서 갱신·중복 CI를 축소하며 검증된 기능과 정확한 Git SHA/PASS·FAIL·SKIP만 보고한다. 기존 설계 동결·보안·고객 데이터·외부 서비스·금전/제출 승인 규칙은 유지한다. 본 공지는 제품 기능 변경이나 검증 완료가 아니다.

# Web REA Studio project rules

- ChatGPT designs, codes, tests and reviews; owner approves consequential steps and runs software on their own Windows machine.
- GitHub single source of truth: private repository `hibi89/web-rea-studio`. Do not modify other repositories or deployment connections.
- Before edits: inspect source, branches, backups and privacy. Avoid force pushes and history rewriting.
- P0 scope is an explicitly owned 127.0.0.1 fixture. No third-party site probing or auth bypass.
- Passive CDP evidence and active Playwright scenarios are different security boundaries. REA scenario provider does not itself implement an origin allowlist.
- Never commit credentials, cookies, session tokens or raw private evidence. Exclude results via .gitignore.
- Separate analysis jobs from read-only dashboards. Duplicate suppression, checkpoints and bounded action/API budgets for future phases.
- Two failed attempts without verified progress require diagnosis and a materially different alternative.
- Only claim capabilities backed by actual test outputs. Local HTTP tests do not prove a real REA browser run.

## Mandatory per-work-unit GitHub handoff (2026-10-17)

- **Read `HANDOFF.md` first at the start of every new chat/task.** Check the actual current `main` HEAD, relevant code and tests before deciding what is done.
- After **every completed bounded feature, bug fix, test, deployment or documentation task**, update `HANDOFF.md` **in the same work session** with what changed, evidence and limitations, exact tests/CI, unfinished work, the next action and any approval needed.
- Commit the handoff with the code or immediately afterward, then verify the published file, branch HEAD and actual CI/deployment status. If the GitHub documentation update fails, report that blocker and do not call the work fully complete.
- Keep current-status summaries in `README.md` and `STATUS.md` consistent with the handoff; preserve historical detail instead of erasing it.
- Do not insert a yet-unknown self-referential commit SHA into handoff content. Report the resulting SHA after GitHub returns it, and distinguish documentation-only CI from a code test run.
- Never treat reading older chat messages or a previous agent's report as verification of current code or deployed production.


## Product-first 3-mode MVP mandate (2026-10-18)

- The user has defined REA Studio as **one end-to-end 3-mode independent website builder**, not a collection of analysis/ZIP utilities. Authoritative scope: `docs/PRODUCT_CONCEPT_3_MODE_MVP.md`, then `REQUIREMENTS.md`.
- Modes: (1) high-fidelity independently implemented approximation of an authorized source site, (2) modified design/theme, (3) user's JSON/schema/instructions bound into the reference layout. Do not promise universal 99% parity or covert backend/DB copying.
- **Today prioritize** a single usable 3-mode Studio screen, shared saved-source blueprint, runnable standalone HTML previews and downloads and one whole-flow integration test. First build all sectors roughly and cross-link; refine details later.
- Avoid further narrowly scoped ZIP, hash, retry and passive diagnostic polishing **until all three modes produce usable end-to-end output**, except fixes required to make the MVP safe or testable.
- Reuse existing P4 geometry HTML, static analysis and Studio localhost server; maintain explicit allowlist/consent and honest mock/unverified labels. No new external URLs, credential handling, deployment or permission expansion without owner approval.
- Mandatory `HANDOFF.md` should report three-mode progress and current missing vertical slices, not just number of passing legacy tests.
