# ENGINE-BUILD.md — Visual Climate 데이터 엔진 구축 지시서 (v3)

> **Claude Code 작업 지시서.** VS Code에서 이 저장소를 열고
> `ENGINE-BUILD.md 읽고 M1부터 진행해줘` 라고 하면 된다.
>
> **목표:** 코덱스가 만든 3D 프론트엔드의 **모든 부품이 실데이터에 연결된**, 운영 가능한 수준의
> 데이터 엔진. 지금은 부품 일부만 데이터로 돌고 나머지는 하드코딩이거나 아예 없다.
> 이 문서는 그 격차를 전부 열거하고 메우는 순서를 정한다.
>
> **프론트엔드는 수정하지 않는다.** 엔진이 데이터를 공급하면 기존 컴포넌트가 살아난다.

---

## 0. 먼저 읽을 것

읽고 나서 §0.2의 인벤토리 표가 현재 코드와 일치하는지 **직접 확인한 뒤** 보고하고 시작한다.
(내가 읽은 시점 이후 코덱스가 파일을 바꿨을 수 있다. 표가 틀렸으면 표를 고치고 보고하라.)

```
data/khm.json                       ← 동결된 계약. 진실의 원본.
lib/climate.ts                      ← 타입, validateCountry(), countrySnapshot(), sourceCatalog
app/api/v1/country-dial/route.ts    ← 이음매. CLIMATE_API_BASE 프록시
app/api/v1/engine/route.ts          ← 소스 카탈로그 (전부 not-connected)
app/page.tsx                        ← UI 데이터 소비 지점 (수정 금지)
components/movement/scene.tsx       ← three.js 씬, 모든 3D 부품 (수정 금지)

pdf-45-50p-1-owid-climate/work/spec.txt   ← 기술 사양서 전문 55p. §0.1 먼저.
(원본 PDF: 연결 폴더 최상단 `tech proposal PRF.pdf`)
```

**핵심 사실 3가지:**

1. `country-dial/route.ts`는 `CLIMATE_API_BASE`가 있으면 `{BASE}/country-dial?country=XXX`로
   프록시하고 `validateCountry()`로 검증한 뒤 실패 시 502를 낸다. **엔진이 그 업스트림이 된다.**
2. `lib/climate.ts`의 KOR·BRA 스냅샷은 **손으로 써넣은 자리 채우기**다 (브라질 1200 MtCO₂e 등
   출처 없음). 엔진이 실제 출처값으로 교체할 대상이다.
3. 캄보디아 BTR 8개 구성요소는 전부 `unknown`이고 UI는 이를 "0개 확인 / 8개 구성요소"로
   정확히 표시 중이다. **버그가 아니라 현재 진실이다.**

### 0.1 기술 사양서(spec.txt) — 따를 것 / 덮어쓸 것

`spec.txt`는 VC-TECH-SPEC-2026-001 v3.0 전문이다. **이 지시서와 충돌하면 이 지시서가 이긴다.**

**따를 것:**

| 위치 | 가져올 것 |
|---|---|
| Part 2 (p5~) | 테이블 DDL — `countries, data_sources, emissions, climate_indicators, vulnerability, climate_finance, disasters, ndc_targets, ndc_content, btr_status, nap_status, reduction_potential, country_projections, etl_logs, quarantine`. 컬럼명·UNIQUE 제약·인덱스 그대로. |
| Part 3 (p13~) | 수집 패턴 A(REST) / B(CSV 벌크) / C(GitHub CSV) / D(PDF→구조화)와 `EtlModule` 인터페이스. `engine/sources/_base.ts`를 여기 맞춘다. |
| Part 1 §1.5 | P1~P5 (원천 보존 · 복수 소스 비병합 · 멱등성+SHA-256 · 금지 변환 · `etl_logs` 감사 추적). 전부 유효. |
| Part 4 (p22~) | API 응답 봉투 `{data, meta}`, 에러 `{error, details?}`, Zod 입력 검증, `/api/v1/*` 경로 규약. |
| 부록 A (p47~) | 40개 소스 카탈로그 `DS-01`~`DS-40` + `DS-BTR` + `DS-NAP`. **소스 ID는 반드시 여기 것을 쓴다.** 패턴·주기·라이선스·추정 레코드 수 포함. |

**덮어쓸 것:**

1. **P6(인식론 상태)이 사양서에 없다.** `observed/pledged/unknown/absent`는 새 개념이다.
   모든 값 테이블에 `epistemic_state` 컬럼을 더한다. **§2의 R1·R2가 사양서보다 우선.**
2. **Part 5 §5.1 `calculateNdcGap()` 그대로 쓰지 마라.** 관측 개수를 확인하지 않고 무조건
   선형 외삽하며, 배출 증가 시 `Infinity`를 반환한다. **R4(계산 거절)가 대체한다.** 나머지 수식
   (targetEmissions, requiredAnnual, projected 시계열)은 그대로 써도 된다.
3. **Part 5 §5.2 `calculateBtrScore()`는 M3 전까지 봉인.** `has_ctf: false`를 미제출로 보고
   점수를 깎는데, 우리 데이터는 `false`가 아니라 `unknown`이다. 4-state로 바꾼 뒤 되살린다.
4. **Supabase / Vercel Cron / pgvector는 M7에서 도입.** M1~M6은 로컬 파일 기반으로 끝까지 검증한다.
   사양서 DDL은 그때까지 **스키마 설계 참조**로만 쓴다.
5. 사양서 예시 수치(KOR 654200 kt 등)는 예시일 뿐 **검증값이 아니다. 인용 금지.**

### 0.2 프론트엔드 전수 인벤토리 — 무엇이 이미 데이터로 도는가

이 표가 이 프로젝트의 작업 목록이다. `연결됨`은 손댈 필요 없음, 나머지가 엔진의 일이다.

#### `components/movement/scene.tsx` — 3D 부품

| 부품 | 코드 위치 | 현재 구동 | 상태 |
|---|---|---|---|
| 섀시 `treaty` + ARTICLE 2/4/13/14 | `part('treaty')`, `obligationNames` | 정적 | **정적 유지** (조약 구조는 국가별로 안 변함) |
| 목표 링 50 세그먼트 | `segments`, `ratio` | `ndc.reduction_pct` | 연결됨 |
| 관측 표시점 | `dataMarks` | `series.observed` | 연결됨 — 단 분모 `Math.max(len,15)`가 하드코딩. `target_year − base_year`로 바꿔야 함 → **M4** |
| 소스 기어 3개 | `sourceGears` | **하드코딩** `delivery`/`DS-05`/`DS-02` | **M4** — 실제 기여 소스로 구동 |
| BTR 브리지 | `bridge`, engraving | `btr.submitted` | 연결됨 |
| 주얼 소켓 8개 | `sockets` | `btr.components[].state` | 연결됨 (4-state 전부 처리) — 값이 전부 `unknown`인 게 문제 → **M3** |
| 재원 코그 + 테더 | `finance`, `tether` | `finance_need.received_usd` (라벨만) | **M5** — 실제 결합 여부를 `finance_flows`로 구동 |
| 평가 코어 `assessment` | `core`, `corePlate` | **없음** | **M6** — `derived`로 구동 |
| 지구 반구 착좌 높이 | `globeSeat`, `north.position.z` | `derived.on_track` | 연결됨 |
| 경고 아크 | `confirmedGaps`, `offTrack` | `absent` 개수 + `on_track` | 연결됨 |
| 원문 칩 4개 | `definitions` | 4개 고정 (NDC/INV/BTR/FIN) | **M5** — 소스 수만큼 |
| 취약성·적응 | — | **부품 자체가 없음** | **M5** — 데이터는 있는데 3D에 안 나옴 |

#### `app/page.tsx` — 화면 요소

| 요소 | 현재 구동 | 상태 |
|---|---|---|
| 대표 수치 `−N%` | `ndc.reduction_pct` | 연결됨 |
| anatomy-key 5개 버튼 | ndc / series / btr / finance | 연결됨 |
| argument-chain 4 카드 | target / conditionality / derived / btr | 연결됨 |
| data-inputs 4 레코드 | NDC / INV / BTR / FIN | 연결됨 |
| 국가 트레이 | `countries` **하드코딩 3개** | **M4** — 엔진의 국가 목록으로 |
| 소스 레지스터 40개 | `sourceCatalog` **하드코딩, 전부 not-connected** | **M4** — `/api/v1/engine`으로 |
| 요청 감사 SHA-256 | 브라우저가 계산 | **M6** — 엔진도 `provenance.payload_sha256` 제공 |
| 평가 문장 `verdict()` | `lib/climate.ts` 안의 임시 템플릿 | **M6** — 엔진이 절 단위로 생성 |

#### 아직 데이터도 없고 부품도 없는 것 (계약 확장 대상 → M5)

섹터별 배출 · 가스별 분해 · 1인당 배출 · 기후 전망(CMIP6 SSP) · 재해 이력(EM-DAT) ·
감축 잠재량(Climate TRACE ERS) · NAP 현황 · CAT 등급 · 받은 재원 흐름 · 국가별 소스 연결 상태

---

## 1. 미션

`GET /country-dial?country=<ISO3>`로 **모든 프론트엔드 부품을 먹여 살릴 수 있는 실데이터**를
반환하는 엔진. 40개 소스 → 15개 테이블 → 하나의 계약.

**완료 정의:**

- §0.2 표에서 `연결됨`이 아닌 항목이 0개
- 190개국이 같은 코드 경로로 렌더되고, 데이터가 없는 나라는 **비어 있는 채로 정직하게** 렌더됨
- 화면의 모든 숫자가 `source.url` + `retrieved_at`으로 되짚어짐
- `epistemics.test.ts`가 전 국가에 대해 통과

---

## 2. 절대 규칙 — 위반 시 되돌림

**R1 — `unknown` ≠ `absent`.** `unknown` = 우리가 아직 안 봄. `absent` = 소스가 부재를 명시.
기본값은 언제나 `unknown`. `absent`는 근거(`$reason`)가 있을 때만.
> 캄보디아는 BTR1을 2024-12-31에 제출했다. CTF를 `absent`로 찍으면 실존 정부에 대한 허위 지적이다.
> 기술 문제가 아니라 법적·평판 문제다.

**R2 — 모든 값은 `state`를 달고 나온다.** 스키마가 강제한다.

**R3 — 복수 소스를 평균 내지 마라.** 같은 국가·연도에 EDGAR와 Climate TRACE가 다르면 **둘 다
보존**하고 `source_id`로 구분한다. 평균·보간·"최신 것만 채택" 금지. 이 격차가 제품의 콘텐츠다.

**R4 — 파생값은 계산을 거절할 줄 알아야 한다.** `series.observed.length >= 2`일 때만
`ambition_gap_factor`를 계산. 아니면 `null` + `gap_state:'unknown'` + `$reason`.

**R5 — 숫자를 발명하지 마라.** 소스에 없으면 `null` + `unknown`. 다른 나라에서 유추하거나
모델 기억에서 꺼내 쓰지 마라.

**R6 — 프론트엔드 수정 금지.** `app/page.tsx`, `components/movement/scene.tsx`,
`app/globals.css`, `lib/climate.ts`의 타입·validator는 읽기 전용.
UI가 잘못 보이면 십중팔구 데이터가 틀린 것이다. 정말 UI 수정이 필요하면 **고치지 말고 보고**.

**R7 — 계약은 추가만 가능하다(additive-only).**
`validateCountry()`가 `$contract === 'visual-climate/country-dial@1.0.0'`을 **문자열 완전 일치**로
검사한다. **이 문자열을 절대 바꾸지 마라.** 확장은 새 최상위 키를 더하는 방식으로만 한다
(§4). 기존 키의 이름·타입·의미 변경 금지. 그래야 프론트엔드를 안 건드리고 확장된다.

---

## 3. 아키텍처

같은 저장소 안 `engine/`. **M7 전까지 DB·클라우드 도입 금지.** 로컬에서 끝까지 검증하는 게 목표다.

```
engine/
  contract/
    schema.ts        zod. validateCountry()보다 엄격. v1.0 코어 + v1.1 확장 분리
    types.ts
  db/
    schema.sql       Part 2 DDL + epistemic_state 컬럼 (M1엔 문서로만, M7에 실행)
  sources/
    _base.ts         SourceAdapter, HTTP 캐시, 재시도, robots 준수, etl_log 기록
    <ds-id>.ts       소스당 1개
  cache/             원문 스냅샷 (gitignore). 변형 없이 저장 + SHA-256
  build/
    compose.ts       소스 → 계약 조립. state 태깅이 여기서.
    derive.ts        파생값 + 거절 로직 (R4)
    verdict.ts       절 단위 규칙 기반 문장 (LLM 산문 금지)
  server.ts          node:http. GET /country-dial, GET /engine. 포트 8787
  cli.ts             build / build-all / verify / report
  __tests__/
data/countries/<ISO3>.json    엔진 생성물. 커밋.
data/golden/<ISO3>.json       회귀 기준
```

의존성 최소: `zod`, `tsx`, 테스트 러너. HTTP는 내장 `fetch`. 파서가 꼭 필요하면 추가하고 이유 보고.
서버는 라우트 2개뿐이니 `node:http`로 충분하다. Express 금지.

---

## 4. 계약 확장 v1.1 (M5) — 추가만 한다

`$contract` 문자열은 **`visual-climate/country-dial@1.0.0` 그대로 둔다** (R7).
확장 여부는 별도 키로 표시한다:

```jsonc
{
  "$contract": "visual-climate/country-dial@1.0.0",   // 절대 불변
  "$profile":  "engine@1.1.0",                        // 새로 추가
  "$extensions": ["emissions_profile","projections","disasters",
                  "reduction_potential","nap","finance_flows","ratings",
                  "sources","provenance"],

  // …v1.0의 모든 기존 키는 그대로…

  "emissions_profile": {
    "latest_year": 2022,
    "total_mtco2e": null, "state": "unknown",
    "per_capita_tco2e": null,
    "by_sector": [ { "sector":"Energy","value_mtco2e":null,"state":"unknown","source_id":"DS-05" } ],
    "by_gas":    [ { "gas":"CO2","value_mtco2e":null,"state":"unknown","source_id":"DS-05" } ],
    "by_source": [ { "source_id":"DS-05","series":[{"year":2022,"value_mtco2e":null}] } ]
      // ★ R3: 소스별로 나란히. 절대 병합하지 않는다.
  },
  "projections":        { "scenarios": [ /* SSP1-2.6 … SSP5-8.5, period, variable, anomaly */ ], "state": "unknown" },
  "disasters":          { "events": [], "totals": { "count": null, "deaths": null, "affected": null, "damage_usd": null }, "state": "unknown" },
  "reduction_potential":{ "total_mtco2e_yr": null, "strategies": [], "state": "unknown" },
  "nap":                { "has_nap": null, "submission_date": null, "focus_areas": [], "ndc_aligned": null, "state": "unknown" },
  "finance_flows":      { "received": [ /* year, flow_type, channel, instrument, provider, amount_usd, state */ ], "state": "unknown" },
  "ratings":            { "cat": { "rating": null, "state": "unknown", "source": null } },

  "sources": [   // ★ 국가별 소스 연결 상태. 3D 소스 기어와 소스 레지스터를 구동한다.
    { "id":"DS-05","name":"EDGAR","pattern":"B","tables":["emissions"],
      "connection":"connected|not-connected|failed",
      "records": 0, "last_run": null, "retrieved_at": null, "url":"", "license":"" }
  ],
  "provenance": {
    "run_id": null, "built_at": null, "payload_sha256": null,
    "inputs": [ { "source_id":"DS-05","file_sha256":"","retrieved_at":"" } ]
  }
}
```

**규칙:** 확장 키가 없어도 프론트엔드는 정상 동작해야 한다(현재 그렇다). 확장은 새 부품을
먹이기 위한 것이지 기존 부품을 바꾸기 위한 게 아니다.

---

## 5. 40개 소스 계층

부록 A의 40개를 한꺼번에 붙이지 않는다. 계층으로 나눠 **T0 → T1 → T2** 순서로.

**T0 — 다이얼을 정직하게 채우는 최소집합 (M2·M3)**

| ID | 소스 | 채우는 것 | 패턴 | 난이도 |
|---|---|---|---|---|
| `DS-BTR` | UNFCCC First BTRs | `btr.submitted`, 날짜 | B | 낮음 |
| `DS-06` | Climate Watch / UNFCCC NDC | `ndc.*`, `conditionality`, `finance_need` | D | **높음** |
| `DS-35` | Our World in Data (GitHub CSV) | `series.observed` | C | 중간 |
| `DS-04` | ND-GAIN | `vulnerability.*` | B | 낮음 |

**T1 — 확장 부품을 살리는 소스 (M5)**
`DS-05` EDGAR · `DS-02` Climate TRACE · `DS-40` UNFCCC CRF · `DS-03` EM-DAT ·
`DS-18` WB CCKP · `DS-15` GCF · `DS-23` CPI · `DS-27` CAT · `DS-NAP` NAPcentral

**T2 — 나머지 (M8 이후, 우선순위 낮음)**
`DS-01,07,08,09,10,11,12,13,14,16,17,19,20,21,22,24,25,26,28,29,30,31,32,33,34,36,37,38,39`

**T2를 앞당기지 마라.** 소스 개수는 지표가 아니다. `unknown`이 줄어드는 게 지표다.

**네트워크 예절:** 공식 API·벌크 엔드포인트만. `robots.txt`와 이용약관 존중, 요청 간 지연,
캐시 재사용. 차단되거나 약관이 애매하면 **우회하지 말고 보고**. 라이선스가 재배포를 막는
소스(부록 A의 Restricted 항목)는 값을 커밋하지 말고 링크만 보관한다.

---

## 6. 마일스톤

각 마일스톤 끝에 **멈추고 §8 형식으로 보고한 뒤 다음 지시를 기다린다.** 한 번에 다 하지 마라.

### M1 — 배관 + 계약 게이트 (새 데이터 없음)
- `engine/contract/schema.ts` zod 스키마. `data/khm.json`이 통과. `validateCountry()`보다 엄격:
  모든 `state`는 4개 리터럴 중 하나, 모든 `source`는 https URL + `retrieved_at`,
  `series.*`의 모든 점은 유한한 `year`·`value_mtco2e`.
- `engine/server.ts`가 `data/countries/*.json` 서빙. KHM은 `data/khm.json` 그대로.
- KOR·BRA의 **미출처 숫자를 전부 `null` + `unknown`으로 강등**. (삭제하지 말 것)
- `engine/db/schema.sql`에 Part 2 DDL + `epistemic_state` 컬럼을 문서로 작성 (실행 안 함).
- 골든 테스트: KHM 출력 == `data/khm.json` 바이트 동일.

**인수:** `CLIMATE_API_BASE=http://localhost:8787 npm run dev` → 캄보디아 화면이 프록시 전과
**완전히 동일**, 헤더 `X-Climate-Mode: upstream`, "0개 확인 / 8개 구성요소" 유지.

### M2 — 관측 시계열 + 취약성 (T0의 `DS-35`, `DS-04`)
- 연도별 총 GHG를 `series.observed`에 채운다. 전 점에 `source_id`, `state:'observed'`.
- 데이터셋의 단위·가스 범위·LULUCF 포함 여부를 확인하고, NDC 기준과 다르면 `$note`에 명시.
  **범위가 다르면 겹쳐 그리지 마라.**
- `vulnerability.*`를 ND-GAIN 실값으로.
- 이제 `observed.length >= 2`이므로 `derive.ts`가 격차를 계산할 수 있다. **R4 거절 로직 유지.**

**인수:** 다이얼에 관측 표시점이 여러 개 찍힌다. "실제 이행" 카드가 실제 판정으로 바뀐다.
관측 1개뿐인 국가를 하나 넣어 거절 경로가 여전히 동작함을 확인한다.

### M3 — BTR 8개 주얼 ★ 최고 우선순위 (`DS-BTR` + 문서 파싱)
- 8개 키: `nir, crt, ctf, ndc_track, adaptation, finance, redd_plus, article6`
- 승격에는 근거가 필요하다: 문서 내 섹션 위치 또는 첨부 파일명. 근거 없으면 `unknown` 유지.
- 문서가 명시적으로 "not applicable"인 항목만 `absent` + `$reason`.
- **애매하면 `unknown`이 정답.** 억지로 8개를 다 채우지 마라.

**인수:** "N개 확인 / 8개 구성요소"가 실제 파싱 결과를 반영. 근거 없는 `absent` 0개.

### M4 — 하드코딩 제거 ①
- `sources[]` 배열을 계약에 추가 → 3D 소스 기어와 소스 레지스터가 실제 연결 상태로 구동
- 국가 목록을 엔진이 제공 → 트레이가 하드코딩 3개에서 벗어남
- `dataMarks` 분모: `target_year − base_year`가 계약에 있으므로 UI가 계산 가능하게 필드 보장

**인수:** `/api/v1/engine`이 실제 소스 상태를 반환. 트레이에 엔진이 아는 국가만 뜬다.

### M5 — 계약 v1.1 확장 (T1 소스)
§4의 확장 키 전부 + T1 소스 어댑터. 재원 코그가 `finance_flows`로 실제 결합 여부를 판단하고,
취약성 부품에 먹일 데이터가 생긴다.
**여기서 새 3D 부품이 필요해지면 만들지 말고 목록으로 보고한다** (코덱스 작업 범위).

### M6 — 판결 문장 + 텔레메트리
- `verdict.ts`: 절 단위 규칙 템플릿. 각 절은 하나의 필드에 대응하고, 그 필드가 `unknown`이면
  절이 통째로 빠진다. 문장이 짧아지는 건 정상. **LLM 생성 산문 금지** — UN 파트너가
  방법론을 물으면 코드를 보여줄 수 있어야 한다.
- `provenance.payload_sha256`, `run_id`, `built_at` 제공.
- `/api/v1/engine`이 실제 `etl_logs`를 반환: run_id, 시각, 소스별 건수, quarantine 수.

### M7 — 190개국 + 영속화
- `build-all`로 전 국가 생성. 데이터 없는 나라는 **비어 있는 채로 유효**해야 한다.
- 여기서 Supabase 도입: `engine/db/schema.sql` 실행, ETL이 파일 대신 DB에 쓰고,
  `country-dial`은 뷰/함수에서 조립. 파일 경로는 로컬 개발 폴백으로 남긴다.

### M8 — 운영
스케줄 수집, `quarantine` 처리, 전 국가 골든 회귀, 캐시/ISR, 실패 알림.

---

## 7. 테스트

```
contract.test.ts     data/countries/*.json 전부 zod 통과 + validateCountry() 통과
epistemics.test.ts   ★ 근거 없는 'absent' 0개
                     ★ null 값에 'observed'/'pledged' 붙은 곳 0개
                     ★ observed.length < 2 인데 ambition_gap_factor != null 인 곳 0개
                     ★ $contract 문자열이 정확히 v1.0.0 (R7)
sources.test.ts      같은 캐시로 재실행 시 출력 바이트 동일 (멱등성 P3)
                     소스 병합/평균 흔적 없음 (by_source 배열 길이 보존, R3)
golden.test.ts       data/golden/*.json 과 diff. 의도적 변경 시에만 갱신.
empty.test.ts        데이터가 하나도 없는 가상 국가로 빌드 → 스키마 통과 + UI 크래시 없음
```

`epistemics.test.ts`가 이 저장소에서 가장 중요한 테스트다. **skip·완화 금지.**

---

## 8. 보고 형식 (마일스톤 종료 시)

```
## M<n> 완료
변경 파일:      <경로>
새로 연결된 부품: <§0.2 표에서 '연결됨'으로 바뀐 항목>
새 데이터:      <국가별로 어떤 필드가 어떤 소스에서>
아직 unknown:   <남은 필드와 이유>
발견한 문제:    <데이터 이상, 계약 마찰, 판단 필요 지점>
프론트 수정 필요: <있으면 목록만. 직접 고치지 말 것>
테스트:         <통과/실패, epistemics.test.ts 결과 명시>
확인 방법:      <브라우저에서 직접 볼 수 있는 절차>
```

**불확실하면 불확실하다고 써라.** 소스가 애매하거나 파싱 신뢰도가 낮으면 그렇게 보고하고
`unknown`으로 남겨라. **이 프로젝트에서 빈 소켓은 실패가 아니라 정직함이다.**

---

## 9. 하지 말 것

- 프론트엔드 파일 수정 (R6) · `$contract` 문자열 변경 (R7)
- 소스 간 평균·보간·병합 (R3) · 출처 없는 숫자 채우기 (R5)
- `data/khm.json` 값 수정 — 검증된 실데이터다
- T2 소스를 앞당겨 붙이기 (`unknown` 감소가 지표지 소스 개수가 아니다)
- M7 전에 DB·클라우드·무거운 의존성 도입
- `node_modules`, `dist`, `.next`, `engine/cache` 커밋
- 재배포 금지 라이선스 소스의 원본값 커밋
- robots.txt·이용약관 우회

---

## 부록 — 검증된 캄보디아 실값 (출처 확인 2026-09-07)

`data/khm.json`에 이미 들어있다. **엔진 출력이 이와 달라지면 엔진이 틀린 것이다.**

| 항목 | 값 | 출처 |
|---|---|---|
| 기준연도 / 배출 | 2016 / 125.2 MtCO₂e | Updated NDC |
| BAU 2030 | 155.0 MtCO₂e (FOLU 포함) | Updated NDC |
| 감축 | 64.6 MtCO₂e/yr = 41.7% | Updated NDC |
| 목표 2030 | 90.4 MtCO₂e | 155.0 − 64.6 |
| FOLU 기여 | 감축분의 59.1% | Updated NDC |
| 조건부 비율 | **공표되지 않음 → null** | "The majority of targets … are conditional on the international support." |
| 필요 재원 | 완화 >$5.8bn, 적응 >$2bn | Updated NDC |
| BTR1 | 제출 2024-12-31, 공개 2025-02-06 | UNFCCC |
| BTR 구성요소 | 8개 전부 미파싱 (unknown) | — |
| ND-GAIN (2021) | 40.1 · 취약성 0.486 · 준비도 0.288 · 144위 | ND-GAIN |

- <https://unfccc.int/sites/default/files/NDC/2022-06/20201231_NDC_Update_Cambodia.pdf>
- <https://unfccc.int/first-biennial-transparency-reports>
- <https://unfccc.int/documents/645175>
- <https://gain-new.crc.nd.edu/country/cambodia>
