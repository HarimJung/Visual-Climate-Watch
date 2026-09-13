# VERIFICATION.md — 검증 공백 넷, 그리고 결정 하나

확인일 2026-09-12 (직전 2026-09-10). 이 문서는 **아직 검증되지 않은 것**의 목록이다.
여기 적힌 우리 쪽 수치는 전부 `node engine/cli.ts report --json`에서 나온다. 손으로
적지 않는다. 남의 수치(CAT·라이선스)는 읽은 날짜와 URL을 달고, 문장을 **그대로**
옮긴다. 요약은 우리 해석이고, 인용은 그들의 말이다.

파트너십·인용·소송 대응이 붙기 전까지 넷 다 제품을 막지는 않는다. 다만
**첫 기관 파트너가 붙는 순간 넷이 동시에 질문으로 돌아온다.** 그래서 각 항목은
"닫힌 부분"과 "열린 부분"을 나눠 적는다. 열린 것을 닫힌 것처럼 쓰지 않는다.

09-12에 움직인 것: 3번은 조사로 닫혔다. 4번은 소스별 원문을 읽어 표로 만들었고,
그중 하나(GCF)는 우리 문자열이 틀려 고쳤다. 1번은 `/countries`가 절반을 닫았다.
2번은 그대로 0명이다. 5번이 새로 생겼다 — 판정의 장부, 결정까지.

---

## 1. 스크린샷 — 화면이 실제로 그렇게 보이는지

**닫힌 부분.** 다음 다섯 경로는 URL 하나로 열리고 서버에서 완성된 HTML이 나온다.
헤드리스 크롬으로 자동 촬영된다.

| 경로 | 무엇 |
|---|---|
| `/` | 인스트루먼트 (기본 탭) |
| `/countries` | 컬렉션. 218장 전부 서버 HTML에 있다 (09-10에는 카드 1장이었다) |
| `/country/<ISO3>` | 국가 레코드 218개 |
| `/refusals` | 거절 로그 |
| `/divergence` | 소스 불일치 아틀라스 |

탭도 URL을 갖는다: `/?view=engine`. 탭을 바꾸면 `replaceState`로 주소만 바뀌고
히스토리는 쌓이지 않는다.

**열린 부분.**

- **상세 패널은 아직 URL이 없다.** `inspect()`가 여는 method·sources·pledge 패널은
  클릭으로만 도달한다. 인용도 자동 촬영도 안 된다.
- 3D 씬은 헤드리스 촬영에서 신뢰할 수 없다. WebGL이 없으면 `StaticDial` 폴백이
  찍힌다. 인스트루먼트 이미지는 사람이 찍어야 한다.
- 회귀 감시(시각적 diff)는 없다. 지금은 촬영만 되고 비교되지 않는다.

## 2. 과업 유저테스트 — 사람이 실제로 읽어내는지

**닫힌 부분.** 없다. 한 번도 하지 않았다. 09-10 이후 PR 다섯 개가 머지되는 동안
사람은 0명이었다.

**열린 부분 — 실행할 프로토콜.** 참가자 5명(부처 1, 기금 1, 기자 1, 소송 1,
연구 1). 첫 구매자 후보는 **기금 심사역**(레드팀 §5-3): `/finance`는 다른 어디에도
없는 화면이고, 심사역은 빈칸을 견디는 직업이다. 진행자는 설명하지 않는다. 과업만 준다.

| # | 과업 | 성공 판정 | 이 과업이 검증하는 주장 |
|---|---|---|---|
| T1 | "이 나라 배출량 최신 수치와 그 출처를 찾아 인용문을 만들어라" | 출처 URL + `retrieved_at` + 해시까지 도달 | P4 Receipts가 팔린다 |
| T2 | "이 칸이 왜 비어 있는지 설명하라" | `unknown`을 **미보고**가 아니라 **미판독**으로 말한다 | 제품 전체의 전제 |
| T3 | "두 소스가 다른 이유를 한 문장으로 말하라" | "범위가 다르다"에 도달, "틀렸다"에 가지 않는다 | P2 Divergence의 서사 위험 |
| T4 | "엔진이 이 나라 이행 격차를 왜 계산하지 않았는지 찾아라" | `/refusals` 또는 레코드에서 사유 문장을 찾는다 | P6 Refusal Log가 자산인지 |
| T5 | "이 나라 BTR 적응 항목이 왜 `unknown`인지 말하라" | "파일명으로는 증명 불가"까지 도달 | 소켓 사유 문장이 읽히는지 |

T4의 첫 표본은 캄보디아와 우간다다. 09-12부터 첫 화면의 두 나라가 판정 대신
거절문("Two ledgers")을 보여준다(§5). 참가자가 그 문장을 "다른 장부라서"로
읽어내면 통과다.

**중단 조건.** T2에서 5명 중 2명 이상이 `unknown`을 "제출 안 함"으로 읽으면
화면 문제가 아니라 **어휘 문제**다. 그때는 화면을 고치기 전에 단어를 바꾼다.

## 3. CAT 대비 차별화 — 확인함 (2026-09-12)

**우리 쪽 — 전부 재현 가능하다.**

| 우리가 말할 수 있는 것 | 값 | 출처 |
|---|---:|---|
| 레코드가 있는 국가·영토 | [218](../data/census.json#countries) | `report --json` |
| 병합하지 않고 나란히 보관하는 연결 소스 | 12 | 〃 |
| 계산을 거절하고 사유를 기록한 건 | [332](../data/census.json#refusals_total) | 〃 |
| 그 사유의 서로 다른 문장 | [76](../data/census.json#refusals_distinct_sentences) | 〃 |
| 순위·등급을 매긴 국가 | 0 | 설계상 없음 |

**CAT 쪽 — CAT 자신의 페이지에서 읽었다, 2026-09-12.** 요약이 아니라 문장이다.
원문이 영문이라 영문으로 둔다.

| 주장 | CAT의 문장 | 어디 |
|---|---|---|
| 몇 개국을 다루나 | "CAT tracks 34 countries and the EU covering around 85% of global emissions" | climateactiontracker.org/about/ · `/countries/`에는 국가 페이지 42개 |
| 등급을 매기나 | "we rate each individual country's pledge against the range of emission levels they should aim for in the framework of a global pathway consistent with Paris." 등급 다섯: "1.5°C Paris Agreement compatible" · "Almost sufficient" · "Insufficient" · "Highly insufficient" · "Critically insufficient" | /methodology/ · /methodology/cat-rating-methodology/ |
| 결측을 어떻게 하나 | "PRIMAP-hist data for countries without CRF data" · "For CO2 emissions, we apply growth rates from the Global Carbon Budget" · "For non-CO2 industry emissions, we calculate the emissions intensity of GPD [sic] and replace it by the latest GDP estimates/projections from the International Monetary Fund (IMF)" · "For non-CO2 agriculture emissions, we extend the last five years' trend." | /methodology/estimating-national-emissions/ |

**그래서 미팅에서 말해도 되는 문장 셋.**

1. "CAT은 34개국과 EU를 추적하고 서약을 등급(rate)으로 평가한다고 스스로 말한다.
   우리는 218개 레코드 어느 것에도 등급을 매기지 않는다."
2. "CAT은 빠진 연도를 자기 방법론대로 추정해 채운다 — GCB 성장률, GDP 집약도,
   5년 추세 연장. 우리는 채우지 않고, 빈칸의 사유를 싣는다."
3. "둘은 다른 물건이다. CAT은 평가고, 이것은 기록이다."

**말하면 안 되는 문장.** "CAT은 분석가 가정으로 메운다." CAT이 쓴 말은 '가정'이
아니라 공개된 방법이다. 방법을 말하고, 가정이라 부르지 않는다. 남에 대한 진술을
근거 없이 하는 것은 이 제품이 금지한 바로 그 일이다.

**열린 부분.** CAT 페이지는 바뀐다. 미팅 전날 위 세 URL을 다시 열어 문장이
그대로인지 본다. 5분이면 된다.

## 4. 라이선스 — 원문 확인 (2026-09-12)

**닫힌 부분 (구조).** 소스 모듈마다 `export const LICENSE` 하나. `sources[]`와
`$sources_index` 둘 다 그것을 읽고, 한 레코드가 같은 소스에 두 라이선스를 말하면
테스트가 실패한다(`epistemics.test.ts`). 레지스터 화면과 영수증
(`/api/v1/receipt`)이 같은 문자열을 보여준다.

**소스별로 원문을 읽은 결과.** 문장은 그대로, 읽은 날은 2026-09-12.

| 소스 | 우리가 싣는 것 | 원문이 말하는 것 | 상태 |
|---|---|---|---|
| DS-05 EDGAR | CH₄·N₂O·F-gas만, CO₂ 제외 | "all material owned by the European Union is licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) licence." · "All emissions, except for CO2 emissions from fuel combustion, are from the EDGAR (Emissions Database for Global Atmospheric Research) Community GHG database" · IEA-EDGAR CO₂는 "licensed under CC BY-NC-ND 4.0" — edgar.jrc.ec.europa.eu/dataset_ghg2024 | **닫힘.** CO₂를 뺀 현재 처리가 원문과 맞다. 출처 표기는 레지스터에 있다. |
| DS-06-NDC · DS-08 (openclimatedata 미러) | 등록부 색인, 문서에서 읽은 문장 | 미러 README: "The Python files in `scripts` are released under a CC0 Public Dedication License." 데이터 파일과 PDF에 대한 선언은 없다. 원본은 UNFCCC 공개 제출물이고 화면 URL은 unfccc.int(R9). | **열림.** 공개 제출물에서 문장을 인용하는 범위에 대한 법적 판단은 받지 않았다. 사실은 이제 여기 적혀 있다. |
| DS-15 GCF | 승인·집행액, 136개국 | "Any reproduction of the Materials shall be followed by the attribution statement: 'First published by the Green Climate Fund' and a visible and clickable link back to https://greenclimate.fund." · "Materials may be copied, printed and downloaded for private study, research and teaching purposes, and for non-commercial purposes. You are not allowed to sell, redistribute or create derivative works of any Materials for commercial purposes without the express written consent of GCF." — greenclimate.fund/terms-and-conditions. `api.gcfund.org`에는 별도 약관 페이지가 없다(404). | **우리 문자열이 틀려 고쳤다.** "attribution requested"가 아니라 required다. **열림:** 유료 파트너에게 API로 GCF 행을 그대로 되돌려주는 것(P4 Receipts)은 원문의 "redistribute … for commercial purposes"다. 서면 동의 전까지 DS-15 영수증은 값이 아니라 **링크로 degrade**해야 한다. 다음 코드 일감이고, 아직 안 만들었다. |
| DS-01·02·04·06·18·35·40 | 각 모듈 선언값, CC BY (4.0) | 오늘 원문을 다시 열지 않았다 | 모듈 선언값 그대로. 미팅 전에 한 번 더 연다. |
| DS-03 EM-DAT (미연결) | 없음 | 금지 목록: "Reproduce, copy, communicate, lend, or otherwise distribute EM-DAT or a substantial part of EM-DAT." · "Create substitute or derivative databases of EM-DAT." · "Share, use or transmit any portion of EM-DAT via the Internet to unauthorized users." 그리고 "Except if agreed upon in a separate Database License Agreement, EM-DAT (including its data and derivate products) cannot be used for any commercial purpose." — doc.emdat.be/docs/legal/terms-of-use/ | **닫힘 — 연결하지 않는다.** PRD §4의 재해 귀속(DS-03)은 Database License Agreement 없이는 시작하지 않는다. |

**가장 큰 미결은 그대로다.** API로 원본을 그대로 되돌려주는 것이 재배포인가.
GCF 원문은 "그렇다"에 가깝고 EDGAR 비CO₂는 "된다"다. 소스마다 답이 다르므로
영수증은 소스별로 값/링크를 갈라야 한다. 지금은 가르지 않는다.

## 5. 판정의 장부 — 결정 (2026-09-12)

레드팀 §3.4: 판정이 장부를 건너뛰고 각주에만 말한다. 재봤다.

- 판정 38건 중 31건은 문서의 퍼센트를 **추세 소스(DS-35) 자신의 기준연도 값**에
  적용한 것이다. 양끝이 한 장부다.
- 7건(AND·BRN·COD·KHM·MUS·OMN·UGA)은 **문서가 쓴 톤수**(인용 목표 1, 문서
  BAU×퍼센트 6)를 DS-35의 추세와 비교했다. 두 장부다. `/divergence`가 "조정하지
  않는다"고 말하는 바로 그 비교다.

**결정: 7건은 거절한다 (R10).** 판정은 양끝이 한 장부일 때만 한다. 그때
`derived.trend_source_id`와 판정문이 장부를 문장으로 말한다 — "Both figures are on
DS-35's inventory: the document's percentage applied to DS-35's 1990 level, not the
document's own." 거절은 새 가족 `gap.two-ledgers`로 묶이고, 추세는 거절에도 실린다
(기어는 돈다, 판정만 없다).

| 수치 | 09-10 | 09-12 |
|---|---:|---:|
| 이행 판정 | 38 | [31](../data/census.json#gap_assessed) |
| 거절 전체 | 325 | [332](../data/census.json#refusals_total) |
| 서로 다른 문장 | 69 | [76](../data/census.json#refusals_distinct_sentences) |
| 두 장부 거절 | — | [7](../data/census.json#refusals_by_family.gap.two-ledgers) |

첫 화면의 두 나라(KHM·UGA)가 판정 대신 거절문을 보여준다. 그게 맞다. 거절은
실패가 아니라 출력물이다.

**확인 방법.** `/refusals`에서 "The target and the trend are on different
inventories" 가족 7건. `/country/KHM`의 판정 토큰이 "Not assessable", 사유 문장에
"Two ledgers".

---

## 넷 중 지금 움직일 수 있는 것

3번은 닫혔다 — 미팅 전날 5분 재확인만 남는다. 4번은 조사로 닫힌 것(EDGAR·EM-DAT),
코드로 닫을 것(DS-15 영수증 링크 degrade), 법률 판단으로 남는 것(인용 범위)으로
갈렸다. 1번은 상세 패널 URL 하나가 남았다. 2번은 사람 5명이 필요하고, 코드로는
닫히지 않는다.

테스트 128건 (2026-09-12, 이 브랜치).
