# Session Handoff: Redesign shipped, product direction set

**Date:** 2026-09-10
**Repo:** https://github.com/HarimJung/Visual-Climate-Watch (**private**)
**Git root:** `/Users/harimgemmajung/Documents/Codex/Visual Climate Watch`
**Branch:** `movement-cascade` — clean tree, HEAD `35bff6d`

> **Superseded in part, 2026-09-10.** After this handoff was first written, another session
> committed the redesign and pushed the engine forward four commits (`92534e4`, `8f68e99`,
> `21dc135`, `35bff6d`), then republished the artifact. **P2 and P6 are shipped**, the BTR and
> NDC coverage numbers below have moved, and the divergence metric changed. Sections marked
> ⚠ have been corrected; everything else still holds. Verified against
> `node engine/cli.ts report --json` (run `def9168d`) rather than taken from the artifact.
**App:** `pdf-45-50p-1-owid-climate/outputs/paris-movement` (vinext + React 19 + Three.js)
**Run it:** `npm run dev` → localhost:3000. The launcher starts the engine on 8787 itself if nothing is listening.

## Current State

**Phase:** UI redesign complete and verified; product direction decided, nothing built against it yet.
**Progress:** Redesign 100%. Product line defined, three of six products need no new data. No blockers.
**Deliverable published:** "The Evidence Layer" → https://claude.ai/code/artifact/6d932f85-803b-4043-9dbc-2b4bad2793ad

## What We Did

1. Rebuilt the app's visual design (the user's words: "디자인이 너무 구림"), keeping the three.js
   engine and every motion path untouched, and converted all Korean UI copy to English.
2. Then measured what the engine actually holds and turned that into a product-direction
   document: six products, the case for each, how to present them, and a build sequence.

## Decisions Made

- **Light editorial art direction, not dark** — the user picked it over a dark studio when asked.
  Warm ivory paper, ink text, one accent, four evidence colours. Lower risk to the 3D scene,
  which was lit and coloured for a light ground.
- **One stylesheet, token-driven** — `app/globals.css` had three stacked override layers fighting
  each other (sage-greens over blue-greys over patches). Replaced with a single token system.
  This was the actual cause of the "ugly": mixed grey families and Arial, not the layout.
- **Page palette and 3D palette share the same four values** — NDC `#2b54b7`, inventory `#1b6f68`,
  BTR `#5b4c99`, finance `#8f6b2a`, in CSS *and* in `scene.tsx`, so the two can't drift again.
- **Instrument Serif / Geist / Geist Mono via Google Fonts** — display, interface, and anything
  the engine measured. All three verified loading; every stack has a local fallback.
- **English everywhere in the product, including engine output** — `$meta.snapshot` / `$meta.basis`
  were emitting Korean from `compose.ts`; fixed at the source *and* in all 218 country records
  plus their golden copies, so the regression gate stays byte-clean.
- **`ENGINE-BUILD.md` left in Korean** — it is the user's own working brief, not product copy.
- **Product thesis: sell the epistemics, not another dashboard** — the differentiator is that
  "unknown" is a value with a receipt and `absent` requires evidence. Everything in the product
  line follows from that one rule.

## Code Changes

**Files modified (all under `pdf-45-50p-1-owid-climate/outputs/paris-movement/`):**

- `app/globals.css` — full rewrite, 407 lines, token-driven, both phone and desktop verified
- `app/layout.tsx` — Google Fonts links, OG metadata, removed the `dark` class from `<html>`
- `app/page.tsx` — 78 strings translated; evidence colours updated; `exportCanvas()` re-inked
- `components/movement/scene.tsx` — 9 chapter texts, part labels, aria labels, `btrStateText`,
  engraving inks, material colours, `StaticDial` palette; globe lifted (`emissiveIntensity` .5 → .58)
- `components/movement/explosion-motion.ts` — the eight `BTR_STORIES` in English
- `engine/build/compose.ts`, `engine/sources/_base.ts` — Korean strings/comments → English
- `data/countries/*.json` + `data/golden/*.json` (218 each) — `$meta` strings translated in lockstep
- `public/favicon.svg` — replaced the starter template icon with the instrument mark
- `README.md` — button name updated

**Nothing in the motion system was touched.** `explosion-layout.ts`, `pointer-tap.ts`, and every
timing/easing/layout function in `explosion-motion.ts` and `scene.tsx` are byte-identical apart
from strings and colour literals.

**Verification run this session:** `npm test` 38/38 · `engine:verify` 218 records, golden clean ·
`tsc --noEmit` clean · `npm run build` succeeds · no console errors · no horizontal overflow at 390px.
Pre-existing `oxlint` errors remain (shadcn components, test files, three unused vars in `scene.tsx`).

## ⚠ The Numbers That Drive the Product Doc — corrected

**Never type these by hand again.** `node engine/cli.ts report --json` now emits the whole census;
the artifact's figures come from it. Current values (run `def9168d`, built 2026-09-10):

- 218 countries built, **12 connected sources**, **11,670 observation points**
  (the earlier "29,214 records" counted source rows, not observations — different metric)
- 218/218 observed series · 217 projections · 190 ND-GAIN · 198 with 3+ inventory sources
- **18 of 218** NDC targets accepted, against **168 documents held** — **150 refused**
- **328 of 1,744** BTR sockets now carry evidence across 134 located filings; the other 1,416
  stay `unknown` and each now carries a written reason. Zero `absent` **within BTR**; two exist
  corpus-wide (`USA` and `YEM`, `ndc_registry.state`), which the census reports as
  `ndc_registry_none_active: 2`. The earlier blanket "still zero absent" was wrong.
- **364 refusals** in 61 distinct sentences (17 gap + 44 document) · gap assessed for 4 countries,
  refused for 214. 61 counts only refusals: `derived.$reason` where `on_track` is null and
  `ndc_document.$reason` where the state is `unknown`. A naive scan of every `$reason` returns 65.
- Divergence metric **changed**: now measured as a share of the **larger** of the two figures, so
  it is symmetric and neither source becomes the reference. Median **22.7%**, 108 of 199 above
  20%, 28 above 50%. (The earlier 27% divided by OWID, which quietly made OWID the truth.)
- Caveat that must still travel with it: DS-05 (EDGAR) is non-CO₂ only and is *not* comparable;
  much of the OWID/TRACE gap is land-use scope, not error. Never present it as "the data is wrong".

## The Product Line (from the artifact)

| ID | Product | Status |
|---|---|---|
| P1 | The Instrument — the 3D movement | shipped |
| P2 | Divergence Atlas — sources side by side, unmerged, with scope strings | ⚠ **shipped** — live at `/divergence`, server rendered, no client JS |
| P3 | The Unknown Map — publish our own coverage gaps as the headline metric | census now exists (`report --json`); needs the page |
| P4 | Receipts — per-figure provenance API + citation chip | **the remaining free one** (`provenance`, `$sources_index`) |
| P5 | BTR Reading Room — fill the remaining 1,416 sockets with evidence anchors | needs document parsing (engine milestone M3) |
| P6 | Refusal Log — every calculation the engine declined, in its own words | ⚠ **shipped** — live at `/refusals`, 364 refusals |

## Open Questions

- [x] ~~Which of P2 / P4 / P6 ships first?~~ P2 and P6 shipped; P4 is next.
- [ ] Is the BTR parsing (P5) a hire, a partnership, or a slow in-house crawl?
- [ ] Who is the first named institutional partner — ministry, funder, newsroom, or litigation team?
- [ ] Do licences actually permit redistributing what Receipts would cite? One licence string per
      source is now enforced by test, but whether it permits redistribution is unanswered.
- [x] ~~Commit and push this session's work?~~ Committed by the follow-up session.
- [ ] Should `.claude/handoffs/` and internal docs be English or Korean? This one is English;
      `2026-09-08-movement-legibility.md` is Korean.

## Context to Remember

- **R6 in `ENGINE-BUILD.md` says the frontend is read-only for the engine work.** This session
  deliberately broke that rule because the user asked for a redesign directly. If engine work
  resumes under that brief, R6 applies again to `page.tsx` / `scene.tsx` / `globals.css`.
- The user asked in Korean but wants the product in English. Chat can be either.
- `data/golden/` is compared byte-for-byte against `data/countries/`. Any data edit must touch both.
- The user's earlier complaint pattern is about *legibility*, not decoration — they notice when a
  component doesn't explain itself. Design work should serve reading, not ornament.

## ⚠ Next Steps — corrected

1. [ ] **Build P4 (Receipts)** — the last product that needs no new data. `GET /api/v1/receipt`
       plus a pasteable citation chip, over `provenance.inputs` and `$sources_index`.
2. [ ] **Build P3 (Unknown Map)** — `report --json` already emits the census; this is now a page,
       not a data problem. Make the unknown count the public quarterly metric.
3. [ ] Put the two live pages in front of a real reader. Nobody outside the project has used
       `/divergence` or `/refusals` yet, and open question 04 is still open.
4. [ ] Wire the artifact's figures to `report --json` output so the deck can never drift from
       the engine again.
5. [ ] Then P5 / engine M3 — the remaining 1,416 sockets, twenty countries at a time.

~~Commit the redesign~~ — done by the follow-up session; tree is clean at `35bff6d`.

## Files to Review on Resume

- `.claude/handoffs/2026-09-10-evidence-layer-product-direction.md` — this file
- The published artifact — the full product argument with the figures rendered
- `pdf-45-50p-1-owid-climate/outputs/paris-movement/ENGINE-BUILD.md` — the engine brief, milestones M1–M8
- `pdf-45-50p-1-owid-climate/outputs/paris-movement/app/globals.css` — the new token system
- `pdf-45-50p-1-owid-climate/outputs/paris-movement/engine/db/schema.sql` — where the epistemic
  state model is written down most completely
