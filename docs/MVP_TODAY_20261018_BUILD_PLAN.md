# REA Studio — 2026-10-18 당일 실행 MVP 최종 제작 명세

**상태:** 구현 지시서/합격 기준. 설계가 완성됐다는 것은 프로그램이 구현됐다는 뜻이 아니다.
**저장소:** `hibi89/web-rea-studio`, 개발 전용 브랜치 `mvp-three-mode-20261018` (기존 `main` 보존).
**사용자 제품 비전:** 소유하거나 허가받은 사이트 1개의 입력으로 (1) 원본형 독립 재현, (2) 디자인 변형, (3) 사용자 데이터/스키마를 적용한 새 사이트를 만든다. 장기 99% 재현은 사이트·페이지·상태별 검증 목표이며 범용 보장 불가.
**오늘:** 실제 URL 1개에 대해 원본과 닮은 독립형 웹페이지를 생성·실행한다. **시각 유사도 70~80%를 우선 목표**로 하고, 동일 관찰 정보로 MODE 2, MODE 3을 실제 작동시킨다. 실제 기능/데이터 접근 실패 시 독립 구현으로 합리적으로 유사한 사용자 동작을 설계한다. 기능을 모른다는 이유만으로 UI 생성 중단 금지. 원본 기능으로 검증하지 않은 동작에는 `INFERRED`/`MOCK` 명시.

## 이번에 왜 기존 코드를 계속 쓰는가
- 기존 `studio/server.mjs`: localhost API, 허가 URL/원본 저장, 실행 이력과 기존 요청 보안.
- `studio/dynamic-browser.mjs`: 승인된 URL의 Chrome 렌더링 및 수동 관찰 경로. JS 자원 차단으로 실제 화면이 불완전할 수 있으므로 오류를 숨기지 않는다.
- `studio/p4-reconstruction.mjs`: computed geometry probe, HTML/CSS 도형 초안. 현재는 글자/차트/이미지/동작 재현에 한계가 있으므로 **완성형 품질이라고 주장하지 말고 확대**.
- `studio/p5-visual-diff.mjs`: 실제 캡처와 생성 캡처 비교/정량 평가. 독립 Chrome 재렌더에 연결.
- `studio/public`: 기존 UI. 별도의 단순 제작 화면을 새로 만들고, 기존 디버깅 UI는 보조 탭으로 둔다.
- `config/approved-targets.json`에는 실제로 `https://daily-dashboard-ldh-1013.clevertide128.chatgpt.site/`가 저장돼 있음. 해당 사이트를 **승인된 단일 데모 URL 후보**로 삼되, 권한이 여전히 유효한지/사용자가 소유·관리하는지 확인하고, 다른 URL은 추가 허가 전 자동 방문하지 않는다.
- 새로운 리포지토리나 Vercel 배포는 당일 MVP에 불필요. 현재 사용자의 Windows 로컬 Node 서버에서 먼저 성공시킨다.

## 최종 사용자에게 보일 하나의 화면
`http://127.0.0.1:4320/mvp` (별도 로컬 뷰; 기존 `/` 대시보드 유지):
1. **① URL / 현재 저장된 관찰 선택** — 직접 입력/허가 표시, `화면 관찰` 버튼, 실패 사유 및 권한.
2. **② 원본/목표 참조** — 사이트 자체의 실제 렌더링 캡처·DOM 추출 상태·뷰포트·신뢰도·누락 이유. JS 차단 정적 스크린샷을 정상이었다고 표시하지 말 것.
3. **③ 제작 모드 탭** — Original(원본형), Remix(디자인 테마·사용자 설명), My Data(사용자 schema/JSON 예제, 요구사항).
4. **④ Build** — 명시적 클릭으로 실행. 상태 `queued → observed → blueprint → rendered → compared` 단계 표시. 실패 단계는 오류/대체 경로 제공.
5. **⑤ 두 화면 나란히** — 동일 1440×900 원본 스크린샷과 **별도 생성 코드로 실제 렌더한** 결과/비교 표시. 화면 캡처를 배경에 통째로 깐 가짜 HTML은 금지.
6. **⑥ 다운로드** — mode1.html, mode2.html, mode3.html 각각 독립 실행 가능 파일, blueprint.json, comparison.json(현재 측정 근거 포함).
7. 왼쪽 debug/evidence 링크는 유지하되 기본 화면에 수십 개 보안·ZIP·검증 버튼을 늘어놓지 않는다.

## 소스 수집: F12(DevTools) 포함 다중 경로, 실패 시 피벗

### Capture A — 렌더된 사이트 우선
사용자가 통제하는 Chrome/Playwright/CDP에서 승인된 URL을 탐색, 1440×900 화면 캡처와 실제 computed DOM 수집.
- 메인 레이아웃: 가시 요소의 type/tag/role, bounding client rect, computed display/position, grid/flex, padding/margin, font family/size/weight/line-height, background/color/border/radius/shadow/gradient/opacity 등.
- 안전한 화면 문구·제목, 표·차트·카드 구조, logo/icon/image의 **허가된 공개 리소스**, CSSOM safe rules, accessibility tree 의미.
- 이미지/폰트/차트 canvas/svg는 가능한 범위에서 별도 자산으로 처리. 이미지가 단순 원본 screenshot/iframe이면 독립 구현으로 계산 금지.
- 네트워크 DevTools 관찰은 `request URL path / method / timing / response shape` 정도만 권한·사생활을 지켜 관찰. 쿠키/세션/개인 데이터/credential/비공개 응답 본문 수집 금지. 원본의 JS 소스코드나 API/DB 자체의 획득을 필수로 하지 않는다.
- 클릭/입력/로그인/구매 등 활동은 기존 읽기 전용 범위를 임의 확대하지 말 것. 행동 테스트가 허용된 통제 테스트에 한해 before/after 상태를 저장한다.

### Capture B — DevTools export 대체
사이트 JS 혹은 승인된 리소스가 차단되어 화면이 오류/백지로 나오면 **같은 수단 재시도 최대 2회**. 원인 표시 후 안전 대체:
- 사용자가 본인 소유/허가 사이트 Chrome F12 화면에서 **실제 렌더 완료 상태의** computed DOM geometry/색/폰트/접근성 스냅샷을 생성하여 **로컬 JSON 입력**으로 전달. 신뢰 민감 정보 마스킹/검토 후 수집, 브라우저를 불필요하게 원격 디버깅에 노출하지 않는다.
- 사용자가 제공한 페이지 스크린샷 + 마스킹된 정적 HTML/CSS + 이미지 자산을 사용한 독립 UI 추정. screenshot-only는 요소 위치/디자인 유사도에는 쓰되 **실제 DOM/JS 기능 재현 증거로 삼지 않는다**.
- 자동 관찰 실패 시 대상 사이트가 이미 로컬로 저장된 run인 경우 `inspection.page.reconstruction_blueprint`, 캡처 PNG와 HTML 소스 분석 정보를 결합한다.
- 직접 URL만으로 아무 데서나 동작한다고 과장하지 말고, 도달하지 못한 부분은 상태 `NEEDS_SOURCE_RENDER` / `MISSING_ASSET`로 표시.

### Capture C — 구조/기능의 독립 추론
코드가 보이지 않아도 화면에서 **보인 컴포넌트**를 독립 React/HTML/CSS/JS 구현으로 대체:
- 목록/필터/탭/정렬/차트/폼/네비게이션은 시각/접근성/표시 데이터 근거로 일반 사용자 동작을 구현. 원본 숨겨진 함수·서버 로직을 아는 척하지 않는다.
- 사용자 데이터나 스키마가 없으면 명시적 DEMO/MOCK 데이터; 임의 외부 API endpoint로 요청하지 않는다.
- 기존 REA 메커니즘이 어렵거나 과도하면 F12 snapshots, Playwright/CDP, HTML parser, computed CSS, 스크린샷 검사를 적절히 조합하고, 수집 성공률·시간을 우선한다.

## 공통 데이터 계약
```
CaptureEvidence = {
 run_id?, target_url?, source_scope, authorized: boolean,
 viewport: {width:1440,height:900}, screenshot_path?,
 nodes: [{id,tag,role,box,style,text?,asset?,confidence,origin}],
 controls:[{id,kind,label?,observed_effect?,inferred_effect?,status}],
 assets:[{id,source,usage,permission}], warnings:[]
}
Blueprint = {
 version:1, viewport, body, regions, components, style_tokens,
 observed_behaviors, inferred_behaviors, unknowns, provenance
}
BuildInput = {blueprint,mode:"faithful"|"remix"|"schema",
 theme?,requirements?,schema?,sample_rows?}
BuildOutput = {mode,html_path,preview_path,comparison,unknowns,
 evidence_status,sha256,source_independent:true}
```
원본의 민감한 URL query, secret, session은 산출물/커밋에 포함하지 않는다. JSON은 로컬만 처리.

## MVP 실제 생성 로직 (중요)
1. **layout segmentation:** raw screenshot만 띄우지 말고 DOM+computed rect+관찰된 자산으로 header/nav/sidebar/cards/charts/tables/hero/footer를 컴포넌트 분류하고 box hierarchy 구성. 요소 충돌/중첩과 원본 뷰포트 기록.
2. **faithful renderer:** 빠른 화면 충실도를 위해 `1440×900` 첫 화면에 한해 measured rectangle anchors + CSS Grid/Flex/absolute를 혼합. 자주 보이는 UI의 실제 텍스트, 색, 폰트, 간격, 카드/테두리, 허가된 이미지/아이콘을 가능한 범위에서 재현. 차트 엔진 못 찾으면 원본 소스를 복사하지 않고 SVG/CSS/Canvas로 **동일 모양의 독립 차트**를 그린다. 차트 값은 관찰/제공/모의 중 무엇인지 명확히 표시.
3. **remix renderer:** same component tree, 다른 `DesignTokens`(colors, font, radius, spacing, card layout). 적어도 다크/라이트 또는 프리미엄 리믹스가 원본과 눈에 띄게 달라져야 한다.
4. **schema renderer:** 사용자의 `columns/types/sample_rows`와 설명을 읽어 sidebar/cards/KPIs/table/chart/filters를 해당 데이터로 바인딩; 열 바뀌면 화면과 값이 바뀌고 최소 1개 독립 UI 동작(검색/정렬/탭)이 작동해야 한다. 프런트엔드 local state+JSON으로 구현해 원본 backend와 결합 금지.
5. **browser preview:** 빌드 파일을 격리된 localhost에서 로드해 생성물의 실제 DOM, JS 실행과 화면 캡처를 확인. 결과 화면은 원본 스크린샷 그대로 복사한 이미지면 자동 FAIL.
6. **closed-loop correction:** 같은 뷰포트의 source/reconstruction PNG를 비교 → 차이가 큰 상위 3~5개 영역을 선정 → style/box/asset 값 수정 → Chrome 재촬영. 수정 전후 개선이 **실측**되어야 개선으로 기록. 최대 2회 동일 시도 실패 시 원인/대안 제시.

## 유사도 목표와 판정 (허위 '99%' 금지)
- **오늘 목표:** 소유/승인된 데모 URL, 데스크톱 단일 뷰포트에서 주관적 시각 유사도 70~80% 이상에 도전. 모바일과 로그인/실데이터 패리티는 오늘의 필수 범위 아님.
- 실제 숫자를 내세울 때는 원본과 독립 앱의 **같은 해상도/같은 스크롤 상태/같은 데이터 표기**의 Chrome screenshots로 비교. 기존 P5 full-canvas MAE, pixel match, geometry coverage를 함께 노출. 가능하다면 SSIM 별도 측정하되 *SSIM 0.8 ≠ 원본 기능 80% 복제*임을 명시.
- 픽셀 매치·SSIM·수작업 품질평가 중 어느 것도 없이 '70% 성공', '99% 완성'을 말하지 않는다.
- 참조 브라우저가 실제 JS 오류 화면이면 정상 사이트를 봤다는 근거가 아니며, 그런 캡처에 대한 높은 일치율로 성공 처리하지 않는다.
- 타사 소스 로직/DB를 훔칠 필요는 없다. UI 기능은 동등한 인터페이스를 **독립적 구현**하면 된다. 단 관찰되지 않은 원본 기능의 일치를 주장하지 않는다.

## 시간 한정 작업 순서 (오늘)
| 단계 | 기준 시간 | 사용자에게 실제 보일 결과 |
| --- | --- | --- |
| 0. 기존 main 보존·전용 브랜치 | 15분 | 개발 브랜치 및 실행 명령 확정 |
| 1. 최종 UI shell/3탭·URL/Build | 60~90분 | 새 `/mvp` 화면 실행 가능 |
| 2. 캡처-블루프린트 연결 | 90~150분 | 데모 URL의 실제 정보로 독립 구조 생성 |
| 3. MODE 1 첫 렌더 → 원본 대비 | 90~150분 | 브라우저에 실제 생성 사이트 보임 |
| 4. MODE 2/3 최소 기능 연결 | 90~150분 | 디자인 변형·schema 데이터 반영 |
| 5. 실제 Chrome 시각 보정/QA | 나머지 시간 | 같은 화면 비교+HTML 3종 다운로드 |
실제 시간은 도구·연결 상태에 좌우된다. 작업을 쪼갤 경우에도 매 단위 "동작하는 전체 흐름"을 유지. 사용자에게 불필요한 수동 명령·지속 확인 요청 금지. 한 작업 방식이 1~2회 실패하면 대체.

## 완료 조건
- [ ] 기존 Studio와 별도 새 `/mvp` 화면 실제 로컬 실행.
- [ ] 명시적으로 승인된 **실제 사이트**에서 분석된 DOM/스크린샷 정보 입력 가능 (혹은 실패 시 F12 스냅샷/사용자 제공 원본 자료로 명확히 대체).
- [ ] MODE 1 원본형 **생성 HTML** 실제 브라우저 렌더 및 다운로드. 원본 screenshot 단순 삽입 금지.
- [ ] MODE 2에서 동일 화면을 다른 테마로 **실제 렌더** 및 다운로드.
- [ ] MODE 3에서 입력 스키마/샘플값이 바뀌면 테이블/카드 내용이 실제 변경되고 최소 하나의 작동하는 UI 동작.
- [ ] 같은 뷰포트 스크린샷으로 원본/재현 비교, 오차 수치 및 미구현 기능 공개. 70~80% 목표는 *측정 후* 달성 여부 판정.
- [ ] 전체 경로 `입력→관찰→build(3모드)→preview→export` 자동 테스트 및 GitHub CI 확인. 기능 변경 커밋과 문서/테스트 구분.
- [ ] `HANDOFF.md`, `STATUS.md`, `BOOK.md`가 마지막 확인된 결과·한계·다음 할 일을 기록.

## 구현 우선순위/금지
1. **절대 먼저 할 것:** real independent HTML+CSS 1종 생성, 실행 화면. 기존 도구가 유효한 레이아웃을 만들면 바로 그 결과를 제공.
2. **그다음:** 기능 없는 수준에서도 3모드 전체 연결, 실제 JS local interaction/JSON data.
3. **마지막:** 시각 70~80% 목표 달성을 위한 반복 측정 보정.
4. 추가 ZIP 해시·진단·추상 아키텍처·필요 없는 백엔드 추측은 오늘 금지.
5. 승인 범위 밖 크롤링, 인증 우회, 세션/비밀 복사, 제3자 개인정보 처리, 외부 서버 배포는 하지 않는다.

## 새 채팅방 첫 실행 작업
최신 `mvp-three-mode-20261018` 브랜치의 `AGENTS.md`, `HANDOFF.md`, 이 문서와 `docs/PRODUCT_CONCEPT_3_MODE_MVP.md`부터 읽는다. `studio/server.mjs`, `studio/public/`, `studio/p4-reconstruction.mjs`, `studio/dynamic-browser.mjs`, `studio/p5-visual-diff.mjs`, 해당 테스트를 검사한다. 개발은 `mvp-three-mode-20261018` 브랜치에만 수행. 가장 먼저 `/mvp` 세 모드 화면의 실제 UI를 구현하고, 기존 approved target 또는 확실히 허용된 fixture 기반으로 Mode1 독립 HTML을 렌더한다. 매 단위 기능·테스트·커밋·인수인계 갱신 후 다음 단위로 진행한다.

**한 번에 끝낼 수 없는 작업은 숨기지 않고 검증 완료·구현 완료·미구현을 구분한다.**
