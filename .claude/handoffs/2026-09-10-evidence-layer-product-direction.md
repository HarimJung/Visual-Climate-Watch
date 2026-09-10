# Session Handoff: Redesign shipped, product direction set

**Date:** 2026-09-10
**Repo:** https://github.com/HarimJung/Visual-Climate-Watch (**private**)
**Git root:** `/Users/harimgemmajung/Documents/Codex/Visual Climate Watch`
**Branch:** `movement-cascade` (nothing committed this session — working tree carries all the changes)
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

## The Numbers That Drive the Product Doc

Computed from `data/countries/*.json` this session — recompute rather than trust these if the
engine is rebuilt:

- 218 countries built, 11 connected sources, **29,214 records**
- 218/218 have observed series · 217 have CMIP6 projections · 190 have ND-GAIN
- **1 of 218** has a parsed NDC target figure (Cambodia)
- **0 of 1,744** BTR component sockets parsed — all `unknown`, none `absent`
- OWID (DS-35) vs Climate TRACE (DS-02), 2022, 199 countries: **median 27% difference**,
  123 differ by >20%, 64 by >50%, and the two totals are **4,032 MtCO₂e apart**
- Caveat that must travel with that figure: DS-05 (EDGAR) is non-CO₂ only and is *not* comparable;
  much of the OWID/TRACE gap is land-use scope, not error. Never present it as "the data is wrong".

## The Product Line (from the artifact)

| ID | Product | Status |
|---|---|---|
| P1 | The Instrument — the 3D movement | shipped |
| P2 | Divergence Atlas — sources side by side, unmerged, with scope strings | **runs on data already built** (`emissions_profile.by_source`) |
| P3 | The Unknown Map — publish our own coverage gaps as the headline metric | one census build step |
| P4 | Receipts — per-figure provenance API + citation chip | **runs on data already built** (`provenance`, `$sources_index`) |
| P5 | BTR Reading Room — fill the 1,744 sockets with evidence anchors | needs document parsing (engine milestone M3) |
| P6 | Refusal Log — every calculation the engine declined, in its own words | **runs on data already built** (`derived.$reason`, `verdict.text`) |

## Open Questions

- [ ] Which of P2 / P4 / P6 ships first? All three are view-only work on existing fields.
- [ ] Is the BTR parsing (P5) a hire, a partnership, or a slow in-house crawl?
- [ ] Who is the first named institutional partner — ministry, funder, newsroom, or litigation team?
- [ ] Commit and push this session's work? Nothing has been committed yet.
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

## Next Steps

1. [ ] Decide P2 / P4 / P6 order and build the first one — no new source, no new licence needed.
2. [ ] Commit the redesign (`app/`, `components/movement/`, `engine/`, `data/`, `public/favicon.svg`)
       — one commit for the design system, one for the English conversion, keeps the diff readable.
3. [ ] Write the census script behind P3 as a real engine command (`node engine/cli.ts census`)
       so the coverage numbers are reproducible rather than ad-hoc.
4. [ ] Decide whether the artifact's figures get regenerated automatically from that command.

## Files to Review on Resume

- `.claude/handoffs/2026-09-10-evidence-layer-product-direction.md` — this file
- The published artifact — the full product argument with the figures rendered
- `pdf-45-50p-1-owid-climate/outputs/paris-movement/ENGINE-BUILD.md` — the engine brief, milestones M1–M8
- `pdf-45-50p-1-owid-climate/outputs/paris-movement/app/globals.css` — the new token system
- `pdf-45-50p-1-owid-climate/outputs/paris-movement/engine/db/schema.sql` — where the epistemic
  state model is written down most completely
