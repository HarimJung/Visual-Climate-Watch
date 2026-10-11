# ENGINEERING.md — Visual Climate 데이터 엔진 지시서 v4

> **새 세션 시작법.** VS Code에서 이 저장소를 열고
> `docs/ENGINEERING.md 읽고 §6의 M9부터 진행해줘` 라고 하면 된다.
>
> **v3(`ENGINE-BUILD.md`)와의 관계.** v3는 M1~M8을 지시했고 M1~M6은 완료,
> M7은 파일 기반으로 완료, M8은 미착수다. v3의 규칙 R1~R7은 **그대로 유효하고
> 이 문서가 R8~R10을 추가한다.** 충돌하면 이 문서가 이긴다. v3의 §0.2 인벤토리
> 표는 낡았으므로 §3을 대신 본다.
>
> **짝 문서** `docs/PRD.md` — 무엇을 왜 만드는가. 이 문서는 어떻게 만드는가.

---

## 0. 먼저 할 일 — 현재 상태를 직접 확인한다

이 문서의 표를 믿지 말고 네 줄을 먼저 돌려라. 표와 다르면 **표를 고치고
보고한 다음** 시작한다.

```bash
cd pdf-45-50p-1-owid-climate/outputs/paris-movement
npm test                       # 전부 통과가 기준 (2026-10-11: 324건)
node engine/cli.ts verify      # 218 통과 + golden clean
node engine/cli.ts report      # 사람이 읽는 커버리지
node engine/cli.ts report --json   # 기계가 읽는 커버리지 (문서 인용은 전부 여기서)
```

`npm run dev` → localhost:3000. 런처가 8787에 아무것도 없으면 엔진을 직접 띄운다.

**포트 주의.** `npm start`(wrangler)와 `npm run engine:serve`가 둘 다 8787을
쓰고, wrangler는 8788도 쓴다. 둘을 동시에 띄우지 마라. 502가 나면 십중팔구
이것이다.

---

## 1. 파일 지도

```
engine/
  contract/schema.ts     zod 계약 게이트. 여기를 통과 못 하면 아무것도 못 나간다.
  sources/
    _base.ts             snapshot() HTTP+캐시+SHA-256, etlLog(), parseCsv(), EtlModule
    _xlsx.ts _zip.ts     바이너리 파서
    ds-01-worldbank.ts   국가 등록부 + 인구          (패턴 A)
    ds-02-climatetrace.ts 자산 단위 관측 배출         (패턴 A)
    ds-04-ndgain.ts      취약성·준비도               (패턴 B)
    ds-05-edgar.ts       비CO₂ 가스별·섹터별          (패턴 B)
    ds-06-cait.ts        1차 (I)NDC 제3자 평가        (패턴 C)
    ds-06-ndc-docs.ts    ★ NDC 원문 → 수치            (패턴 D)
    ds-06-ndc-latest.ts  ★ 미러보다 새 제출본의 바이트 + 미러 파일 검증(D14) (패턴 D)
    ds-08-ndc-registry.ts 등록부 색인                 (패턴 C)
    ds-15-gcf.ts         ★ GCF 프로젝트·집행          (패턴 A)
    ds-18-cckp.ts        CMIP6 전망                   (패턴 A)
    ds-35-owid.ts        전 가스 시계열               (패턴 C)
    ds-40-unfccc.ts      당사국 제출 인벤토리         (패턴 B)
    ds-btr.ts            ★ BTR1 제출·첨부 목록        (패턴 C)
    ds-btr-tables.ts     ★ BTR1 CTF 표4·CRT Summary2 셀 (패턴 D)
    ds-untc.ts           ★ UN 조약집 당사국 지위       (패턴 D)
  build/
    compose.ts           소스 → 계약. state 태깅이 여기서.
    derive.ts            파생값 + 거절 로직 (R4)
    verdict.ts           절 단위 규칙 문장 생성
    index.ts             로스터 + 소스 카탈로그 집계
  cli.ts                 build / build-all / index / verify / report / etl /
                         ndc-parse / ndc-latest / btr-tables / untc
  server.ts              node:http, 포트 8787
  cache/                 원문 스냅샷 (gitignore, SHA-256 동봉)
data/
  khm.json               동결된 계약. 진실의 원본. 수정 금지.
  countries/<ISO3>.json  엔진 생성물 218개. 커밋.
  golden/<ISO3>.json     회귀 기준. 의도적 변경일 때만 갱신.
  ndc-targets.json       ★ 패턴 D 추출 결과 (미러 문서 169개, mirror_check 포함). 커밋. §4 참조.
  ndc-latest.json        ★ 미러보다 새 제출본의 읽기 결과. 커밋.
  ndc-latest-sources.json  그 바이트를 어디서 받았는지 (Archive 캡처·PRIMAP R2, 해시). 커밋.
  btr-tables.json        ★ BTR1 워크북 셀 인용. 커밋.
  parties.json           ★ UNFCCC·파리협정 당사국 지위와 조약집 인용. 커밋.
  engine-index.json      로스터 + 카탈로그 (정적 호스트용)
  etl-logs.json          마지막 실행의 run_id·소스별 건수
components/record/country-record.tsx   레코드 화면 8섹션
scripts/stage-data.mjs   data/ → public/data/ 스테이징 (predev·prebuild)
scripts/verify-evidence.mjs  인용 문장이 그 물리 페이지에 그대로 있는지, 셀 인용이 워크북 셀과 같은지
scripts/regression-gate.mjs  이전 레코드 대비 사유 없이 사라진 값 = 실패 (refresh PR·deploy)
scripts/sync-prd.mjs         docs/*.md의 census 링크 수치를 새 census로
scripts/watch.mjs            운영 사이트 매일 점검 → watch 이슈 열고 닫기
```

---

## 2. 절대 규칙

### v3에서 그대로 오는 것

- **R1 — `unknown` ≠ `absent`.** 기본값은 언제나 `unknown`. `absent`는 소스가
  부재를 **명시**했고 `$reason`이 있을 때만.
- **R2 — 모든 값은 `state`를 달고 나온다.**
- **R3 — 복수 소스를 평균 내지 마라.** 같은 국가·연도에 값이 둘이면 둘 다 보존.
- **R4 — 파생값은 계산을 거절할 줄 알아야 한다.** 사유를 문장으로 남긴다.
- **R5 — 숫자를 발명하지 마라.**
- **R6 — 프론트엔드는 엔진 작업 범위 밖이다.** 단, 계약에 **새 키를 추가하면**
  그 키를 렌더할 섹션은 추가해야 한다. 기존 부품의 동작은 건드리지 않는다.
- **R7 — 계약은 추가만 가능하다.** `$contract === 'visual-climate/country-dial@1.0.0'`
  문자열 완전 일치. 절대 바꾸지 마라.

### 이번 라운드에서 추가된 것

- **R8 — 승격에는 인용이 붙는다.** 문서에서 읽은 값은 **읽은 문장과 페이지**를
  같이 싣는다 (`ndc_document.evidence`). 파일명으로 승격한 BTR 구성요소는
  **파일명을 싣는다** (`btr.components[k].$evidence`). 인용을 못 붙이면
  승격하지 않는다. 예외 없다.
- **R9 — WAF를 우회하지 않는다.** unfccc.int는 문서 CDN 경로까지 Incapsula
  뒤에 있고, 이 엔진의 User-Agent로 요청하면 **HTTP 200과 함께 212바이트짜리
  봇 검사 HTML**을 돌려준다. 브라우저 UA 위장, 헤드리스 브라우저, 프록시 —
  전부 금지. 대신 별도 발행자의 미러를 쓰고 **화면에 보여주는 URL은 언제나
  unfccc.int 자신의 것**으로 하며, 미러는 수집 경로로 기록한다.
- **R10 — 정밀도가 재현율을 이긴다.** 파서가 애매하면 거절이 정답이다.
  거절률이 높다고 게이트를 풀지 마라. §4의 함정 목록이 그 이유다.
- **R10은 판정에도 적용된다 (2026-09-12).** 문서가 쓴 톤수(인용 목표, 문서 BAU×퍼센트)는
  문서의 인벤토리 위에 있고 추세는 다른 소스 위에 있다. 두 장부면 판정하지 않고
  거절한다(`gap.two-ledgers`). 판정은 퍼센트를 추세 소스 자신의 기준연도 값에
  적용한 경우뿐이고, 그때 `derived.trend_source_id`와 판정문이 장부를 말한다.

- **R11 — 라벨보다 바이트 (2026-10-11).** 미러가 붙인 이름·링크·날짜는 그 파일이
  어느 문서인지의 증거가 아니다. openclimatedata 미러는 당사국이 같은 링크의 문서를
  갈아끼우기 전에 받은 파일을 새 링크·날짜 아래 그대로 두었다(브라질 "2022-04-07"
  파일은 2020년 갱신본이고 그 43%는 2022년 문서가 바꾼 수치다). 그래서 미러 파일은
  인터넷 아카이브 색인의 그 링크 PDF 다이제스트와 SHA-1이 같을 때만 그 링크의
  문서로 쓴다(D14, `checkMirrored`). 다르면 아카이브 캡처를 읽고, 그것도 검사를 못
  넘으면 거절한다. 결과는 문서마다 `mirror_check`로 레코드에 남는다.

---

## 3. 소스 현황 (측정치, `report --json`)

| ID | 소스 | 패턴 | 연결 국가 | 채우는 것 |
|---|---|---|---:|---|
| `DS-35` | Our World in Data | C | 218 | `series.observed`, 헤드라인 총량 |
| `DS-02` | Climate TRACE | A | 218 | `series.observed` (다른 장부) |
| `DS-18` | World Bank CCKP | A | 217 | `projections` CMIP6 |
| `DS-01` | World Bank | A | 206 | `country_profile` |
| `DS-05` | EDGAR (JRC) | B | 197 | `by_gas`, `by_sector` (비CO₂만) |
| `DS-06` | Climate Watch / CAIT | C | 196 | `ndc_assessment` (1차 라운드) |
| `DS-08` | UNFCCC NDC 등록부 색인 | C | 193 | `ndc_registry` |
| `DS-40` | UNFCCC DI (PIK 경유) | B | 191 | `series.observed` (당사국 자기 신고) |
| `DS-04` | ND-GAIN | B | 190 | `vulnerability` |
| `DS-15` | Green Climate Fund | A | 136 | `finance_flows` |
| `DS-BTR` | BTR1 제출·첨부 목록 | C | 137 | `btr.submitted`, `btr.components` |
| `DS-06-NDC` | NDC 원문 (미러, D14 대조) | D | 67 | `ndc.*`, `ndc_document`, `ndc_documents` |
| `DS-06-NDC-LATEST` | 미러보다 새 NDC 제출본 | D | 53 | `ndc.*`, `ndc_documents`, `ndc_registry.latest_retrieval` |
| `DS-BTR-TABLES` | BTR1 워크북 셀 (CTF 표4, CRT Summary2) | D | 124 | `ndc_progress`, `btr_inventory`, 소켓 `$evidence` |
| `DS-UNTC` | UN 조약집 (XXVII-7, XXVII-7-d) | D | 218 | `party_status` |

연결 국가 수는 2026-10-11 `report --json`의 `connected_sources`다(그 수의 뜻: 그 소스가 값을 하나라도 준 레코드).
**카탈로그 42개 중 12개, 그리고 새 경로 셋.** 나머지 30개를 앞당겨 붙이지 마라. 지표는 소스
개수가 아니라 `unknown` 감소다 (PRD §7).

---

## 4. 패턴 D — NDC 원문 읽기 (`ds-06-ndc-docs.ts`)

**여기가 이 저장소에서 가장 망가지기 쉬운 코드다.** 손대기 전에 이 절을 전부
읽어라.

### 4.1 구조

```
node engine/cli.ts ndc-parse [ISO3] [--refresh]   ← 네트워크 + poppler 필요
     ↓ 미러에서 PDF 169개 수집 → pdftotext → 규칙 추출
     ↓ D14: 파일마다 아카이브 색인과 SHA-1 대조 → 다르면 아카이브 캡처를 읽거나 거절
data/ndc-targets.json (커밋)
node engine/cli.ts ndc-latest [--refresh]          ← 등록부가 더 새 제출본을 가리키면
     ↓ PRIMAP R2(크기·MD5) 또는 아카이브 id_ 캡처(SHA-1 = 색인 다이제스트, %%EOF,
     ↓ pdfinfo, MiB 단위 잘림 거절) → 같은 리더
data/ndc-latest.json + data/ndc-latest-sources.json (커밋)
     ↓ 빌드는 이 파일들만 읽는다. 헤드라인 = 수치를 읽은 가장 새 문서.
node engine/cli.ts build-all                       ← 네트워크·poppler 불필요
```

unfccc.int 자신에는 절대 요청하지 않는다(`get()`이 막는다, R9). Save Page Now도
쓰지 않는다: 아카이브에 unfccc.int를 대신 받게 하면 그것이 프록시다.

빌드가 PDF를 읽지 않는 이유는 재현성이다. poppler가 없는 기계에서도 같은
바이트가 나와야 하고, 추출 결과가 git에 남아야 감사할 수 있다.

### 4.2 받아들이는 것 (리더 `ds-06-ndc-docs@2`, 2026-10-10)

기준은 그대로 두 가지다: 기준연도 대비, 또는 BAU 대비 경제 전체 감축률. 그 위에서:

1. **단일 수치** — `reduction_pct`. 문장과 물리 페이지를 `evidence`에 싣는다(600자까지,
   단어 중간에서 자르지 않는다).
2. **범위** — "53 to 61%", "66.25-72.5%" → `reduction_range_pct`, `reduction_pct`는 null.
   두 끝을 다 싣고 어느 쪽도 서약이라 부르지 않는다. IPCC·전 지구 경로 인용 범위는 읽지 않는다.
3. **조건** — 수치마다 가장 가까운 라벨(무조건/조건부)을 묶는다. 쌍은 **두 수치에 각각
   라벨이 있고 조건부가 더 클 때만**. 라벨이 하나뿐이면 그 수치가 헤드라인이고
   `headline_condition`이 그 조건이다. 단, 같은 문장에 같은 지평의 못 읽은 수치가 있거나
   문서가 다른 수치를 무조건이라 부르면 거절(잠비아, 앙골라, 나미비아).
4. **지평** — 지평마다 하나씩 `targets[]`. 헤드라인 = 2040 이하의 가장 늦은 해.
5. **기체 범위** — "CO2 emissions"(CO2e 아님)면 `gas_scope:'co2-only'`. 수치는 유지하고 판정문이 말한다.
6. **페이지** — 물리 페이지. 이미지뿐인 페이지도 자리를 지킨다(`pagesOf`). 캄보디아 41.7% 문장은
   물리 31쪽(같은 문장이 151쪽에도 있다).

퍼센트 **각각을 중심으로** 앞뒤를 본다. 정규식으로 문장 전체를 훑으면
겹치는 매치를 잡아먹는다 (§4.3의 스리랑카 사례). 같은 해·같은 기준·같은 라벨의 두 수치,
한 해에 두 기준, 라벨 없는 수치 옆의 다른 라벨 수치는 여전히 거절이다.

### 4.3 실제로 틀렸던 것들 — 다시 틀리지 마라

각 항목은 규칙과 회귀 테스트(`engine/__tests__/ndc-extract.test.ts`)로 남아 있다.
**테스트를 지우면서 재현율을 올리지 마라.**

| 문서 | 함정 | 잘못 읽으면 | 방어 |
|---|---|---|---|
| 러시아 | "reduction … **to** 70 percent relative to the 1990 level" | 70% 감축 (실제는 30%) | 퍼센트 앞이 `to`면 그것은 수준이지 감축폭이 아니다 |
| 그레나다 | "a **40-50 %** reduction" | 상한 50%를 목표로 | 숫자-대시 앞뒤는 범위 인용, 거절 |
| 투발루 | "from the entire **energy sector** to 60%" | 경제 전체 60% | 섹터 단어가 문장에 있으면 거절 |
| 사우디 | "**global methane** emissions by 30%" | 사우디 목표 30% | 남의 목표(Global Methane Pledge) 거절 |
| 미국 | "have **met and surpassed** its 2020 target of 17 percent" | 17%를 현행 목표로 | 이미 달성한 목표의 회고 거절 |
| 인도 | "emissions **intensity** of GDP by 45 percent" | 절대 45% 감축 | 원단위 목표 거절 |
| 인도네시아 | "26% by **2020**" | 지난 시계를 목표로 | 목표연도 2025 미만 거절 |
| 스리랑카 | "3% unconditional and 7% conditional" | 3%만 읽음 | 퍼센트 단위 순회 (겹침 손실 방지) |
| 잠비아 | 조건부 47%만 매치 | 47%를 서약으로 (무조건부는 25%) | 같은 문장에 같은 지평의 못 읽은 수치가 있으면 조건부 단독은 거절 |
| 지부티·멕시코 | 두 퍼센트를 무·조건부 쌍으로 묶으려는 시도 | 지부티는 뒤집혔고 멕시코는 흑색탄소와 짝지어짐 | 쌍은 **수치마다 자기 라벨**이 있을 때만. 흑색탄소 등 단일 기체 수치는 후보가 아니다 |
| 몽골 2035 | 46.3/52.8(흡수 차감)과 30.3(LULUCF 제외)을 쌍으로 | 기준이 다른 둘을 짝지음 | 조건부 수치의 문장이 다른 무조건 수치와 짝지으면 뺀다 |
| 일본 | "no sentence in this document states" | 문장이 있는데 없다고 말함 | 거절문은 "was read as"로: 리더가 읽은 방식을 말하지 문서를 단정하지 않는다 |
| 세네갈 | 조건부 2030 수치가 3쪽 29%, 20쪽 29.5% | 하나를 골라 서약으로 | 거절, `doc.conflicting-figure` 가족 |
| 캄보디아 | 이미지 페이지를 건너뛴 쪽 번호 | 독자가 연 150쪽에 문장이 없음 | 물리 페이지 번호 (`pagesOf`) |
| 브라질·한국·알바니아 (D14) | 미러 파일이 링크의 옛 판본 | 2020년 43%를 2022년 제출본의 서약으로 | 아카이브 다이제스트 대조, 다르면 아카이브 캡처를 읽음 (R11) |
| 알바니아(BTR) | 첨부가 전부 "awaiting submission" | 미제출 CRT를 확인으로 | 파일명에 draft/awaiting이면 근거 아님 |
| 나이지리아 | 스캔 PDF (텍스트 5바이트) | "목표 문장 없음" | 페이지당 40자 미만이면 "텍스트 레이어 없음" |

### 4.4 거절 문구는 국가마다 달라야 한다

`$reason`은 제품이다 (PRD §3의 P6). 공통 문구로 뭉뚱그리지 마라. 현재 6종의
사유가 150개 문서에 붙어 있다.

### 4.5 다음에 손댈 곳

- **절대량 목표.** 아르헨티나 "483 million tCO2eq by 2030" 형태. 매처 없음.
- **"at least X and towards Y"** (노르웨이). 범위 키는 생겼지만 이 형태는 아직 거절.
- **조지아 2035.** 헤드라인 47%(2030)는 맞지만 문서의 2035 "extended target of 50%"를
  `targets[]`가 놓친다. 연도가 다른 문장에 있다.
- **빌려온 연도의 인용.** 문장에 목표연도가 없으면 리더는 같은 쪽의 연도를 빌리고 그 연도가 든 문장을
  함께 인용한다(R8). 우크라이나는 그 문장이 다른 수치(6.6%)의 문장이다. 값은 맞지만(문서 다른 쪽에
  "65% by 2030, compared to 1990"이 있다) 인용이 약하다. 문서 전체에서 수치와 연도가 함께 든 문장을
  찾아 인용하는 것이 다음 단계다.
- **D14 `unverifiable`.** 아카이브에 캡처가 없는 미러 파일은 대조할 수 없어 그대로 쓴다.
  레코드는 `mirror_check.result`로 그렇다고 말한다. PRIMAP R2에 같은 파일이 있으면 그쪽
  다이제스트로 대조하는 것이 다음 단계다.

---

## 5. 계약 v1.1 — 실제 키

`$contract`는 `visual-climate/country-dial@1.0.0` 고정. `$profile`이 `engine@1.1.0`.
`$extensions`가 그 레코드에 실제로 있는 확장을 열거한다.

**v1.0 코어:** `country` `ndc` `finance_need` `btr` `vulnerability` `series` `derived`

**v1.1 확장:** `country_profile` `ndc_registry` `ndc_assessment` **`ndc_document`**
`emissions_profile` `projections` **`finance_flows`** `verdict` `sources` `provenance`

새로 들어온 둘:

```jsonc
"ndc_document": {                 // 패턴 D의 출력. 수용도 거절도 같은 모양.
  "kind": "First NDC", "document_url": "https://unfccc.int/…",
  "retrieval_url": "https://raw.githubusercontent.com/…",   // 미러 (R9)
  "pages": 42, "reduction_pct": 22, "basis": "bau",
  "base_year": null, "target_year": 2030,
  "net_zero_year": null, "confidence": "high",
  "evidence": [{ "page": 2, "sentence": "…" }],   // R8
  "state": "pledged",                              // 거절이면 "unknown" + $reason
  "source": { "id": "DS-06-NDC", "url": "https://unfccc.int/…" }
},
"finance_flows": {                // 한 채널. 채널 이름을 달고 나온다.
  "channel": "Green Climate Fund",
  "approved_usd": 53012115, "disbursed_usd": 36010000, "co_financing_usd": 6800000,
  "projects": 3, "regional_projects": 2, "regional_disbursed_usd": 12300000,
  "received": [{ "year": 2019, "flow_type": "disbursement", "project_ref": "FP0xx", … }],
  "state": "observed", "source": { "id": "DS-15", … }
}
```

`btr.components[k]`에 `$evidence: string[]`가 추가됐다 (R8). 기존 `state` 필드의
이름·타입·의미는 그대로다.

**`finance_need.received_usd`를 GCF 값으로 채우지 마라.** 그 필드는 *모든*
기후재원 수령액을 뜻하고, 그것을 보고하는 소스는 아직 없다. GCF는 GCF라고
말하는 자리(`finance_flows.channel`)에만 들어간다.

---

## 6. 다음 마일스톤

각 마일스톤 끝에 **멈추고 §8 형식으로 보고한 뒤 다음 지시를 기다린다.**

### M9 — 이미 있는 데이터의 화면 (수집 0)
PRD §9의 1~4번. 새 소스도 새 파싱도 필요 없다.
- 거절 로그 화면: `derived.$reason` 214 + `ndc_document.$reason` 150
- 소스 불일치 화면: `emissions_profile.by_source` 198개국
- 취약성 × 재원 교차: 190 × 136, 다국가 미귀속을 1급으로 표기
- `/api/v1/provenance/<ISO3>/<field>` — 값 하나의 출처를 돌려주는 엔드포인트

**인수:** 새 화면이 전부 `report --json`의 수치와 일치한다.

### M10 — BAU 투영 파싱 (기능1의 병목) — **완료 2026-09-11**
`ds-06-ndc-docs.ts`의 `bauOf()`: 문서가 목표연도의 BAU 총량을 *한 문장 안에서
시나리오에 붙여* 진술한 경우에만 읽는다(세 가지 문장 형태). 감축량·회피량·완화
시나리오 수준은 단어가 아무리 가까워도 투영이 아니다(감비아·나미비아·차드 회귀
케이스). 문서당 서로 다른 수치가 하나일 때만 받는다. 읽히면 `ndc.bau_2030_mtco2e`
+ `bau_state:'pledged'`, `derive()`가 문서 자신의 투영에 대해 판정하고 산수를
자기가 했다고 적는다. 2030이 아닌 지평의 투영은 계약 필드 이름이 2030이라 레코드에
안 들어간다(문서 레코드에만 남는다).

같은 날 앞서: EU 공동 NDC(등록부가 27개 회원국의 현 제출본으로 지목, 파서는 기준연도
넷으로 거절, 6쪽 문장을 손으로 검증해 부착) + 프랑스어·스페인어 매처(실문장 회귀
케이스 먼저; 영어 정규식은 손대지 않음).

**인수 결과:** 판정 4 → 38. 목표 읽음 18 → 50. 투영 읽음 6 (AND·BRN·COD·MUS·OMN·UGA).
(2026-10-11: COD·UGA의 투영은 미러의 옛 판본에서 읽은 것이었다. UGA 파일은 2015년 INDC였다. D14 이후 두
레코드는 링크의 실제 문서를 읽고, 거기서는 투영을 읽지 못한다.)
`ndc-extract.test.ts` 13/13 유지, 신규 회귀 29건 통과. 오판정으로 확인된 것 0
(예멘 1%/14%는 첫 컷에서 잘못 통과할 뻔했고 회귀 케이스로 고정).

### M11 — BTR 본문 파싱 — **조달 경로 조사 완료 2026-09-11, 막힘**
`DS-BTR`은 지금 첨부 목록만 읽는다. 적응·제6조는 본문 장(章)이라 파일명으로는
영원히 `unknown`이다.

조사 결과 (측정):
- GitHub 미러 `JGuetschow/UNFCCC_non-AnnexI_data`의 BTR1 파일 **5,249개 전부**
  mode 120000, 140~152바이트 — git-annex 심링크. raw.githubusercontent는 404.
- README가 지목하는 유일한 공개 데이터 사이블링 `gin.hemio.de`: DNS는
  136.243.12.190으로 풀리지만 **443 연결 거부**(7초 타임아웃). 같은 시각
  raw.githubusercontent는 200.
- unfccc.int는 R9(WAF 우회 금지)로 제외.
- 살아날 경우의 규모: BTR1 폴더 140개 Party, 그중 **91개**는 서술형 보고서 PDF가
  파일명으로 정확히 하나 식별됨(14개는 없음, 35개는 여러 개 — 정오표·언어판).
- 승격 규칙은 ENGINE-BUILD M3 그대로: 문서 내 **섹션 위치**(장 제목 + 쪽)가 근거.
  적응은 MPG 4장, 제6조는 협력적 접근 절.

`refresh.yml`이 주간 실행마다 GIN을 프로브해서 살아나면 경고로 알린다. 그때
이 절의 규칙대로 시작한다. **인수(그대로):** 근거 없는 승격 0건. 소켓 328 → 700.

### M12 — 운영화 (v3의 M8) — **완료 2026-09-11**
- `.github/workflows/refresh.yml`: 매주 월요일 03:17 UTC, 캐시 없이 처음부터
  수집→재파싱→재빌드→계약 게이트(`verify --no-golden`)→골든 수용→전체 테스트→
  **PR 생성**. 사람이 census 차이를 읽고 머지한다. 자동 배포 아님.
- `.github/workflows/deploy.yml`: main에 push되면 test→verify→build→deploy.
  Cloudflare 시크릿 둘(`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`)이 없으면
  빌드까지만 하고 경고로 멈춘다 — **시크릿 등록이 유일한 수동 단계.**
- 실패 알림: 어느 단계든 실패하면 GitHub이 저장소 소유자에게 메일. 이것이 받는 쪽.
- `quarantine` 테이블: DB가 없는데 테이블만 있다. **M13으로 이관.** 지금은
  `etl-logs.json`의 `quarantine_count`가 그 역할을 한다.

**검증 (2026-09-11, 실제 CI):** `deploy.yml` — main push → install·test 118/118·
계약 게이트·빌드까지 녹색, 시크릿 없어 경고로 정지 (run 34617624471).
`refresh.yml` — 수동 실행, 캐시 없이 전체 수집·169개 PDF 재파싱·218 재빌드·
게이트·테스트·census까지 **11분**, PR #2 생성 (run 34618035747). census는 로컬과
동일(읽음 50 · 판정 38 · 거절 325). 첫 실행은 PR 생성에서 실패했다 — 저장소 설정
"Allow GitHub Actions to create and approve pull requests"가 꺼져 있었고, API로
켰다. 주간 PR은 수집 시각·해시가 매번 바뀌어 444개 파일이 움직인다; 읽을 것은
`data/census.json` 차이 하나다.

CI 설치는 `npm install`이다. `npm ci`는 macOS에서 쓴 lockfile을 Linux에서 거절한다
(선택 의존성 체인 `@napi-rs/wasm-runtime → @emnapi/*`를 lock이 기록하지 않음; node
22·24 모두, `--os linux`로 재생성해도 안 생김). 커밋된 lock이 기록이고 CI 설치는
일회용이다.

### M14 — 빈칸의 원인을 고친 라운드 — **2026-10-10~11, 커밋 전**

측정한 원인: 미러가 2022-06-07에 보관돼 168개 레코드의 더 새 제출본을 못 읽었고, BTR 근거는
파일명뿐이었고, 당사국 지위가 없었고, 리더가 조건을 버리고 증거를 300자에서 자르고 빈 페이지를
건너뛰어 쪽 번호를 셌다. 그리고 2026-10-11에 미러 파일 일부가 링크의 옛 판본임을 찾았다(R11).

한 일 (D1~D14, 결정은 `data/` 커밋 파일과 이 문서 §4):
- `ndc-latest`: 등록부의 더 새 제출본을 PRIMAP R2 또는 아카이브 id_ 캡처로 받아 같은 리더로 읽는다.
  헤드라인 = 수치를 읽은 가장 새 문서. `ndc_documents`가 모든 문서를 싣는다.
- 리더 v2: 범위, 조건 라벨, 쌍, 지평별 `targets`, 기체 범위, 물리 페이지, 600자 증거.
- `btr-tables`: CTF 표4 시계열과 CRT Summary2 총량을 셀 인용과 함께. EU 수치를 실은 회원국 CTF는 거절.
- `untc`: UN 조약집 PDF에서 UNFCCC·파리협정 지위. 당사국이 아닌 레코드에 "안 읽음"을 쓰지 않는다.
- GCF 전체 목록에 없는 레코드는 진술된 부재(`finance_listing`).
- D14 미러 대조(`checkMirrored`).
- 지속 검증: `_base.ts` 재시도·stale 폴백, `verify-evidence`, 회귀 게이트(refresh PR 본문, deploy 차단),
  `watch.yml` 매일 운영 점검, `sync-prd`.

**인수 결과.** 수치는 `report --json`이 말한다: `ndc_headline_read`, `ndc_mirror_*`,
`btr_ctf_progress_read`, `btr_crt_totals_read`, `party_status_read`. 이 문서에 손으로 옮기지 않는다.
verify-evidence 불일치 0, 회귀 게이트 사유 없는 손실 0이 기준이다.

### M13 — 영속화 (v3의 M7 잔여)
`engine/db/schema.sql` 실행, ETL이 파일 대신 DB에 쓰기. 파일 경로는 로컬 폴백.
**M9~M12가 끝나기 전에 시작하지 마라.** 파일 기반으로 218개국이 돌고 있고,
DB는 지금 아무 문제도 풀지 않는다.

---

## 7. 테스트

`npm test` 전부 통과. 2026-10-11 기준 324건이며(엔진 리더 테스트 126건 별도 포함), 건수는 늘기만 한다.

| 파일 | 지키는 것 |
|---|---|
| `epistemics.test.ts` | **이 저장소에서 가장 중요.** 근거 없는 `absent` 0, null에 붙은 observed/pledged 0, 인용 없는 승격 0, GCF 집행액 미분할 |
| `ndc-extract.test.ts` | §4.3의 함정 13종. 각각 실제 문장이다 |
| `golden.test.ts` | `data/golden`과 바이트 비교 |
| `sources.test.ts` | 멱등성 (같은 캐시 → 같은 바이트), R3 보존 |
| `contract.test.ts` | zod + 프론트엔드 `validateCountry()` 양쪽 |
| `empty.test.ts` | 데이터가 하나도 없는 국가도 유효한 레코드 |
| `verdict.test.ts` | 필드가 비면 절이 사라진다 |

**skip·완화 금지.** 특히 `ndc-extract.test.ts`를 지우면서 파서를 "개선"하지 마라.

---

## 8. 보고 형식

```
## M<n> 완료
변경 파일:
새로 연결된 부품:
새 데이터:        <국가 수 · 어떤 필드 · 어떤 소스>
아직 unknown:     <남은 필드와 이유>
재현 명령:        <report --json 이전/이후 diff>
발견한 문제:
테스트:           <통과/실패, epistemics 결과 명시>
확인 방법:        <브라우저에서 직접 볼 수 있는 절차>
```

**불확실하면 불확실하다고 써라. 빈 소켓은 실패가 아니라 정직함이다.**

---

## 9. 하지 말 것

- `$contract` 문자열 변경 · `data/khm.json` 값 수정
- 소스 간 평균·보간·병합 · 출처 없는 숫자 채우기
- **인용 없이 값을 승격** (R8)
- **WAF 우회** — UA 위장, 헤드리스 브라우저, 프록시 (R9)
- **재현율을 위해 파서 게이트 풀기** (R10) — §4.3이 그 대가다
- `finance_need.received_usd`에 한 채널의 금액 넣기
- 카탈로그의 나머지 30개 소스 앞당겨 붙이기
- M9~M12 전에 DB 도입
- `node_modules`, `dist`, `.next`, `engine/cache` 커밋
