# BTR attachments: can the engine read the CTF and CRT workbooks? (2026-10-10)

Status: complete for this round. Research and a prototype on downloaded files only. No engine
code changed, no record written, no `npm run engine:*` run.

## 1. Counts (measured from `data/countries/*.json`, 218 records)

| Measure | Count |
|---|---|
| `btr.submitted === true` | 134 |
| `btr.submitted === null` | 84 |
| `btr.submitted === false` | 0 |
| Parseable sockets (134 x 6, adaptation and article6 excluded) | 804 |
| Sockets `observed` (all by attachment filename) | 328 |
| `ctf` observed, with `$evidence` filenames | 100 |
| `crt` observed, with `$evidence` filenames | 105 |
| `ndc_track` / `nir` / `finance` / `redd_plus` observed | 19 / 84 / 13 / 7 |
| `adaptation`, `article6` observed | 0, 0 (by design) |

No socket value is read from inside any file today.

## 2. Five records with a CTF attachment name, and Cambodia

Chosen because each names a file in the standard UNFCCC reporting-tool form
(`<ISO>-CTF-NDC-2024...xlsx`). Values below are copied from the records.

| Record | `ctf.$evidence` | `crt.$evidence` (first three, as stored) |
|---|---|---|
| CHE | `CHE-CTF-FTC-2024-V1.0-20241213-133400.xlsx`, `CHE-CTF-NDC-2024-V1.0-20241213-115754.xlsx` | `CHE-CRT-2024-V1.0-1990/1991/1992-...xlsx` |
| DEU | `DEU-CTF-FTC-2024.xlsx`, `DEU-CTF-NDC-2024.xlsx` | `DEU-CRT-2024-V1.1-1990/1991/1992-..._started.xlsx` |
| KEN | `KEN-CTF-FTC-2024-V0.1.xlsx`, `KEN-CTF-NDC-2024-V0.1-20241231-191105_started.xlsx` | `KEN-CRT-2024-V0.3-1990/1991/1992-..._approved.xlsx` |
| CHL | `CHL-CTF-FTC-2024.xlsx`, `CHL-CTF-NDC-2024.xlsx` | `CHL-CRT-2024-V0.0-1990/1991/1992-20241230.xlsx` |
| SWE | `SWE-CTF-FTC-2024.xlsx`, `SWE-CTF-NDC-2024.xlsx` | `SWE-CRT-2024-V0.4-1990/1991/1992-..._started.xlsx` |

`ds-btr.ts` keeps at most three names per component, sorted, so the CRT
evidence always shows the earliest years, never the latest.

**Cambodia (KHM).** The record says `submitted: true`, `submission_date:
2024-12-31`, `published_date: 2025-02-06`, `document_url:
https://unfccc.int/documents/645175`, and all eight sockets `unknown` with the
reason "Cambodia's BTR1 has been located and dated by hand, but its attachments
have not been read, so nothing evidences this component yet." Two things in
the code put it there:

1. `engine/build/compose.ts:528` loads `data/khm.json` as `frozen` for KHM
   only, and `compose.ts:593` sets `btr: frozen ? frozen.btr : btrOf(iso3, i)`.
   KHM's `btr` block is the hand-written one in `data/khm.json`; `btrOf()`
   and the filename patterns never run for Cambodia.
2. Even if they did, the mirror's `downloaded_data/UNFCCC/Cambodia/BTR1/`
   holds two files, `Cambodia_BTR1%E2%80%8B.pdf` and
   `Official_BTR1_Cambodia.pdf` (tree fetched 2026-10-10). Neither name
   matches any of the six patterns in `ds-btr.ts`, so `btrOf()` would also
   leave every socket unknown. The mirror holds no CTF or CRT file for
   Cambodia. (The KHM record's `sources[]` row shows `records: 2`, which is
   that two-file count from `compose.ts:262`.)

## 3. Reachability (probed 2026-10-10, 16:00 UTC, from this machine)

**Where the bytes are.** Every BTR1 file in the GitHub mirror is a git-annex
symlink (mode 120000, about 140 bytes). The symlink text names a
content-addressed key, for example
`MD5E-s95565--a4709a33437b0319fc491b6039f7fdb2.xlsx` for
`CHE-CTF-NDC-2024-V1.0-20241213-115754.xlsx` (size and MD5 in the key). The
mirror's `git-annex` branch, file `remote.log`, declares two content
remotes:

- `gin-src`, `https://gin.hemio.de/jguetschow/UNFCCC_non-AnnexI_data.git`
- `public-r2`, type S3, bucket `primap-datalad-unfccc-data`,
  `publicurl=https://pub-550cb70a20574daa8b2d1f979876bf4b.r2.dev`
  (first entry timestamp 1746598125, i.e. 2025-05-07)

The location logs for the CHE CTF and CHE CRT keys list `public-r2`
(uuid `f1aecc3f-...`) as holding the content. ENGINEERING M11 (2026-09-11)
checked GIN only; the R2 remote is the path it did not record.

| Probe | Result |
|---|---|
| R2 `HEAD` CHE CTF-NDC key | 200, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, 95,565 B, ETag = key MD5 |
| R2 `HEAD` DEU CTF-NDC key | 200, same type, 83,068 B, ETag = key MD5 |
| R2 `HEAD` KEN CTF-NDC key | 200, same type, 979,314 B, ETag = key MD5 |
| R2 `HEAD` CHL CTF-NDC key | 200, same type, 111,183 B |
| R2 `HEAD` SWE CTF-NDC key | 200, same type, 89,288 B |
| R2 `HEAD` CHE CRT 2022 key | 200, same type, 3,690,547 B |
| R2 `GET` CHE, DEU, KEN CTF-NDC | full body; MD5 of each body equals the MD5 in its annex key |
| R2 `HEAD` with curl's default User-Agent | 200; no browser UA needed |
| R2 bucket root | 404 (no listing; a key must be known first) |
| `gin.hemio.de` | connection refused (curl exit 7), as in M11 |
| `raw.githubusercontent.com` for the CTF path | 200, 138 B: the symlink text, not the workbook |
| `unfccc.int/documents/645175`, curl default UA | 200 `text/html`, 850 B Incapsula iframe page |

A browser-like User-Agent was used for GitHub and R2 only. It was not sent
to unfccc.int: R9 forbids UA spoofing there, and the R2 path makes it
unnecessary.

Files in `scratchpad/btr/files/` (five, the cap): the three CTF-NDC workbooks
above plus the CHE and DEU 2022 CRT workbooks. An earlier, interrupted run of
this task saved them from R2; this run re-fetched the three CTF bodies from R2
and checked all five: each file's MD5 equals the MD5 in its annex key.

## 4. Coverage of the R2 path (HEAD only, 2026-10-10)

For every file named in a record's `ctf.$evidence` or `crt.$evidence`, the
symlink text was read from `raw.githubusercontent.com` and the annex key sent
as `HEAD` to the R2 public URL. Script: `scratchpad/btr/coverage.py`.

| | Names in `$evidence` | Answer 200 on R2 | Parties | Parties with at least one file on R2 |
|---|---|---|---|---|
| `ctf` | 192 | 192 | 100 | 100 |
| `crt` | 352 | 352 | 105 | 105 |

60 of the CRT names are a symlink to a sibling folder (the mirror unpacked a
zip there), so they need a second hop before the annex key. File types among
the CTF names on R2: 185 `.xlsx`, 3 `.zip`, 2 `.xlsm`, 2 `.pdf`. The 192 CTF
objects total 120,114,730 bytes; the largest is 7,821,972 bytes.

Of the 100 Parties with a CTF name, 62 have a name in the reporting-tool form
`<ISO>-CTF-NDC-*.xlsx`, and 88 have a name containing "ndc", "progress" or
"track". `$evidence` keeps at most three names per socket, so these two
counts are a floor taken from filenames, not a measure of workbook layout.
Layout was measured in three workbooks only (section 5).

**The unfccc.int URL for each file is in the mirror.** The mirror's
`downloaded_data/UNFCCC/00_new_downloads_BTR1-<date>.csv` files (44 of them,
all 44 answer 200 on R2) have the columns `Kind,Country,Title,URL`. Rows found:

| CSV | Row |
|---|---|
| `...-2024-12-16.csv` | `CRT,Switzerland,...,https://unfccc.int/sites/default/files/resource/CHE-CRT-2024-V1.0-20241211-180354.zip` |
| `...-2024-12-17.csv` | `BTR1,Switzerland,... CTF-NDC,https://unfccc.int/sites/default/files/resource/CHE-CTF-NDC-2024-V1.0-20241213-115754.xlsx` |
| `...-2025-01-06.csv` | same form for `CHL-CTF-NDC-2024.xlsx`, `DEU-CTF-NDC-2024.xlsx`, `KEN-CTF-NDC-2024-V0.1-20241231-191105_started.xlsx`, `SWE-CTF-NDC-2024.xlsx` |
| `...-2025-01-14.csv` | `CRT,Germany,...,https://unfccc.int/sites/default/files/resource/DEU-CRT-2024-V1.1-20241206-101928_started.zip` |

The CSV date is the mirror's download date. It is not a submission date and
must not fill `btr.submission_date`.

## 5. Workbook structure as measured

Reader: `scratchpad/btr/xl.py`, Python 3.9 stdlib only (`zipfile`,
`xml.etree`), run as `python3 -I xl.py <file> [sheet] [cell|maxrow]`. It has a
self-check (`--demo`). No xlsx package is installed in `node_modules`
(`fflate` 0.7.5 is there only as a transitive dependency). The engine already
has its own reader, `engine/sources/_xlsx.ts`, used by `ds-05-edgar.ts`.

**CTF-NDC sheets.** CHE and DEU: `Index sheet`, `Appendix`, `Table1`,
`Table2`, `Table3`, `Table4.1`, `Table5` to `Table12` (DEU has no `Table9`).
KEN: `Index sheet`, `Appendix`, `Table1` to `Table3`, `Table4.1`, `Table5`,
`Table6`, `Table12`. The CHE `Index sheet` names the tables (cells C5:C17):

| Sheet | Title (as written in the file) |
|---|---|
| `Table1` | Structured summary: Description of selected indicators |
| `Table2` | Structured summary: Definitions needed to understand the NDC |
| `Table3` | Structured summary: Methodologies and accounting approaches |
| `Table4.1` (Index says `Table4`) | Structured summary: Tracking progress made in implementing and achieving the NDC under Article 4 of the Paris Agreement |
| `Table5` | Mitigation policies and measures, actions and plans |
| `Table6` | Summary of greenhouse gas emissions and removals in accordance with the common reporting table 10 |
| `Table7` to `Table9` | Projections: with measures, with additional measures, without measures |
| `Appendix` | Description of a Party's nationally determined contribution under Article 4 |

**Where the reader's cells are.**

- The NDC target as the Party states it: `Appendix!C7` (target and type),
  `C8` (target year or period), `C9` (reference point or base year). Prose
  in CHE and DEU; in KEN `C9` is the number 2010.
- The indicator and its reference: `Table1!B7` (indicator name), `C8`
  (reference point). Prose in all three.
- The numbers: `Table4.1`, row 6 headers, row 7 year labels, row 9 the
  first indicator. Column letters move between Parties: CHE and DEU have
  two reporting years (E, F) so the target level is in G; KEN has three
  (E, F, G) so the target level is in H and the target year in I.
- Year labels are text in some cells (`'2021'`, `'1990-1990'`) and numbers
  in others (DEU `D7` = 1990, KEN `D7` = 2030). Header text carries the
  literal escape `_x000D_` or `_x000d_`.
- Units are per row in column C and differ inside one table: KEN row 9 is
  `t CO2 equivalent`, row 10 is `kt CO₂ equivalent`.

**CRT.** One workbook per inventory year, 33 per Party for CHE and DEU
(1990 to 2022). The CHE 2022 workbook has 61 sheets. `Summary2` ("SUMMARY 2
SUMMARY REPORT FOR CO2 EQUIVALENT EMISSIONS") carries the year in `K1`, the
Party in `K3`, units in `C9` (`CO2 equivalents (kt )`), and the national
totals in rows 71 to 74, column K, labelled in column J.

## 6. Figures read, with cell addresses

`num` = a number cell; `text` = a string cell. Values are copied from the
file as stored.

**CHE-CTF-NDC-2024-V1.0-20241213-115754.xlsx**, 95,565 B, sha256
`c98742050803882ec66c33fd21c62d80b5ab2d3809c63767e68bdc51bd91352b`,
unfccc.int URL in section 4.

| Cell | Kind | Value |
|---|---|---|
| `Appendix!C7` | text | "Absolute economy-wide emission reduction target compared with a base year. Emission reduction of at least minus 50 percent by 2030 compared with 1990 levels, implemented as an emission budget covering 2021–2030, which is equivalent to an average reduction of net greenhouse gas emissions of at least 35 percent over the period 2021–2030." |
| `Appendix!C9` | text | "Base year: 1990 ... A provisional value for base year emissions ... is 52.1 million tonnes of CO2 equivalents ..." |
| `Table1!B7` | text | "Total emissions and removals" |
| `Table1!C8` | text | "52098.58 kt CO2eq (1990)" |
| `Table4.1!C9` | text | "kt CO₂ equivalent" |
| `Table4.1!D7` / `D9` | text / num | "1990-1990" / 52098.58 |
| `Table4.1!E7` / `E9` | text / num | "2021" / 43863.87 |
| `Table4.1!F7` / `F9` | text / num | "2022" / 42063.519999999997 |
| `Table4.1!G9` (Target level) | num | 338640.74 |
| `Table4.1!H9` (Target year or period) | text | "2021-2030" |
| `Table4.1!I9` (Progress) | text | "As Switzerland's absolute economy-wide emission reduction target is implemented as an emission budget covering the years 2021–2030, tracking progress ... is challenging. ..." |

**DEU-CTF-NDC-2024.xlsx**, 83,068 B, sha256
`61d5f6f7844697c57bcf317aff946b9763553536edf375fc595a43e4d2ec87fd`.

| Cell | Kind | Value |
|---|---|---|
| `Appendix!C7` | text | "Economy-wide net domestic reduction of at least 55% in greenhouse gas emissions by 2030 compared to 1990. ..." |
| `Appendix!C9` | text | "Base year: 1990. Net greenhouse gas emissions level in 1990: 4 699 405 kt CO2eq." |
| `Table1!C8` | text | "The reference level is total net GHG emissions of the EU in the base year (1990). The reference level value for the EU is 4 699 405 kt CO2eq." |
| `Table4.1!B9` / `C9` | text | "Annual total net GHG emissions" / "kt CO₂ equivalent" |
| `Table4.1!D7` / `D9` | num / num | 1990 / 4699405 |
| `Table4.1!E7` / `E9` | text / num | "2021" / 3272650 |
| `Table4.1!F7` / `F9` | text / num | "2022" / 3205223 |
| `Table4.1!G9` / `H9` | num / num | 2114732 / 2030 |
| `Table4.1!I9` | text | "The most recent level of the indicator is 31.8 % below the base year level." |

**KEN-CTF-NDC-2024-V0.1-20241231-191105_started.xlsx**, 979,314 B, sha256
`675b43eaf9eb0f774f168e7c38f0dbe0c48f62505239787eb5f4f9c22d0f0d64`.

| Cell | Kind | Value |
|---|---|---|
| `Appendix!C7` | text | "An economy-wide absolute emissions target to abate GHG emissions by 32% by 2030  relative to the BAU scenario of 143,000,000 tCO2eq" |
| `Appendix!C8` | text | "Kenya's NDC is a single-year target, with target year of 2030" |
| `Appendix!C9` | num | 2010 |
| `Table1!C8` | text | "Base year: 2010 Reference point (baseline GHG emissions in 2010): 69,000,000 tCO2 eq" |
| `Table4.1!B9` / `C9` | text | "Annual total greenhouse gas emissions and removals in tCO2eq" / "t CO2 equivalent" |
| `Table4.1!D7` / `D9` | num / num | 2030 / 143000000 |
| `Table4.1!E7` / `E9` | text / text | "2020" / "NA" |
| `Table4.1!F7` / `F9` | text / num | "2021" / 140668000 |
| `Table4.1!G7` / `G9` | text / num | "2022" / 113366000 |
| `Table4.1!H9` (Target level) / `I9` (Target year) | num / num | 97000000 / 2030 |
| `Table4.1!J9` | text | "The most recent level of the indicator is 19.4% below the start of the NDC implementation period (2021), demonstrating Kenya is on track to meet its 2030 NDC target." |
| `Table4.1!C10`, `F10`, `G10` | text, num, num | "kt CO₂ equivalent", 140668, 113366 |

**CRT, national totals for 2022 (the latest year in both Parties' BTR1),
`Summary2`, column K, unit kt CO2 eq per `C9`.**

| File | sha256 | `K71` without LULUCF | `K72` with LULUCF | `K73` incl. indirect CO2, without LULUCF | `K74` incl. indirect CO2, with LULUCF |
|---|---|---|---|---|---|
| `CHE-CRT-2024-V1.0-2022-20241211-180354.xlsx` (3,690,547 B) | `97e886d5ead76a75d8cfffd5016f53185606d99c7d855d957d50c32587f93032` | 41536.13493148299 | 41969.230765461114 | 41630.42235231145 | 42063.51818628957 |
| `DEU-CRT-2024-V1.1-2022-20241206-101928_started.xlsx` (3,293,930 B) | `808bf097f6742a88387b39d8568f07ca5f274e52702e53402bed7acb07019f8d` | 749963.1071889113 | 754344.7592142847 | 749963.1071889113 | 754344.7592142847 |

Beside the records (copied, not compared):

| Record | `emissions_profile.total_mtco2e` | `latest_year` | `source_id` | Same record, `by_source` DS-35 point for 2022 | DS-40 (UNFCCC DI) point for 2022 |
|---|---|---|---|---|---|
| CHE | 40.11 | 2024 | DS-35 (Our World in Data) | 40.751 | none in the record |
| DEU | 659.655 | 2024 | DS-35 | 759.795 | none in the record |

One cross-file fact: CHE `Table4.1!F9` (CTF, 2022) is 42063.519999999997 and
CHE CRT 2022 `Summary2!K74` is 42063.51818628957. Both round to 42063.52.

## 7. Engine change needed

Follow the Pattern D layout (ENGINEERING §4.1): a parse command that needs
the network writes a committed JSON file, and the build reads only that file.

1. **New source step** (for example `engine/sources/ds-btr-tables.ts`, run by
   a new `cli.ts` subcommand, writing `data/btr-tables.json`):
   - From the DS-BTR tree snapshot already fetched, list for each Party
     every CTF-NDC workbook (not the three-name cap) and the CRT workbook
     with the highest year in its name.
   - Read each symlink text from `raw.githubusercontent.com` (one or two
     hops) to get the annex key `MD5E-s<size>--<md5>.<ext>`.
   - GET `https://pub-550cb70a20574daa8b2d1f979876bf4b.r2.dev/<key>` with
     the engine's own User-Agent. Refuse the file if its size or MD5 differs
     from the key. Snapshot it with sha256 as other sources do.
   - Take `document_url` from the mirror's `00_new_downloads_BTR1-*.csv` row
     (the unfccc.int URL). Show that URL; record R2 as the retrieval path
     (R9).
2. **`_xlsx.ts`** returns rows as string arrays and drops the cell
   reference. Add a variant that returns `{ref, kind, value}` per cell, so
   every value carries `Sheet!Cell` (R8). The row number cannot be taken
   from array position: the sheet XML can omit rows.
3. **Table 4 reader.** Find the sheet whose `B2` begins "4. Structured
   summary: Tracking progress". Find columns by the row-6 header text
   ("Reference point", "Implementation period", "Target level", "Target
   year or period", "Progress made"), years by row 7 (text or number), and
   indicator rows from row 9 until the row whose `B` begins "Where
   applicable". Accept only `num` cells as values. Keep `Appendix!C7` and
   `Table1!C8` verbatim as quoted text; never parse a number out of them
   (R10).
4. **CRT reader.** `Summary2`, find the rows labelled in column J
   "Total CO2 equivalent emissions with LULUCF" and "without LULUCF"; read
   column K; check `K1` equals the year in the filename and `K3` names the
   Party.

**Record fields (all additive, R7; each needs a rendered section, R6).**

- New optional block, for example `ndc_progress`: `document_url`,
  `retrieval_url`, `file_sha256`, `indicator` (label, unit, cell),
  `reference` (label as written, value, cell), `series` (year, value,
  unit, cell), `target_level` and `target_period` (value, cell),
  `target_text` and `progress_text` (quoted, with cell), `state`,
  `$reason`.
- `emissions_profile.by_source`: one more entry, source `DS-BTR` CRT, scope
  stated as "total with LULUCF as the Party reported it in its CRT", one
  point per year read. R3: kept beside the other sources, not merged, and
  `total_mtco2e` untouched.

**Sockets.**

- `ctf`: `state` stays `observed`. `$evidence` changes from a filename to a
  cell citation, `<file>!Table4.1!F9`, when a value was read. A filename
  entry stays only where nothing was read.
- `ndc_track`: today `unknown` for CHE, DEU and KEN (their CTF filenames do
  not match the `ndc_track` pattern). A Table 4 with at least one `num` cell
  is a section location under ENGINE-BUILD M3 and would set `observed` with
  the cell citation as `$evidence`.
- `crt`: `$evidence` becomes `<file>!Summary2!K72` for the year read.
- Nothing becomes `absent` (R1). A table read as empty proves the table is
  empty, not that the Party reported nothing elsewhere in its BTR.

**Refusal sentences (proposed; the engine carries none of these today).**
Each fills the Party, file and cell, so no two records share one (§4.4).

- Empty table: "`<file>` has a Table 4 sheet, but its indicator rows hold no
  number in any year column, so no progress figure has been read for
  `<Party>`. This is an empty table, not a missing report."
- Prose only: "`<file>` reports `<Party>`'s indicator only as text
  (`<Sheet>!<Cell>`: "<first 80 characters>"). A number inside a sentence
  is not read as a figure, so none is shown."
- Other Party's figure: "`<file>` states in `Table1!C8` that its reference
  level is the EU's, so its Table 4 figures describe the EU's NDC, not
  `<Party>`'s own emissions, and are not shown as `<Party>`'s."
- Layout not recognised: "`<file>` has no sheet whose title reads
  'Structured summary: Tracking progress', so its layout is not the
  reporting tool's and nothing was read from it."
- Integrity: "`<file>` did not match the size and MD5 the mirror records
  for it, so it was not read."

## 8. Licence and terms

- Mirror repository `JGuetschow/UNFCCC_non-AnnexI_data`: `LICENSE`,
  Apache-2.0 (GitHub API). The README names GIN as a "common data source
  which can be accessed by everyone" and points users to Zenodo releases.
  It does not mention the R2 bucket; the bucket is declared in the
  repository's own `git-annex` branch (`remote.log`, `autoenable=true`), so
  `datalad get` uses it for any clone.
- The workbooks are UNFCCC submissions. UNFCCC's terms of use could not be
  read from this machine (unfccc.int returns the Incapsula page). The
  engine's current string, "mirror tooling Apache-2.0; the filings
  themselves are UNFCCC public submissions", is unchanged by this note and
  no further licence is claimed here.

## 9. Risks

1. **A member state's CTF can carry the EU's figures.** DEU `Table1!C8`
   says the reference level is the EU's, 4 699 405 kt CO2eq, which is the
   value in `Table4.1!D9`. DEU `Table4.1!F9` (2022) is 3205223, while
   Germany's own CRT for 2022 has 754344.7592142847 in `Summary2!K72`. Put on
   Germany's record as German figures, the Table 4 values would be false.
   How many EU member states do the same was not measured.
2. **The "reference point" column is not always a base year.** KEN `D7` is
   2030 and `D9` is 143,000,000 t (the BAU in `Appendix!C7`), while
   `Appendix!C9` and `Table1!C8` give base year 2010 and 69,000,000 tCO2eq.
3. **Column letters, units and year types move** between Parties
   (section 5). A reader keyed on fixed addresses would misread KEN.
4. **Layout measured in three workbooks.** 38 of 100 Parties have no
   reporting-tool filename among their stored CTF names; free-form files
   (for example MDV `CTF tables 1 - Structured Summary v2.0.xlsx`) may not
   follow the layout. Expect refusals.
5. **Several workbooks per Party.** NOR lists `NOR-CTF-NDC-2024.xlsx` and
   `NOR-CTF-NDC-2024_resubmission.xlsx`; GUY lists a revised copy. A rule is
   needed (for example the latest CSV row), and disagreement between copies
   should be a refusal.
6. **Status suffixes are not submission status.** The KEN file ends
   `_started` and still sits at an unfccc.int URL in the mirror's CSV. The
   existing `NOT_SUBMITTED` filter does not match `_awaiting_approval`
   (BLR, ITA, JPN names).
7. **R2 is a third party's bucket**, undocumented in the README, and can
   change or disappear. The annex key's size and MD5 make any copy
   checkable, wherever it is served from. GIN refused connections on
   2026-09-11 and again today.
8. **Floating-point literals.** CHE `F9` is stored as 42063.519999999997.
   Store the literal; round only for display.
9. **CRT `$evidence` today shows the earliest three years** (1990 to 1992),
   because of the three-name cap and sort in `ds-btr.ts`.

## 10. Time estimate

Not measured; an estimate from the parts above, for one engineer who knows
this engine.

| Part | Estimate |
|---|---|
| Resolver: tree to annex key to R2, MD5 check, CSV URL | 0.5 day |
| `_xlsx.ts` cell-reference variant and its test | 0.25 day |
| Table 4 reader with header matching, refusals, tests on the three files | 1 day |
| CRT `Summary2` reader and test | 0.5 day |
| Contract additions, `compose.ts`, rendered section (R6), census/PRD tests | 1.5 days |
| Run over 100 Parties, read every refusal, write the trap table (§4.3 style) | 1.5 days |
| **Total** | **about 5 days** |

## What this note did not do

- No engine code, record, cache or `data/` file was changed; no
  `npm run engine:*` was run.
- At most five files were downloaded; layout across the other 97 CTF
  Parties is not measured.
- No browser-like User-Agent was sent to unfccc.int (R9).
- SWE and CHL workbooks were probed with `HEAD` only and not opened.
