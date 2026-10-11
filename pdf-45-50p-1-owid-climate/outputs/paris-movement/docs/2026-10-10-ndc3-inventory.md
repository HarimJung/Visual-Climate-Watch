# NDC 3.0 inventory · 2026-10-10

What it would take for the engine to read the newer NDC filings that the registry lists and the records have never read, and how many of them the existing reader accepts today. Research and a dry run only: no engine code, record, cache or `data/` file was changed; no `npm run engine:*` or `engine/cli.ts` was run; nothing under `engine/cache/` was read or written. Scripts and downloads are in the session scratch folder `ndc3/` (named below), not in the repository.

**한 줄 요약.** 등록부가 더 새 제출본을 가리키는 48건(문서 22종)은 unfccc.int에서 전부 212바이트 봇 검사 페이지만 받고, 엔진이 쓰는 미러는 2022년에 보관 처리되어 0종을 갖고 있다. Wayback 사본 20종에 엔진 자신의 `extract()`를 돌리면 6종 수용, 14종 거절(복수 기준 10, 문장 없음 2, 미표시 복수 퍼센트 2)이고, 수용 6종 중 한국은 2015년 INDC의 37%를 2035 NDC의 서약으로 잘못 읽는다. 따로, 파서가 거절한 120개 레코드도 더 새 제출본이 있는데 플래그가 `false`가 아니라 `null`이라 화면에 드러나지 않는다.

## 1. Inventory

Selector: every `data/countries/*.json` with `ndc_registry.matches_parsed_document === false` and a `ndc_registry.latest_version`. Measured 2026-10-10 on the committed records (script `ndc3/inventory.py`, output `ndc3/inventory.json`).

- Records: **48**. Distinct registry documents: **22** (the 27 EU members share one).
- Filing year of the registry document: 2025: 37 (27 of them the EU document), 2026: 4, 2024: 3, 2022: 3, 2021: 1. Not all 48 are "NDC 3.0": DMA, GNQ and UGA point at 2022 updates, TCD at a 2021 update of its first NDC, NAM at a January 2024 update.
- 46 of the 48 show a figure today, read from the older mirrored document (or, for the EU members, the hand-attached joint reading; for KHM, the frozen `data/khm.json`). BRA and KOR show none: their `ndc.*` comes from the hand-entered `curated` rows in `engine/build/compose.ts`.

| # | ISO3 | Party | Registry active submission | Filed | Document on unfccc.int (`/sites/default/files/…`) | Document the record was read from | Parser on that document | `ndc.reduction_pct` now |
|---|---|---|---|---|---|---|---|---|
| 1 | AND | Andorra | Third NDC | 2025-02-05 | `2025-02/NDC 3.0 ANDORRA.pdf` | First NDC, 2020-05-20 | 37% | 37% |
| 2 | ARE | United Arab Emirates | The United Arab Emirates’ Third Nationally Determined Contribution (NDC 3.0) | 2024-11-06 | `2024-11/UAE-NDC3.0.pdf` | Second NDC, 2020-12-29 | 23.5% | 23.5% |
| 3 | ARM | Armenia | NDC 3.0 | 2025-12-31 | `2026-01/Armenia's NDC 3.0.pdf` | First NDC, 2021-05-05 | 40% | 40% |
| 4 | BRA | Brazil | Second Nationally Determined Contribution | 2024-11-13 | `2024-11/Brazil_Second Nationally Determined Contribution (NDC)_November2024.pdf` | First NDC, 2022-04-07 | refused | none (hand-entered, `curated`) |
| 5 | BRN | Brunei Darussalam | NDC 3.0 | 2025-09-16 | `2025-10/[Final] Brunei Darussalam's Nationally Determined Contribution 3.0.pdf` | First NDC, 2020-12-31 | 20% | 20% |
| 6 | COM | Comoros | NDC 3.0 | 2026-03-30 | `2026-03/CDN3.0 Comores..pdf` | First NDC, 2021-11-05 | 84% | 84% |
| 7 | DMA | Dominica | The Commonwealth of Dominica Updated National Determined Contribution | 2022-07-04 | `2022-07/The Commonwealth of Dominica updated NDC July 4 ,.pdf` | First NDC, 2016-09-21 | 44.7% | 44.7% |
| 8 | GNQ | Equatorial Guinea | NDC 2022 Update | 2022-10-24 | `NDC/2022-10/CND-GuineaEcuatorial-Version2022-Actualizada.pdf` | First NDC, 2018-10-30 | 20% | 20% |
| 9 | IDN | Indonesia | Republic Of Indonesia Second NDC | 2025-10-27 | `2025-10/Indonesia_Second NDC_2025.10.24.pdf` | First NDC, 2021-07-22 | 29% | 29% |
| 10 | KHM | Cambodia | Cambodia’s NDC 3.0 | 2025-08-08 | `2025-08/Cambodia-NDC 3.0_0.pdf` | First NDC, 2020-12-31 | refused | 41.7% (frozen `data/khm.json`) |
| 11 | KOR | Republic of Korea | The Republic of Korea's 2035 NDC | 2025-12-26 | `2025-12/The Republic of Koreas 2035 NDC.pdf` | First NDC, 2021-12-23 | 24.4% | none (hand-entered, `curated`) |
| 12 | MDA | Moldova | NDC 3.0 | 2025-05-06 | `2025-05/MD_NDC_3.pdf` | First NDC, 2020-03-04 | 70% | 70% |
| 13 | MNG | Mongolia | NDC 3.0 | 2025-09-24 | `2025-09/Mongolia NDC3_0 under UNFCCC_PA FINAL.pdf` | First NDC, 2020-10-13 | 22.7% | 22.7% |
| 14 | MUS | Mauritius | NDC 3.0 | 2025-09-29 | `2025-09/NDC 3.0  Mauritius.pdf` | First NDC, 2021-10-05 | 30% | 30% |
| 15 | NAM | Namibia | NDC UPDATE | 2024-01-17 | `NDC/2024-01/FINAL UPDATED NAMIBIA NDC 2023.pdf` | First NDC, 2021-07-30 | 89% | 89% |
| 16 | OMN | Oman | NDC 3.0 | 2026-07-30 | `2026-07/The Sultanate of Omans Third Nationally Determined Contributions  (NDC 3.0).pdf` | Second NDC, 2021-07-29 | 7% | 7% |
| 17 | TCD | Chad | First NDC (Updated submission) | 2021-10-19 | `NDC/2022-06/CDN ACTUALISEE DU TCHAD.pdf` | First NDC (archived), 2017-01-12 | 18.2% | 18.2% |
| 18 | TGO | Togo | NDC 3.0 | 2026-09-07 | `2026-09/TOGO_CDN3.0_2026.pdf` | First NDC (archived), 2017-06-28 | 11.14% | 11.14% |
| 19 | TTO | Trinidad and Tobago | Second NDC | 2026-01-26 | `2026-01/Trinidad and Tobago Second NDC  .pdf` | First NDC, 2018-02-22 | 15% | 15% |
| 20 | UGA | Uganda | Uganda's Updated NDC | 2022-09-12 | `NDC/2022-09/Updated NDC _Uganda_2022 Final.pdf` | First NDC, 2021-10-12 | 22% | 22% |
| 21 | VEN | Venezuela, RB | Second NDC | 2025-10-28 | `2025-10/Segunda Contribución Determinada Nacional CDN 2025-2030.pdf` | First NDC, 2021-11-09 | 20% | 20% |
| 22 | 27 EU members: AUT BEL BGR CYP CZE DEU DNK ESP EST FIN FRA GRC HRV HUN IRL ITA LTU LUX LVA MLT NLD POL PRT ROU SVK SVN SWE | (each) | The NDC of the European Union and its Member States | 2025-11-05 | `2025-11/DK-2025-11-05 EU NDC.pdf` | First NDC of European Union and its Member States (joint), 2020-12-18 | refused (mirror `EUU`); 55% attached by hand (`compose.ts` `joint`) | 55% |

### 1.1 The 48 are not all of them

`ndcRegistryOf()` in `engine/build/compose.ts` computes `matches_parsed_document` from `ndc.submission_date`, which is `null` whenever the parser refused the mirrored document. Those records get `null`, not `false`, so neither the `ndc_registry.$note` nor the verdict clause in `engine/build/verdict.ts` says that a later filing exists and was not read. Measured on the same 218 files:

| `matches_parsed_document` | registry has `latest_version` | records |
|---|---|---:|
| `false` | yes | 48 |
| `true` | yes | 3 |
| `null` | yes | 142 |
| `null` | no | 25 |

Of the 142 `null` rows, **120** hold an `ndc_document` whose `submission_date` is earlier than the registry's (120 distinct registry documents; filed 2025: 88, 2026: 21, 2022: 4, 2023: 3, 2021: 2, 2024: 2), 20 have the same date, 1 has no `ndc_document`, 1 has a registry date earlier than the document's. So the registry lists a newer filing than the one the engine read for **168** records (48 + 120), across **142** distinct documents (22 + 120). Sections 2 to 4 cover the 48 as asked; the change in §5 covers all 168.

## 2. Reachability from this machine

Measured 2026-10-10 with `ndc3/reach2.py`, output `ndc3/reach-engine-ua.json`, using the engine's own User-Agent from `engine/sources/_base.ts`.

- **unfccc.int, direct: 0 of 22.** Every distinct `document_url` answered HEAD with HTTP 200 `text/html`, and a GET with `Range: bytes=0-1023` with HTTP 200 `text/html`, 212 bytes, the same body for all 22 (SHA-256 prefix `d02032286070`), carrying Incapsula markers. No PDF.
- **Browser User-Agent: not repeated.** ENGINEERING R9 and §9 list User-Agent spoofing as a forbidden WAF bypass, so this run did not send one. The first, interrupted run of this task (same day, `ndc3/reach.py`, output `ndc3/reach.json`) had sent a browser User-Agent and recorded the same answer for all 22: `200 text/html 212`. A browser User-Agent does not reach the documents either.
- **Wayback Machine captures of the exact unfccc.int URL: 20 of 22.** Checked through the CDX index (`ndc3/cdx.json`) and the availability API (`ndc3/wayback.json`); downloaded with the engine's User-Agent from `web.archive.org/web/<timestamp>id_/<unfccc url>`, which serves the archived bytes and sends nothing to unfccc.int. OMN (filed 2026-07-30) and TGO (filed 2026-09-07) have no capture. Two captures need care:
  - MUS: the newest capture (2026-05-07) is the 212-byte bot page stored as `text/html`; the availability API returns that one, and the first run downloaded it as if it were the PDF. Five earlier captures (2025-09-30 to 2025-11-22) are `application/pdf`; the dry run uses the 2025-11-22 one.
  - TCD: 17 PDF captures of the same URL (20 CDX entries) between 2022-11 and 2026-03, in four distinct record-length groups (about 1.0 MB, 3.7 MB, 20.3 MB, 20.9 MB). The newest has an archived original `Content-Length` of exactly 20,971,520 bytes and a broken cross-reference table (`pdfinfo` fails); `pdftotext` still returns 48 pages of text. Whether this is the complete document is not established.

## 3. Mirror coverage

`ds-06-ndc-docs.ts` reads `openclimatedata/national-climate-plans` (`INDEX_URL`, then `PDF_BASE + Filename`). Fetched 2026-10-10 into `ndc3/mirror/`, not into the engine cache.

- The index has 169 rows (153 First NDC, 14 Second NDC, 2 INDC). The latest `SubmissionDate` is 2022-05-09. Its SHA-256 (`721aa825…`) equals `index_sha256` in the committed `data/ndc-targets.json` (extracted 2026-09-13), so CI reads this same file.
- GitHub reports the repository as archived; the last commit is 2022-06-07, "Mark as archived".
- **Held: 0 of 22.** No row's `EncodedAbsUrl` equals the registry's `document_url`, and no row for these Parties is dated on or after the registry's date. For every one of the 22, the mirror's single row is the document the record was already read from.
- `openclimatedata/ndcs`, the DS-08 source, is live (last push 2026-10-08) but holds 13 files and no PDF: it is the registry index the newer URLs come from, with nothing to read. Its raw rows carry a `language` per document and a separate `EUU` code for the EU (two rows marked Active, 2023-10-19 and 2025-11-05; `ds-08` keeps the later).

There is no source in the engine today, allowed by R9, that holds any of the 22 documents.

## 4. Dry run of the existing reader

**Method.** 20 of the 22 distinct documents, all Wayback captures (§2); OMN and TGO have no bytes and were not run. `ndc3/dryrun.mjs` imports `extract` and `candidatesOf` from `engine/sources/ds-06-ndc-docs.ts` with a relative `.ts` import, as the tests do. `pdfPages()` and `norm()` are not exported, so the script repeats the three-line `pdfPages()` (`pdftotext -q -enc UTF-8 <file> -`, split on form feed, `norm`, drop empties) and builds `norm` by evaluating the module's own source text at run time, so the normalisation is the engine's byte for byte. Refusals are assigned to families with the six `ndc_document.$reason` matchers of `engine/build/views.ts`. Nothing touched the cache or the network during the run; output is `ndc3/dryrun.json`. These rows are the engine's code, not an approximation.

**Counts.**

| | documents | records |
|---|---:|---:|
| accepted | 6 | 6 |
| refused · `doc.multiple-bases` | 10 | 36 (27 of them EU) |
| refused · `doc.no-sentence` | 2 | 2 |
| refused · `doc.unlabelled-percentages` | 2 | 2 |
| refused · `doc.no-text-layer`, `doc.conditional-only`, `doc.unreadable` | 0 | 0 |
| not run (no bytes) | 2 | 2 |

No document was a scan: the lowest text density was 1,631 characters per page (KOR).

| # | Document (records) | Wayback capture | Pages | Outcome | Engine sentence: evidence (accepted) or `$reason` (refused) | Page | Candidates seen | `ndc.reduction_pct` now |
|---|---|---|---:|---|---|---|---|---|
| 1 | DMA Dominica | 2026-05-17 | 110 | **accepted** 45% base-year 2014 → 2030 (medium) | "The Commonwealth of Dominica's Nationally Determined Contributions 1 Summary of Updated NDC By this submission, the Commonwealth of Dominica, communicates an updated and enhanced Nationally Determined Contributions (NDC) in acknowledgement of Article 4 of the Paris Agreement1, with a total greenhous" | 10 | 1 on 1 page(s) | 44.7% |
| 2 | KOR Republic of Korea | 2026-10-04 | 28 | **accepted** 37% bau → 2030 (medium) | "Planning processes Information Information submitted by the Republic of Korea (a) Information on the planning processes that the Party undertook to prepare its nationally determined contribution and, if available, on the Party's implementation plans, including, as appropriate: (i) Domestic instituti" | 9 | 1 on 1 page(s) | none |
| 3 | MDA Moldova | 2026-06-08 | 81 | **accepted** 71% base-year 1990 → 2030 (medium) | "(d) Target relative to the reference indicator, in percentage The Republic of Moldova is committed to an absolute economy-wide target of a 71 percent reduction of its net GHG emissions by 2030 compared to 1990 levels, instead of its unconditional absolute economy-wide reduction target of 70 percent " | 4 | 1 on 1 page(s) | 70% |
| 4 | MUS Mauritius | 2025-11-22 | 51 | **accepted** 40% bau → 2035 (high) | "Mitigation efforts under the NDC 3.0 aim for a 40% reduction in economy-wide GHG emissions by 2035, relative to business-as-usual scenarios." | 4 | 3 on 3 page(s) | 30% |
| 5 | TCD Chad | 2026-03-29 | 48 | **accepted** 19.3% bau → 2030 (high) | "La présente CDN prévoit la réduction cumulée des émissions des GES d'ici à 2030 à 88 350 kt CO2eq (mesures inconditionnelles et conditionnelles) avec un objectif d'atténuation global de 19,3 % par rapport au scénario de référence." | 5 | 4 on 4 page(s) | 18.2% |
| 6 | VEN Venezuela, RB | 2026-01-16 | 280 | **accepted** 20% bau → 2030 (medium) | "permitió definir como meta global, mantener una reducción del 20% de las emisiones de GEI para el 2030, con respecto a la línea base tendencial (2024-2030)." | 31 | 1 on 1 page(s) | 20% |
| 7 | AND Andorra | 2026-02-21 | 17 | refused · `doc.multiple-bases` | "the document states targets on more than one basis or horizon (base-year · 2005 · 2035; bau ·  · 2030); choosing between them would be a guess." | · | 4 on 3 page(s) | 37% |
| 8 | ARE United Arab Emirates | 2026-10-05 | 101 | refused · `doc.multiple-bases` | "the document states targets on more than one basis or horizon (base-year · 2019 · 2035; base-year · 2022 · 2050; base-year · 2024 · 2031; bau ·  · 2050); choosing between them would be a guess." | · | 7 on 5 page(s) | 23.5% |
| 9 | ARM Armenia | 2026-05-04 | 43 | refused · `doc.multiple-bases` | "the document states targets on more than one basis or horizon (base-year · 1990 · 2035; base-year · 2015 · 2040); choosing between them would be a guess." | · | 3 on 2 page(s) | 40% |
| 10 | EU joint NDC (27 records) | 2026-10-01 | 47 | refused · `doc.multiple-bases` | "the document states targets on more than one basis or horizon (base-year · 1990 · 2030; base-year · 2005 · 2030; base-year · 2019 · 2030); choosing between them would be a guess." | · | 4 on 4 page(s) | 55% (hand-attached) |
| 11 | BRA Brazil | 2026-10-02 | 43 | refused · `doc.multiple-bases` | "the document states targets on more than one basis or horizon (base-year · 2005 · 2035; base-year · 2019 · 2030); choosing between them would be a guess." | · | 6 on 3 page(s) | none |
| 12 | BRN Brunei Darussalam | 2026-03-10 | 27 | refused · `doc.multiple-bases` | "the document states targets on more than one basis or horizon (bau ·  · 2030; bau ·  · 2035); choosing between them would be a guess." | · | 5 on 5 page(s) | 20% |
| 13 | COM Comoros | 2026-04-28 | 135 | refused · `doc.multiple-bases` | "the document states targets on more than one basis or horizon (bau ·  · 2030; bau ·  · 2035); choosing between them would be a guess." | · | 7 on 7 page(s) | 84% |
| 14 | KHM Cambodia | 2026-09-21 | 154 | refused · `doc.multiple-bases` | "the document states targets on more than one basis or horizon (bau ·  · 2025; bau ·  · 2035); choosing between them would be a guess." | · | 5 on 5 page(s) | 41.7% |
| 15 | MNG Mongolia | 2026-08-27 | 36 | refused · `doc.multiple-bases` | "the document states targets on more than one basis or horizon (base-year · 2010 · 2030; bau ·  · 2030; bau ·  · 2035); choosing between them would be a guess." | · | 6 on 4 page(s) | 22.7% |
| 16 | TTO Trinidad and Tobago | 2026-04-15 | 21 | refused · `doc.multiple-bases` | "the document states targets on more than one basis or horizon (base-year · 2013 · 2030; base-year · 2013 · 2035; bau ·  · 2035); choosing between them would be a guess." | · | 5 on 3 page(s) | 15% |
| 17 | GNQ Equatorial Guinea | 2025-11-21 | 40 | refused · `doc.no-sentence` | "no sentence in this document states an economy-wide percentage reduction against a base year or a business-as-usual projection." | · | 0 | 20% |
| 18 | IDN Indonesia | 2026-09-07 | 54 | refused · `doc.no-sentence` | "no sentence in this document states an economy-wide percentage reduction against a base year or a business-as-usual projection." | · | 0 | 29% |
| 19 | NAM Namibia | 2026-02-19 | 42 | refused · `doc.unlabelled-percentages` | "the document states 2 different percentages on the same basis (13.1%, 24%) and does not label which is the pledge." | · | 2 on 2 page(s) | 89% |
| 20 | UGA Uganda | 2026-02-14 | 69 | refused · `doc.unlabelled-percentages` | "the document states 4 different percentages on the same basis (5.89%, 5.9%, 18.8%, 24.7%) and does not label which is the pledge." | · | 11 on 6 page(s) | 22% |

The "Engine sentence" column is what the engine would store: `evidence[0].sentence` for an acceptance (cut by the engine at 300 characters), the verbatim `$reason` for a refusal.

### 4.1 What the six acceptances say, read in context

Context around each percentage was printed from the same normalised pages with `ndc3/context.mjs`.

- **KOR 37% is a misreading.** Page 9 is the planning-process history: "The Republic of Korea submitted its Intended Nationally Determined Contribution (INDC) in 2015, setting a target of reducing its GHG emissions by 37% from the business-as-usual (BAU) projection by 2030." The document's own target, on pages 2, 8, 12 and 16, is "53 to 61% reduction in net GHG emissions by 2035 compared to the 2018 level" and "53-61% from 2018 level". The reader skips both spellings of a range by rule (ENGINEERING §4.3: the dash rule and the `to` rule), which leaves the 2015 figure as the only candidate. The existing guard against recounted targets matches only "met", "surpassed", "exceeded" or "achieved" near "target". Accepted as is, the record would print a 2015 figure as Korea's 2035 pledge.
- **Two stored evidence sentences do not contain their figure.** For KOR and DMA the sentence runs past 300 characters before the percentage, so the stored evidence ends at "Domestic instituti" and "with a total greenhous". The figure is on the page (DMA page 10: "…with a total greenhouse gas emissions reduction of 45% below 2014 levels by 2030."). All 50 acceptances on today's records carry their figure inside the stored evidence (measured), so this is new with these longer documents.
- **TCD 19.3% is the conditional scenario in two of its four sentences.** Page 14: "L'objectif fixé dans le scénario conditionnel est de réduire les émissions de GES de 19,3%, en 2030, par rapport à un scénario de référence." Page 18 says the same. Page 5 names "mesures inconditionnelles et conditionnelles"; `conditionOf()` tests for the unconditional words first and tags that sentence unconditional, so the group is not all-conditional, the `doc.conditional-only` refusal does not fire, and confidence is `high`.
- **DMA 45% below 2014 by 2030, MDA 71% below 1990 by 2030, MUS 40% below BAU by 2035, VEN 20% below BAU by 2030** read as the sentences say. MUS gets no BAU projection because the document states two different 2035 BAU totals (7385 Gg CO2e on page 7, 7342 Gg CO2e on page 48), and `bauOf()` takes one distinct figure or none.

### 4.2 What the refusals saw

From `candidatesOf()` (all candidates are in `ndc3/dryrun.json`). These describe the candidates; the reasons the engine would publish are the `$reason` sentences in the table.

- **EU (27 records).** Candidates: 55% below 1990 by 2030 on page 2 (the 2023 update, recounted), 43% below 2019 on page 4, 62% below 2005 on page 18 (the ETS cap), 54% on page 19 (the Commission's May 2025 assessment). The 2035 contribution, on pages 4 and 32, is a range, "a reduction of net GHG emissions of between 66.25-72.5% compared to 1990 by 2035", which yields no candidate. The sentence the hand reading in `compose.ts` `joint` cites (2020 document, page 6, "binding target of a net domestic reduction of at least 55%") does not occur in the 2025 document.
- **BRN, MNG, COM, KHM.** The new document restates an older horizon next to the new one: BRN page 7 recounts NDC 2.0 (20% by 2030) beside 20% by 2035; MNG page 2 recounts the 2015 INDC (14% below 2010 by 2030) beside 30.3% below BAU; COM states 13% unconditional by 2030 beside 57% by 2035; KHM's 55% below BAU by 2035 sits beside a 20% industrial-efficiency figure for 2025.
- **BRA.** 59% below 2005 by 2035 (pages 39, 41) beside the Global Stocktake's 43% and 60% below 2019 by 2030 (page 42); that sentence says "global greenhouse gas emissions", which the `global emissions` guard does not match.
- **ARE.** 47% below 2019 by 2035 (pages 19, 91) beside an aluminium production increase (page 27), an energy-consumption programme (page 33) and a global cooling pledge (page 82).
- **AND, ARM, TTO.** AND: 63% below 2005 by 2035 beside a "45% y 55%" span. ARM: 44% and 52% below 1990 by 2035 beside soil carbon, 1.5% by 2040. TTO: public-transport 30% and 50% beside 15% below BAU and 15% below 2013 by 2035.
- **UGA, NAM.** UGA: 24.7% beside 5.9%, 5.89% and 18.8%, all against BAU in 2030. NAM: 24% beside a 13.1% increase in sink capacity.
- **IDN, GNQ.** No candidate.

### 4.3 Against today's records

Of the 46 records covered, 44 show a figure today. The newer documents yield an accepted figure for 6 of them, and one of the six (KOR) is the misreading above; KOR's `ndc.*` is hand-entered and would not change anyway. If `ndc.*` followed the newer documents with the reader as it is, 5 of the 44 figures would be replaced by the newer document's (DMA, MDA, MUS, TCD, VEN), KHM's would stay (frozen), and 38 would give way to a refusal, 27 of them the EU members.

## 5. The engine change

### 5.0 Prerequisite: a retrieval path R9 allows

The engine's mirror holds none of these documents (§3), and unfccc.int answers none (§2). The only source measured to hold them is the Wayback Machine (20 of 22). R9 allows "a separate publisher's mirror" and forbids "a proxy". Which of the two the Wayback Machine is, is the owner's decision; this document does not make it. Until a path is decided, the engine can only state that the newer filing exists and was not read, which §5.1 makes true for all 168 records.

### 5.1 Make the selector see all 168 (no new source, no network)

- **Where:** `ndcRegistryOf(iso3, i, parsed)` in `engine/build/compose.ts`, the line `const matches = parsed.submission_date == null ? null : parsed.submission_date === r.submission_date;`.
- **Change:** compare the registry date with the document actually read, `docOf(iso3, i)?.submission_date`, instead of `ndc.submission_date`.
- **Effect (measured on today's files):** 120 records move from `null` to `false`. They then get the existing `$note` ("The document this record was built from is dated …. The registry's latest active submission is …, dated …, and has not been read; no figure above comes from it."), the existing verdict clause in `verdict.ts` ("A later submission, …, was filed on …; it has not been read, so no figure here comes from it."), and the `registry` row in `vintages` (`lib/story.ts`). No new sentence is needed. Goldens for those 120 records change and must be accepted in the CI refresh, not rebuilt locally.

### 5.2 Read the registry's active document when it is newer

- **Where the facts already are.** `collect()` in `engine/sources/ds-08-ndc-registry.ts` returns, per ISO3, `version` (the submission title, e.g. "NDC 3.0"), `submission_date`, `document_url` (always https on unfccc.int) and `active`. The raw rows also carry `ndcs[].language`, which `ds-08` does not keep. `parseAll()` in `engine/sources/ds-06-ndc-docs.ts` reads only the mirror index (`Code`, `Filename`, `EncodedAbsUrl`, `Kind`, `SubmissionDate`).
- **Change, in `parseAll()`:** call `registry.collect(refresh)`. For each ISO3 whose registry entry is `active`, has a `document_url` and a `submission_date`, and is newer than the mirror row's `SubmissionDate` (or has no mirror row), fetch that document through the decided path with `snapshot()` under a filename that cannot collide with the mirror's (for example `<ISO3>_registry_<submission_date>.pdf`), then run the same `pdfPages()` and `extract()`. Fill the `NdcTarget` with `kind: r.version`, `document_url: r.document_url` (what the reader is shown, R9), `retrieval_url` set to the URL actually fetched (for a Wayback capture it names the capture timestamp), `submission_date: r.submission_date`, and `language` from the raw `ndcs[].language` once `ds-08` keeps it, otherwise `''`. `document_sha256` and `document_retrieved_at` are filled as now. A file that is not a PDF fails `pdftotext` and already lands in the existing `doc.unreadable` reason; no new sentence is needed. For a Wayback path, take the newest capture whose CDX `mimetype` is `application/pdf` with status 200, not the availability API's answer (MUS, §2).
- **One fetch per document.** No EU member has its own row in the mirror index (measured), so "no mirror row" is true for all 27 and each would fetch the same EU document. Skip a Party whose registry `document_url` belongs to a bloc in `compose.ts` `joint`, and fetch that document once under the bloc's own registry entry (`EUU`, which the registry index carries).
- **One document per Party stays.** `data/ndc-targets.json` and `collect()` are keyed by ISO3 and `compose.ts` reads one target per Party. The registry document replaces the mirrored one as the target. The older reading is kept on the target as an additive field (for example `superseded`, with the same `kind`, `submission_date`, `document_url`, `reduction_pct`, `basis`, `base_year`, `target_year`, `evidence` or `$reason`).
- **CI.** `.github/workflows/refresh.yml` already runs `node engine/cli.ts ndc-parse --refresh` weekly and installs poppler, so no workflow change is needed. The run gains up to 142 downloads (22 + 120) at the one-request-per-second spacing in `_base.ts`; the largest file in this sample is 31.6 MB (VEN).

### 5.3 What the record should then say

`ndc.*` and `ndc_document` follow the newest document read; the earlier reading stays visible as a vintage. Exposing it on the record is a new key (R7 additive: a schema entry in `engine/contract/schema.ts`) and R6 then requires its render, which is the `vintages` list that already exists.

- **Newer document accepted.** `$meta.mode: 'document-parsed'`; `$meta.snapshot: '<registry version> · <year>'` (e.g. "NDC 3.0 · 2025"); `$meta.notice` keeps its current template, which stays true: "<pct>% by <year> was read out of the document by DS-06-NDC, not tabulated by it. The sentence it came from is on the record." `ndc_registry.matches_parsed_document` becomes `true`, so the registry's `$note` and verdict clause switch to their existing "current submission" wording. `vintages`: `assessment` (CAIT, unchanged), `record` (the registry version, `read`), and the earlier document as a `read` vintage with its own figure, date and source; the `registry` "unread" row disappears.
- **Newer document refused.** `ndc_document` carries the refusal with its existing `$reason`; `ndc.reduction_pct` is `null`. `metaFor()` then falls to `observations-only`, whose notice reads "No NDC target has been parsed for this country." That sentence is not accurate once the current filing was read and refused; `metaFor()` needs a branch for this case whose notice names the filing (registry version and date), says no figure was accepted from it, and points to the reason on the record. `vintages`: `record` (the registry version, `unread`, carrying the refusal), and the earlier document as a `read` vintage with its figure. The earlier figure is never presented as the current pledge.
- **No bytes (OMN and TGO today).** Unchanged: the older reading stays as `ndc.*`, `matches_parsed_document: false`, and the existing note and verdict clause say the later filing was not read.
- **`$note` on `ndc_document`.** `ndcDocumentOf()` writes "Read by DS-06-NDC from the <kind> as mirrored by openclimatedata"; for a registry document that clause must name the path actually used, taken from `retrieval_url`.
- **Hand-entered rows.** KHM (`data/khm.json`, frozen, not to be edited) and the `curated` KOR and BRA rows win over `ndc_document` for `ndc.*` (`doc = c ? undefined : ndcDoc`). The change leaves them as they are; their `ndc_document` and registry flag still move.

### 5.4 Before switching (R10)

Pin the traps found here as regression cases in `engine/__tests__/ndc-extract.test.ts`, each a real sentence from these documents, before any record is rebuilt:

1. KOR page 9: a recounted earlier target ("submitted its … INDC in 2015, setting a target of … 37% … by 2030") is not the pledge.
2. KOR and DMA: the stored evidence must contain the figure. Today it is the first 300 characters of the sentence; it needs to be a window that includes the percentage, applied only where the figure falls outside the first 300 characters, so the 50 existing evidence strings do not move.
3. TCD page 5: a sentence naming both "inconditionnelles et conditionnelles" is not evidence of an unconditional figure.
4. KOR "53 to 61%" and EU "between 66.25-72.5%": range targets keep refusing (they already do; pin it). Storing a range needs a contract key (ENGINEERING §4.5).

## 6. Risks

- **The joint EU document.** The registry's current EU filing (2025-11-05) states its 2035 contribution only as a range, and the reader refuses the document (`doc.multiple-bases`). The 55% hand reading in `compose.ts` `joint` is cited to page 6 of the 2020 document, and that sentence is not in the 2025 one, so it cannot be carried over as a reading of the new document. Under §5.3 the 27 members would show the refusal as current and 55% (2020) as the earlier vintage, unless the owner decides to hand-read the 2025 document, which as a single figure needs a range key first. `docOf()` attaches the bloc document when a member's registry `version` matches `/European Union and its Member States/` (all 27 read "The NDC of the European Union and its Member States" today) and then looks it up under `EUU` in the targets; after §5.2 that `EUU` target must be the registry's 2025 document, not the archived mirror's 2020 one.
- **Scans.** None of the 20 documents here is a scan. The existing `doc.no-text-layer` rule covers the case if one appears among the other 120.
- **Several bases and restated history.** 10 of the 14 refusals are `doc.multiple-bases`, mostly because the newer documents recount the previous target (BRN, MNG, EU, COM) or quote global or sectoral figures (BRA, ARE, EU, TTO). Loosening that gate to raise the count is what R10 forbids; KOR shows the opposite failure, where the recounted figure is the only one left and is accepted.
- **Capture integrity.** The same unfccc.int URL has been captured with different bytes over time (TCD: four record sizes), and one capture is the bot page (MUS). The target must carry the capture timestamp in `retrieval_url` and the `document_sha256`, as the type already allows.
- **Census and documents.** Today 46 of these 48 records show a figure. With §5.3 and the reader as it is, 8 would: the 5 newer acceptances other than KOR (whose `ndc.*` is hand-entered), KHM (frozen), and OMN and TGO (no bytes, unchanged). The census "read" count drops, `docs/PRD.md` numbers that `tests/prd-census.test.ts` ties to the census move, and the weekly PR carries those differences for a person to read.
- **Local rebuilds.** All of this has to run in CI. The local engine cache is older than CI's, and a local rebuild regresses all 218 records.

## 7. Time estimate

An estimate, not a measurement. It assumes the retrieval path in §5.0 has been decided.

| Step | Estimate |
|---|---|
| §5.1 selector fix, goldens accepted through the CI refresh | half a day |
| §5.4 regression cases, evidence window, `conditionOf` fix | one day |
| §5.2 registry pass in `parseAll()` (CDX lookup, snapshot naming, `ds-08` keeping `language`) | one day |
| §5.3 additive key, schema entry, `metaFor()` branch, `ndcDocumentOf()` note, `vintages` render | one day |
| PRD and census numbers, one CI refresh (about 11 minutes per run) and PR review | half a day |
| **Total** | **about four working days** |

The EU decision (§6) and the R9 decision (§5.0) are not engineering time and are not included.

## Not run, and why

- No browser-User-Agent probe (R9, §9); the first run's result is cited with its file.
- OMN and TGO: no bytes anywhere measured, so not dry-run.
- No `npm run engine:*`, `engine/cli.ts`, cache, `data/` or `public/data/` access beyond reading the committed records, `data/ndc-targets.json` and `public/data/refusals.json`.
- The 120 additional records of §1.1 were counted but not downloaded or dry-run.
