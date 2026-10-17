# Web REA Studio — 다음 채팅방 인계 지침서

> **최신 관리 스냅샷: 2026-10-17 (KST).** 새 대화에서는 실제 비공개 GitHub `main` HEAD와 이 문서를 먼저 대조한다. **품질 우선 Q0 기능 코드 기준 SHA는 `6ef1af91aa4c78853e64f9b384e2d93da7e89353`** (F5 전체 화면 비교·엄격한 관문·Studio UI·테스트). 코드 CI: https://github.com/hibi89/web-rea-studio/actions/runs/38995644114. 직전 핵심 비교 기능 SHA `846568bf34cf999783bb70a1554943d7019deb82`는 GitHub Node **168/168**·격리 Chrome P4/F2/P2-CORS/F4 전체 SUCCESS: https://github.com/hibi89/web-rea-studio/actions/runs/38995511999. 최신 코드 CI의 최종 상태는 이 문서 확인 시 재조회할 것. 이후의 문서 전용 커밋 SHA는 별개이며, 문서가 자기 자신의 SHA를 예측해서는 안 된다. 실제 사용자 Windows에서 저장된 실패 기록을 읽거나 외부 대시보드 데이터 로딩에 성공한 사실은 **아직 없다**.

## 0. 시작하는 AI를 위한 필수 순서

1. GitHub 비공개 저장소 `hibi89/web-rea-studio`의 실제 `main` HEAD, 최근 커밋, 파일 트리, CI 상태를 조회한다. 기억이나 이전 채팅 보고만 믿지 않는다.
2. **이 `HANDOFF.md` 전체를 먼저 읽는다.** 다음으로 `AGENTS.md`, `REQUIREMENTS.md`, `STATUS.md`, 해당 기능의 `docs/*` 및 실제 소스/테스트를 확인한다.
3. `HANDOFF.md`의 마지막 스냅샷과 현재 코드가 다르면 실제 코드를 우선으로 삼고, 불일치를 명시하여 이 문서를 고친다.
4. 사용자 승인 없이는 기존 GitHub 저장소 외 프로젝트 변경, 대외 공개, 승인되지 않은 사이트의 능동 조작, 인증 정보 외부 전송, 유료 서비스, Vercel 연결/환경변수/도메인 변경을 하지 않는다.
5. **기능 작업 하나를 끝낼 때마다 코드·테스트 검증 결과와 함께 이 문서를 반드시 같은 작업 세션에서 갱신·GitHub 반영한다.** 업데이트가 실패했다면 기능 완료라고 보고하지 않는다.

## 1. 프로젝트 정체성과 목표

- 이름: **Web REA Studio**, 비공개 로컬 우선 웹사이트 역공학/독립 재구현 제품.
- 장기 제품 목표: **URL 입력 → 허가된 사이트 탐색 → 조작·상태·API 증거 수집 → 구조/기능 명세 → 독립 코드 생성 → 원본/생성본 비교·수정 → 결과물 내보내기**.
- 단순 스크린샷 모사 도구가 아니라 **Autonomous Exploration / Evidence-to-Code / Closed-loop Verification**을 지향한다.
- **F1~F5는 제품 기능 분류**, P0~P5는 역사적 개발 단계/마일스톤이다. 둘을 같은 진척률로 계산하지 않는다. 초기 로드맵과 실제 구현 범위도 분리한다.
- 확장 아이디어(현재 범위 밖): 데스크톱 앱, 모바일 앱, 게임. 현재 범위는 웹사이트뿐이다.

| 제품 기능 | 목표 | 2026-10-17 확인된 구현 범위 | 미완성 경계 |
| --- | --- | --- | --- |
| F1 자동 탐색 | 화면 요소 탐색·행동 선택 | DOM 컨트롤 인벤토리, 크기/역할 탐지; 승인된 **합성 Chrome 픽스처**에서 안전한 액션 탐지와 상태 경로 계획 | 일반 외부 사이트의 자율 클릭/범용 크롤링 아님 |
| F2 관계 분석 | 액션→상태/API 관계 증명 | 합성 `catalog`/`analytics`에서 단일 행동별 상태 전이·합성 API 경로 관찰, 기능 그래프 및 재생 경로 검증 | 외부 사이트의 실제 버튼별 API 인과관계 미검증 |
| F3 구조 해석 | 증거·미확인사항 명세 | 결정적(evidence-driven) `manifest.json`, 관찰 상태/컨트롤/의존성 요약 | 일반 LLM에 의한 원본 백엔드/DB 추론 엔진 아님 |
| F4 독립 코드 | 실행 가능한 독립 UI 생성 | 정적 HTML, 합성 증거로 만든 독립 JS 상태 머신/분기형 HTML, 별도 Chrome 재생 검증 | 외부 사이트의 완전한 기능/백엔드 복제 미구현 |
| F5 검증·수정 | 원본/생성본 비교·자동 수리 | P4/P5 시각·기하 비교 관련 모듈과 제한된 Chrome 비교 테스트 존재 | 일반 사이트에 대한 폐루프 자동 수정 미완성 |

## 2. 실제 관측 상태 — 성공/실패를 혼동하지 말 것

- **Windows P0/P1 완료 관측:** 사용자의 Windows에서 고정 로컬 픽스처 REA 6.5.0 + Chrome 시나리오 `COMPLETED / PASS`, 7/7 단계, HTTP 200, PNG 및 인스펙터 확인(2026-10-16). 이 성공은 외부 사이트 증명이 아니다.
- **실제 정적 HTTPS 분석:** 사용자 선택 대상 `https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/`의 한정적 정적 분석을 Windows에서 통과한 기록이 있다.
- **동적 실제 사이트 렌더링 문제 미해결:** 외부 앱 캡처는 되었으나 앱 화면에는 `Failed to fetch`/`보고서를 불러오지 못했습니다`가 표시되었다. 진단 코드 `PASSIVE_EXTERNAL_FETCH_REJECTED`. PNG 저장이나 `COMPLETED`만으로 화면 성공을 선언하지 않는다. 외부 리소스/CSP/중계 정책 관련 원인 후보는 있으나 실제 원격 서버/CORS 원인까지 확정된 것은 아니다.
- **F1/F2 최근 진전:** `f91d434...` (2026-10-17)에서 관찰 상태 노드/액션 그래프, BFS 경로, 커버리지 검증, `function-graph.json` 내보내기를 추가했다. 관찰된 합성 상태 전이의 커버리지 100%는 미관찰/실제 사이트 커버리지를 뜻하지 않는다.
- **F4 합성 검증:** 독립 HTML의 분기형 상태 머신을 `catalog`와 `analytics`라는 두 가지 메모리 내 합성 앱의 별도 Chrome 재생으로 확인. 시뮬레이션 API 카운터이며 실제 외부 네트워크 호출은 없다.
- **GitHub CI:** P5 품질 관문 핵심 SHA `846568bf34cf999783bb70a1554943d7019deb82` 전체 SUCCESS (Node 168/168, 격리 Chrome P4/F2/P2 CORS/F4): https://github.com/hibi89/web-rea-studio/actions/runs/38995511999. 이후 UI/테스트 포함 코드 SHA `6ef1af91aa4c78853e64f9b384e2d93da7e89353`, 별도 CI https://github.com/hibi89/web-rea-studio/actions/runs/38995644114. 확인 전 성공으로 단정하지 않는다. `npm test` + 격리 Chrome P4/F2/F4 검증을 워크플로에 포함한다. CI 성공 ≠ 사용자 Windows/공개 Production 성공.
- **P2 두 출처 합성 브라우저 검증:** `studio/synthetic-cross-origin-browser.mjs` 및 `tests/p2-cross-origin-chrome-e2e.mjs`. 실제 Chrome에서 ① 기본 외부 API 차단→fetch 실패, ② CSP 허용·CORS 부재→fetch 실패, ③ CSP 허용·정확한 CORS 응답→합성 JSON 표시 성공을 확인했다. **인터넷 API 호출 0건**, 원래의 `dynamic-gateway.mjs`/`dynamic-browser.mjs`/실제 허용목록/CSP는 변경하지 않았으며 실대상 복구 증거는 아니다.
- **Q0 품질 관문:** P5 v2 `studio/p5-visual-diff.mjs`는 이전의 고정 우하단 영역 제외를 폐기하고 전체 화면의 모든 샘플을 비교한다. 크롭·누락 픽셀은 최대 RGB 오차 255로 반영하고 비교 면적/해상도/기하 판정을 분리한다. 게이트 기본값은 동일 크기/100% 표본 커버리지/픽셀 일치율 90% 이상/RGB MAE 20 이하/기하 영역 70% 이상이며 PASS라도 `VISUAL_THRESHOLD_MET_STATIC_ONLY`, `product_ready=false`. 합성 Chrome 화면 1440×1550 기준 일치율 **99.37%**, 전체 커버리지 100%, 기하 영역 100%, RGB MAE **0.94**, 기능 동일성 미검증. 이전 저장 P5 v1 결과는 소급 변경하지 않는다.
- **Vercel:** `preview/`는 실 분석 엔진 없는 정적 목업용이며 `docs/PUBLIC_PREVIEW.md`를 참고한다. 이 인계 시점에는 Production URL/배포 SHA 및 실제 공개 동작을 별도로 확인하지 않았으므로 미검증이다. 배포 연결/설정을 임의로 변경하지 않는다.

## 3. 중요 저장소 구조

| 경로 | 용도 |
| --- | --- |
| `studio/server.mjs`, `studio/start.mjs`, `studio/public/*` | Windows 로컬 Studio 서버, 실행/조회 API, 사용자 UI |
| `studio/dynamic-browser.mjs`, `studio/dynamic-gateway.mjs`, `studio/static-analysis.mjs` | 허가된 사이트 정적/수동 동적 관측과 중계·격리 |
| `studio/synthetic-cross-origin-browser.mjs` | 두 통제된 HTTPS 출처를 Chrome CDP로 메모리 내 응답 처리하는 실험 전용 코드. 실제 서비스에는 연결되지 않음 |
| `studio/support-packet.mjs` | 저장된 실패 기록에서 개인정보 최소화 공유용 원인 분석 패킷; 원격 요청 없음 |
| `studio/passive-blueprint.mjs`, `studio/passive-dependencies.mjs` | 저장된 외부 사이트 F1/F2 읽기 전용 통합 명세와 API 그룹 분류 |
| `studio/observed-controls.mjs`, `studio/behavior-exploration.mjs`, `studio/generic-fixture-browser.mjs` | F1/F2 컨트롤 관측, 합성 상태 그래프 및 경로 검증 |
| `studio/p5-visual-diff.mjs`, `studio/p5-geometry-diff.mjs` | F5 전 화면 시각/도형 비교, 품질 관문 측정 (기능 증명과 분리) |
| `studio/evidence-manifest.mjs`, `studio/interaction-blueprint.mjs` | F3 증거 기반 산출물 |
| `studio/behavior-reconstruction.mjs`, `studio/generic-behavior.mjs`, `studio/p4-reconstruction.mjs` | F4 코드/상태 머신 재구성 |
| `studio/p5-visual-diff.mjs`, `studio/p5-geometry-diff.mjs` | 제한적 시각/위치 비교 |
| `fixtures/site/*`, `tests/*`, `scripts/*` | 승인된 로컬 테스트 사이트, 자동 테스트, 진단 |
| `config/approved-targets.json` | 명시적 허가를 받은 정적 대상 목록. 타 호스트 자동 승인 금지 |
| `preview/*`, `deploy/*` | 정적 공개 프리뷰와 별도 배포 보조 코드. 로컬 분석 서버와 혼동 금지 |
| `.github/workflows/local-studio-ci.yml` | Node 22 및 격리 Chrome 회귀 테스트 |
| `AGENTS.md`, `REQUIREMENTS.md`, `STATUS.md`, `docs/*` | 운영 원칙, 요건, 개발 이력, 범위별 증거/제약. 이 파일이 최신 총괄 관문 |

## 4. 실행 경로와 보안

- 소스는 private GitHub가 기준이다. 사용자 실제 Windows 실행 외에는 ChatGPT가 코드 검토/수정/테스트/커밋/CI 확인을 맡는다.
- Windows 시작: `git pull --ff-only` → `npm test` → `npm run check:launcher` → `npm run studio` → `http://127.0.0.1:4320/`.
- 로컬 고정 REA 픽스처: `http://127.0.0.1:4317/`. 합성 F2/F4 테스트도 일반 외부 사이트 액션 모드와 **명확히 구분**한다.
- REA 고정 버전 `rea-agents@6.5.0`; Windows `npx.cmd` 인용부호 오류 때문에 직접 `npx-cli.js` 런처 경로 사용. Windows REA 실행은 CI와 별개로 검증한다.
- 사용자 데이터/스크린샷/실행 기록: `%LOCALAPPDATA%\WebREAStudio\runs`. OneDrive 소스 저장소 내부에 넣지 않는다. 기존 데이터 삭제/덮어쓰기 전 복구 경로 확인.
- GET 화면 조회/이력/다운로드는 저장 결과만 읽고 재분석하지 않는다. 새 분석은 명시적으로 요청한 POST 작업만 수행. 동시에 한 작업만 실행.
- 외부 HTTPS 정적/수동 브라우저 분석은 정확한 승인 URL에만 적용. 외부 사이트 자동 클릭/폼 제출, 인증 우회, 임의 크로스오리진 허용, 무제한 프록시/와일드카드 허용 금지.
- 비밀번호, 토큰, 쿠키, 원본 프라이빗 증거, 쿼리 문자열, 폼 값을 GitHub/보고서/공개 프리뷰에 노출하지 않는다.
- 외부 백엔드 호스트 승인이나 API 비용/쿼터, 권한/환경변수 변경이 필요하면 **근거와 위험을 먼저 설명하고 사용자 명시 승인**을 받는다.

## 5. 다음 구현의 우선순위와 완료 판정

**새 제품 출하 계약:** `docs/QUALITY_FIRST_ROADMAP.md`를 전체 품질 기준의 1차 문서로 사용. Q0(가짜 높은 시각 점수 제거) → Q1(실제 허가 사이트 데이터·호스트 권한 확정) → Q2(실제 F1~F3 비파괴 행동 증거) → Q3(독립 실행 F4) → Q4(자동 반복 수정 F5) → Q5(서로 다른 실제 허가 사이트 3곳 이상에서 성공 및 제품화). 높은 유사도 수치·합성 픽스처의 100% 상태 커버리지로 범용 제품 완성을 주장하지 않는다. 단계별 실제 출력과 독립 Chrome 재현이 완료 조건이며 기간보다 품질을 우선한다.


1. **실제 사이트 관측 진단:** 이미 저장한 `PASSIVE_EXTERNAL_FETCH_REJECTED` 이벤트를 재실행 없이 먼저 확인. 차단된 요청의 종류/호스트 관계를 비민감 메타데이터로 정리하고 기존 허용 정책을 함부로 완화하지 않는다.
2. **승인된 비파괴적 관측 설계:** 읽기 전용 네트워크·DOM 증거를 우선 개선. 능동 제어가 필요하면 승인된 컨트롤/동작, 요청 상한, 데이터 비파괴성, 복구, 중복 실행 정책을 먼저 설계한다.
3. **외부 사이트에 F1~F4 단계적으로 적용:** 관찰 사실/추측을 분리한 명세 → 재구현 → Chrome 행동 비교. 실제 API·데이터·로그인 동일성은 입증한 범위에 한하여 주장한다.
4. **F5 비교/수정 루프:** 시각 및 기능별 실패 증거, 수정 후 회귀, 결과물 내보내기. 테스트 픽스처와 실제 허가 사이트 모두에서 성공 범위를 별도 기록한다.
5. **완료 조건:** GitHub HEAD 및 코드 테스트, 적절한 경우 CI 통과, 실제 실행 기능 확인, 요구 시 Vercel Production SHA·HTTP·브라우저·보안 검증. 미확인 항목은 반드시 `부분 완료/검증 대기`로 적는다.

기본 접근 2안: **A. 합성 픽스처에서 안전한 수직 기능 확장**(저비용/확실한 회귀, 범용성 제한) / **B. 명시적으로 승인된 외부 사이트를 수동 증거부터 단계 확장**(실용성 증가, 브라우저 격리/권한/API 리스크 증가). 현재는 A의 회귀 안정성을 유지하면서 B를 read-only 단계부터 시도하는 혼합 접근을 권장하며, 위험 범위 확대 전 승인을 받는다.

## 6. 작업 단위 종료 시 의무 인계 업데이트

다음 기준은 **매 기능 수정/버그 수정/테스트 보강/배포 단계**마다 적용한다. 사용자는 다음 채팅방에서 이 한 파일만 보고 이어서 작업할 수 있어야 한다.

- **먼저 소스 확인:** 작업 시작 전 `main` HEAD, 관련 파일, 기존 동작, Git/배포 설정 확인. 사용자 데이터 백업/복원과 영향 범위 확인.
- **구현 및 검증:** 변경 파일, 변경 이유, 자동 테스트 숫자·실패 사례, GitHub CI URL, Chrome/Windows/Production 검증 수준을 분리해서 기록.
- **동일 작업의 마지막에 `HANDOFF.md` 갱신:** 방금 완료한 것, 미완성/막힌 것, 실패 근거, 재현법, 다음 단일 우선 작업, 외부 승인 필요 여부, 최신 코드 기준, 새 커밋/배포 링크를 갱신한다. 자신이 추가되는 커밋 SHA를 사전에 예측하지 않는다. 커밋 후 실제 SHA를 최종 보고하거나 필요시 다음 인계 갱신에 기록한다.
- **일관성 확인:** `STATUS.md`의 최신 요약과 `README.md`의 핵심 기능/제약이 인계서와 충돌하지 않도록 필요한 최소 수정만 한다. 과거 이력은 삭제하지 않는다.
- **GitHub 반영:** 문서 업데이트를 코드 변경과 같은 커밋에 넣거나 바로 이어지는 커밋으로 `main`에 반영한다. 변경 전에 현재 HEAD를 확인하고 force push/기록 재작성 금지.
- **완료 검증:** 커밋 SHA와 `main` 최신 HEAD, `HANDOFF.md` 실제 파일 본문, CI 상태를 확인한다. 별도 Vercel 배포가 있으면 Production 커밋 SHA도 확인한다.
- **진전 없는 2회 실패 시 Stop & Pivot:** 시도/실패 근거/다른 접근(품질·비용·시간)/사용자 선택을 기록한다. 무한 재시도 금지.
- **도구에 접근할 수 없는 새 대화:** 기존 지침서를 읽거나 GitHub 갱신할 수 없는 상태를 솔직히 알리고, 근거 없이 '동기화 완료'라고 주장하지 않는다.

### 인계 업데이트 로그 (최신을 위에)

| 날짜(KST) | 작업 | 확인된 결과 | 남은 과제 |
| --- | --- | --- | --- |
| 2026-10-17 | Q0 F5 과대평가 제거·품질 우선 계약 | 코드 `6ef1af91...`: 잘린 스크린샷 겹침만 100%였던 오판정 제거, 표본 누락 최대 오차·기하/커버리지 판정·구버전 표시, 부정 테스트 및 실제 Chrome 체크, `docs/QUALITY_FIRST_ROADMAP.md`. 핵심 SHA `846568bf` CI `38995511999` 전체 SUCCESS; 최신 UI 코드 `6ef1af91` CI `38995644114` 별도 상태 확인 필요 | 실제 웹사이트 Q1 데이터 로딩/실제 독립 앱 미해결. 과거 P5 v1 보고서 소급 변경 금지 |
| 2026-10-17 | P2 실제 Chrome 두 출처 CSP·CORS 검증 | 코드 `d96ea6df`, CI `38994833194` 전체 SUCCESS. 기본 차단/허용·CORS 누락/양쪽 충족 3경우 Chrome 성공적 판별. 모든 응답 메모리 합성·실제 외부 호출 0건 | 실대상 서버/CORS 검증과 API 호스트 권한 승인은 별도. Windows 과거 실패 데이터 `support-packet` 확인이 다음 단계 |
| 2026-10-17 | P2 개인정보 최소화 실패 진단 패킷 | 실패/중단된 기존 passive run에서 진단 코드, 요청·거부 수치, 호스트명, 경로 유형만 결합한 `support-packet` JSON 다운로드·UI·단위/HTTP 테스트 추가. 스크린샷·입력값·원본 URL·본문 제외, 외부 재요청 0건 | 코드 `9d4bcf36` 및 GitHub Actions `38994454894` 전체 SUCCESS 확인; 사용자 Windows 기존 실패 기록의 패킷 실제 열람·공유 전 점검 필요 |
| 2026-10-17 | F1/F2 읽기 전용 관찰 명세 | 코드 `4a2031bd54a7b833efc9a26555b30df3c61eaa9c`, CI `38994112399` 전체 PASS. 저장된 컨트롤·API 관찰 증거 통합 JSON API·Studio 링크·회귀 테스트, 외부 호출·클릭 및 검증된 인과관계 0건 | 사용자 Windows 실기록/실화면 검증 필요; 실제 `Failed to fetch` 미해결 |
| 2026-10-17 | P2 저장된 API 의존성 화면 연동 | 실패 진단에서 허가된 경로·외부 호스트 증거를 최대 10개 표시하고 JSON 다운로드. 코드 `e1063bb0`, GitHub Node·Chrome CI 전체 success 확인 | 사용자 Windows의 과거 캡처 확인과 실제 API 연결은 미검증 |
| 2026-10-17 | P2 읽기 전용 API 의존성 리포트 | 저장된 네트워크 이벤트를 내부 경로/외부 호스트별 그룹화한 JSON 엔드포인트와 테스트. 코드 `45899e9b`, GitHub Node·Chrome CI success 확인 | Windows 저장 기록에서 검증, 외부 API 권한 검토 대기 |
| 2026-10-17 | P2 저장된 실패 진단·호스트 권한 검토 개선 | 동일 호스트 fetch 시도+거부 증거로만 미승인 후보 표시, 핵심 리소스 차단·호스트 미확인 오류 구분, 추가 접속 없음 | 사용자의 저장된 Windows 실패 기록에서 확인하고 권한 별도 검토 필요 |
| 2026-10-17 | P2 실제 앱 상태 판정 보강 | 화면 오류 문구 없이도 JS fetch 거부/핵심 Document·Script·XHR·Fetch 리소스 차단 시 FAIL 판정하도록 코드·테스트 추가. 기존 허용 정책 변경 없음 | 저장된 과거 보고서는 소급 변경되지 않음; 실제 Windows 캡처 검증 대기 |
| 2026-10-17 | 제작방 2 인계 체계 구축 | 과거 기록 + 현재 GitHub 트리/HEAD/CI를 대조; `HANDOFF.md` 작성 및 AGENTS/README/STATUS 연결을 문서 변경으로 적용 | 다음 기능 작업 전 최신 HEAD 조회; 외부 사이트 `Failed to fetch` 문제 미해결 |
| 2026-10-17 | F1/F2 상태 그래프 | 코드 커밋 `f91d434...`; GitHub Node+Chrome CI 성공 | 외부 URL에서 비파괴 조작 및 API 인과관계 미검증 |
| 2026-10-16 | 실제 사이트 P2 동적 캡처 | PNG 및 오류 진단 저장 | 앱 `Failed to fetch`, `PASSIVE_EXTERNAL_FETCH_REJECTED` 미해결 |

### 다음 세션 첫 작업 (마지막 작업 이후 갱신 필요)

다음 작업의 조건: 우선 **`docs/QUALITY_FIRST_ROADMAP.md`의 Q0 F5 정직한 품질 판정**을 유지한다. 전체 시각 게이트 PASS는 정적 증거일 뿐 작동하는 웹사이트 인증이 아니다. 사용자는 장기간이 걸려도 **실제로 작동하는 품질**을 우선하고, GitHub 테스트/인계서 업데이트는 매 단위 필수다. **Q1 실데이터 시도를 승인 없이 시작하지 않는다.** 두 출처 실험은 **브라우저 통신 메커니즘만 검증**했으므로, 실제 인터넷 API나 확장된 CSP/relay를 배포하지 않는다. 사용자 소유/허용 범위, 실제 host·method·path, 데이터 보유·요청 상한, DNS/TLS/인증/리다이렉트 위험을 검토하고 명시적으로 승인받기 전에는 네트워크 범위를 넓히지 않는다.

현재 기본 우선순위는 **Windows 로컬 Studio의 기존 실패한 passive 분석 이력에서 `안전 진단 패킷 JSON`(GET `/api/runs/:id/support-packet`)을 확보하여 민감정보 제외 여부를 검토하고 `passive-blueprint` 및 `/dependencies`와 비교하여 외부 사이트 실패 이벤트 증거 확인 → 원인별 안전한 접근 설계 → 사용자 승인 범위 안에서 최소 수정·회귀 검증**이다. 실제 사용자가 더 높은 우선순위를 지시하면 해당 지시와 최신 소스를 우선한다. 기존 정상 기능, 로컬 실행 데이터, Vercel 설정, 개인정보를 보존한다.

## 7. 중요 링크

- 저장소: https://github.com/hibi89/web-rea-studio
- 이전 기능 기준 커밋: https://github.com/hibi89/web-rea-studio/commit/e1063bb07c73b26356f319298ff1d1b621ce2349
- 이번 최신 기능 코드 기준: https://github.com/hibi89/web-rea-studio/commit/6ef1af91aa4c78853e64f9b384e2d93da7e89353
- 핵심 F5 비교 코드의 확인된 성공 CI: https://github.com/hibi89/web-rea-studio/actions/runs/38995511999
- 최신 UI 포함 코드 CI (상태 재확인): https://github.com/hibi89/web-rea-studio/actions/runs/38995644114
- 실제 분석 대상: https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/
- 품질 최우선 최종 완성 기준: `docs/QUALITY_FIRST_ROADMAP.md`.
- 새 P2 합성 CSP/CORS 실험과 실환경 제약: `docs/P2_SYNTHETIC_CORS_LAB.md`.
- 새 안전 진단 패킷 및 Windows 확인 절차: `docs/P2_SUPPORT_PACKET.md`.
- F1/F2 통합 관찰 명세: `docs/F1_F2_PASSIVE_BLUEPRINT.md`.
- 신규 API 의존성 리포트: `docs/P2_DEPENDENCY_REVIEW.md`.
- 개발 근거: `docs/F1_F2_STATE_GRAPH.md`, `docs/F1_F2_PERMISSION_PREFLIGHT.md`, `docs/F2_CONTROLLED_CHROME.md`, `docs/F4_GENERIC_STATE_ENGINE.md`, `docs/P2_DYNAMIC.md`, `docs/PUBLIC_PREVIEW.md`.
