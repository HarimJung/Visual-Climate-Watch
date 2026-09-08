# Visual Climate: Product Reinterpretation

## Direction

Visual Climate is not a generic climate dashboard and it is not an AI chat window with charts attached. It is a **traceable climate analysis workspace**. A user starts with a question or a structured task, selects the analytical frame, receives a result with source and method context, checks comparability, and then produces a country profile, evidence-backed comparison, forecast interpretation, policy analysis, or shareable report.

The wireframe is treated as the product-flow source of truth. Its visual language is not reused. The redesigned experience adopts an editorial index style: white canvas, oversized black typography, electric blue structural accents, restrained borders, strong section numbering, dense but calm data tables, and visible source/methodology labels.

## Canonical user journey

| Stage | User question | Product responsibility | Exit condition |
|---|---|---|---|
| Orient | “What can I do here?” | Explain the product in one sentence, show four analysis paths, and reveal trust rules before the user commits. | User chooses a question, data query, comparison, forecast, or policy path. |
| Frame | “What exactly am I asking?” | Collect country, time, indicator, sector, gas/scope, source, unit, scenario, and analysis topic as appropriate. | Query has explicit dimensions and no hidden defaults. |
| Retrieve | “What do the sources say?” | Retrieve values and retain dataset ID, reference year, source, coverage, and method. | Results are visible with evidence metadata. |
| Explain | “Why are values different?” | Explain boundary, GWP, coverage, period, and method differences in plain language. | User sees a comparability verdict and caveats. |
| Compare | “Can I compare these?” | Normalize only when defensible; block or warn when not. | Comparison is marked comparable, limited, or not comparable. |
| Interpret | “What does this mean?” | Add trend, sector, scenario, policy, disaster, or finance interpretation without replacing source values. | Interpretation is explicitly separated from observation. |
| Verify | “Can I trust or reuse this?” | Show quality gates, source citations, uncertainty, and human-review requirements. | User can approve, revise, export, or return to conditions. |
| Publish | “How do I share this?” | Produce a profile, report, chart, CSV, or learning artifact with methodology attached. | Output preserves provenance and date of access. |

## Primary entry points

The home screen offers four clearly distinct paths. **Explore data** is for a precise metric query. **Compare countries or sources** is for normalized comparison. **Climate outlook** is for scenario projections. **Policy, disaster, and finance** is for pathway and impact analysis. The natural-language analyst is an entry shortcut and routing layer; it is not the product’s only interface.

## Analysis contracts

Every result must expose the following contract: subject, indicator, period, unit, gas or scope, source, dataset ID, reference year, GWP basis where applicable, coverage, method, uncertainty, comparability state, and last update. A chart without this contract is considered incomplete.

## Page map

| Route | Role |
|---|---|
| `/` | Orientation, analyst entry, four analysis paths, live country snapshot. |
| `/query` | Structured data retrieval with source-aware result table. |
| `/compare` | Country and source comparison with preflight checks, normalized indicators, chart, table, and export. |
| `/verify` | Cross-source verification with difference explanations and recommended next action. |
| `/forecast` | SSP scenario explorer with variable cards, uncertainty, and interpretation. |
| `/policy` | NDC pathway, climate-related disaster history, and climate-finance gap analysis. |
| `/country/:iso3` | Country profile with evidence, sectors, vulnerability, policy, and report entry. |
| `/learn` | Learning paths that explain how to read and challenge climate data. |
| `/sources` | Source registry, freshness, method, coverage, and connector state. |
| `/report/:iso3` | Provenance-preserving country report preview and export. |

## Visual design principles

The redesign intentionally moves away from the current dark dashboard aesthetic. The reference site demonstrates a strong editorial hierarchy: a compact utility header, text-first navigation, large country or topic heading, a high-contrast score or headline block, numbered analytical sections, and tables that remain legible without excessive card decoration. Visual Climate should use that principle without copying its branding or exact layout.

The new system uses a warm white background, ink-black text, one electric blue action color, muted graphite rules, and small category accents only for status. Typography is an assertive grotesk for headings and a neutral sans-serif for body and data. Monospaced text is reserved for dataset IDs, years, units, and audit metadata. Cards are used only when they represent a meaningful analytical unit; decorative rounded panels are removed.

## Non-negotiable exclusions

The wireframe’s placeholder appearance, gray skeleton charts, generic dashboard cards, and dense left-rail treatment are not design references. The current dark green dashboard look is also not retained. AI must not be presented as an authoritative source, and no result may hide its conditions or provenance behind a chat response.
