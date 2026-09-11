# Session Handoff: Visual Climate Watch — 기계를 "읽히게" 만들기

**Date:** 2026-09-08
**Repo:** https://github.com/HarimJung/Visual-Climate-Watch (**private**)
**Git root:** `/Users/harimgemmajung/Documents/Codex/Visual Climate Watch`
**App:** `pdf-45-50p-1-owid-climate/outputs/paris-movement` (Next.js/vinext + Three.js)
**Dev:** `npm run dev` → localhost:3000 (백그라운드로 이미 떠 있을 수 있음, PID 확인 후 재사용)
**서버 두 개 필요:** `npm run engine:serve` (8787, `.dev.vars`의 `CLIMATE_API_BASE`가 가리키는 업스트림) + `npm run dev` (3000).
엔진이 없으면 `/api/v1/country-dial`이 502 → 화면은 뜨는데 데이터가 안 붙음.

## Current State

**Phase:** 구현 완료 + 다음 방향 결정 대기
**Progress:** 가독성 버그 5건 수정·푸시 완료 (`5d5698e`). 테스트 31/31, `tsc` 클린.
**막힌 것 없음.** 남은 건 "다음에 뭘 만들지" 결정 하나.

## What We Did

1. 프로젝트 전체를 GitHub에 초기 임포트 (`0e6e735`, 522 파일 / 140MB).
   제안서 PDF가 들어가는데 레포가 public이라 **private으로 전환 후** 푸시함.
2. 실제로 앱을 띄우고 Playwright로 스크린샷 검증 → 사용자 불만
   ("각 컴포넌트가 뭔지 모르겠다, 왜 톱니바퀴가 있는지 모르겠다")의
   기계적 원인을 특정하고 수정 (`5d5698e`).

## Decisions Made

- **레포 private 전환** — 제안서/스크린샷 포함이라 공개 인덱싱 리스크. 나중에 public 전환은 언제든 가능.
- **번호 체계는 왼쪽 rail(01–05)을 정본으로** — rail만 chassis(파리협정)를 포함한 완전한 목록이라서.
- **`step`(조립 페이즈)과 `no`(표시 번호)를 분리** — 페이즈 게이팅 로직을 건드리지 않고 표시만 교정.
- **반투명은 "실제로 비어 있는 값"에만** — 소스 연결 여부로는 발동이 안 됨(아래 참조).
- **스테이지 키에서 재질 토큰 3개는 뺌** — 푸터에 이미 있고, 상단에서 `KHM / 102` 마커와 충돌.

## Code Changes (커밋 `5d5698e`)

- `components/movement/scene.tsx`
  - 3D 라벨 번호 01–04 → **02–05** (rail과 일치)
  - chassis에 `01 / 파리협정 지판` 라벨 신규 (rail의 01인데 라벨이 없었음)
  - 인라인 고스팅 코드를 `ghost_()` 헬퍼로 추출 → 재원 기어에도 적용
  - `const show=amount<=.96&&inDepth&&…` → **`amount` 게이트 제거**
  - canvas에 `role='img'` + `tabIndex=0`
- `app/page.tsx`
  - `input-record`에 `no:` 필드 추가, 표시를 `input.step` → `input.no`
  - `.stage-key` 2줄 범례 신규 (스테이지 상단)
- `app/globals.css`
  - `.stage-key` 스타일. `top:44px;right:0` — 하단은 뷰포트 밖이라 못 씀

## Context to Remember (재확인에 시간 걸리는 것들)

- **캄보디아 소스 11개가 전부 `connected`.** 그래서 "미연결 소스 = 반투명 기어"
  로직은 **어떤 국가에서도 발동한 적이 없다.** 죽은 인코딩이었음.
- **하단 `.stage-bottom` 힌트는 1440×900에서 렌더링 안 됨** (y≈947 > vh 900).
  스테이지가 뷰포트보다 높아서 bottom 앵커는 전부 접힘. 새 요소는 상단에 붙일 것.
- **캄보디아 데이터가 이미 말하고 있는 것** (`/api/v1/country-dial?country=KHM`):
  - `derived.on_track: false` — 배출 **+1.38** MtCO₂e/yr 상승, 목표는 **−0.24** 필요.
    어떤 배수로도 도달 불가라 엔진이 gap factor 산출 자체를 **거부**함
  - BTR 8개 구성요소 **전부 `unknown`**
  - 재원: 필요 $5.8bn, **수령 `null`**
  → 즉 **이 기계는 캄보디아에서 안 돌아가야 정직한데, 화면은 완성된 시계로 읽힌다.**
- 사용자는 애니메이션 자체는 만족. 불만은 **의미 전달**. "엔진과 Visual Climate
  핵심을 어떻게 관통해서 보여줄지"가 진짜 질문.
- 3D 회전 루프: `for(const {g,speed} of gears){if(g.userData.available)g.rotation.z=gearTime*speed;}`
  `speed` 부호가 이미 교대(1,-1,1)라 물리적 맞물림은 성립.

## Open Question — 다음에 뭘 만들지 (사용자 고민 중)

- [ ] **A. 기어 회전 = 실제 추세** ← 추천
  `gears`의 `speed`에 추세 부호를 곱하면 끝. 부호가 이미 교대라 **전체를 같이
  뒤집으면 맞물림이 안 깨진다.** 캄보디아는 역회전 →
  "약속은 −41.7%인데 기계는 반대로 돈다"가 한 장면에 들어옴.
  *디프 최소 · 의미 최대. 이미 좋아하는 애니메이션이 판정을 실어 나르게 됨.*
  주의: 회전 속도로 크기까지 인코딩하면 과함. 부호(방향)만 먼저.
- [ ] **B. `unknown` 8개를 실제 빈 구멍으로**
  지금 BTR 소켓이 점처럼 보여 장식으로 읽힘. 8/8 미파싱이면 브리지가 안 앉는 게 맞음.
  *A보다 크고, A를 하고 나면 톤이 정해져서 만들기 쉬워짐.*
- [ ] **C. 국가 전환을 같은 캘리버 비교로**
  "같은 엔진, 다른 국가" 탭이 지금은 카드 그리드. 부품 자리를 고정하고 채워짐만
  바꾸면 국가 간 비교가 성립. *제일 크고, 제일 나중.*

**추천 순서: A → B → C.** A가 가장 싸고 세다.

## Next Steps

1. [ ] A/B/C 중 결정 (기본값 A)
2. [ ] A 구현 시: `scene.tsx`의 gears 루프에서 `data.derived` 추세 부호 반영,
       스테이지 키에 "역회전 = 목표 반대 방향" 한 줄 추가
3. [ ] 변경 후 Playwright로 rest/exploded 두 상태 스크린샷 재검증
4. [ ] `npm test` + `npx tsc --noEmit`

## Files to Review on Resume

- `pdf-45-50p-1-owid-climate/outputs/paris-movement/components/movement/scene.tsx` — 3D 전체. 라벨/기어/고스팅 다 여기
- `pdf-45-50p-1-owid-climate/outputs/paris-movement/app/page.tsx` — rail, 입력카드, 시트, 스테이지 키
- `pdf-45-50p-1-owid-climate/outputs/paris-movement/app/globals.css` — `.stage-key`, `.component-label`
- `.playwright-mcp/c1-rest.png`, `.playwright-mcp/b2-exploded.png` — 수정 후 현재 모습
