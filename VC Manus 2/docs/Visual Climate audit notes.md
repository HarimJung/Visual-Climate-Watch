# Visual Climate audit notes

## Scope
Audited routes, tRPC contracts, chart components, responsive CSS, integration dashboard, and desktop/mobile captures on 2026-09-06.

## Confirmed visual strengths
The editorial system is coherent: strong typographic hierarchy, restrained blue/violet/orange accents, source IDs, quality notes, and the evidence-first route structure. Country Profile is the strongest analytical screen because it combines a two-series emissions line chart, KPI blocks, vulnerability meters, disaster bars, and explicit source caveats. Mobile captures show the typography and KPI cards adapt cleanly, and the new integration dashboard communicates simulation mode clearly.

## Confirmed weaknesses
Query.tsx has controls that do not fully affect the request: the start-year select is uncontrolled and ignored, metric/sector/gas are mostly display-only, and the Run query, Reset conditions, and Export CSV buttons have no handlers. Compare.tsx uses a static preflight matrix, hard-coded caveats, a single bar chart without uncertainty or an accessible data-label mode, and Export CSV has no handler. Forecast.tsx is entirely hard-coded: country, variable, year, scenario values, and indicator values do not affect data; its primary PDF button has no handler. Policy.tsx is entirely hard-coded and its condition controls and build-brief button are not connected. Verify.tsx hard-codes KOR, source values, and checks despite calling a dashboard query. This creates a data-contract trust gap: pages look source-cited but several numbers are UI constants.

## Data/backend findings
`dashboardFor` is a deterministic demo model with a small country list and multiplier-based values. `profile`, `reportData`, `forecast`, and `policy` data are not separate source-backed procedures. `profile` only fetches World Bank population/GDP live; the climate, vulnerability, disaster, policy, and finance fields are constants. The integration mock is intentionally safe but in-memory, so history disappears on process restart and is not a durable operational log. The source refresh loop performs serial HEAD requests for the entire catalog and only checks URL reachability, not schema/data freshness.

## UX/performance findings
Country Profile can remain on a blank loading state while live World Bank fallbacks resolve; it has no skeleton, error state, or retry. Desktop navigation is dense after adding Integrations; mobile navigation is hidden behind a menu but there is no indication of current route beyond the eyebrow. Charts use default axes/tooltips and lack explicit units in several cases. There are no empty/error states in most query-dependent sections. The app has only two server test files and no component, accessibility, visual-regression, or interaction tests.

## Priority
P0: connect query controls to API inputs; remove misleading hard-coded values or label them as demo; add errors/loading/retry and real export actions. P1: implement forecast/policy data contracts and uncertainty visualizations; make verification derive from the selected query; persist sync runs and add idempotency/retry. P2: add accessible chart tables, responsive chart testing, color-blind-safe encodings, and visual regression coverage.
