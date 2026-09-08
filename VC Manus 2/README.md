# VC Manus 2 — read-only donor

A flat export of a Manus cloud project, sorted into folders on 2026-09-07. It has
no `package.json` and cannot be typechecked, tested or built. **Do not develop
here.**

The trunk is `/Users/harimgemmajung/Visual Climate Manus/visual-climate-saas`,
which is a git repository and has `CLAUDE.md` at its root. This folder is not
under version control, so a deletion here is not recoverable.

```
donor-app/     the export's own source
  pages/       13 page components
  components/  CanvasShell, EditorialShell
  server/      routers, db, schema, sdk, heartbeat, the two migrations
docs/          research notes and SKILL.md
  source/      the two PDFs, the 76-page text extract, the Korean prompt package
screenshots/   work captures
  process-map/ the 3.44PM screenshot, its crops, the crop script and its notes
  capture/     the 2026-09-06 23:09–23:10 series
scratch/       dead one-offs: two patch scripts written against /home/ubuntu
               paths that do not exist here, and one Playwright snapshot dump
```

## What this folder is useful for

The Climate Intelligence Canvas UI and the shape of the `ask` layer. Both have
been ported; `/canvas` in the trunk is the result and is the design reference.

## What must not be ported from it

The donor computes values it presents as measurements. `donor-app/server/routers.ts:89`
is the clearest case:

```ts
traceLow: point.trace * 0.96, traceHigh: point.trace * 1.04
uncertainty: "±4% · medium confidence"
```

That is a multiplier, not an uncertainty. The same line hardcodes per-capita
figures per country and stamps the result `dataMode: "SIMULATED_DEMO"`. Line 147
repeats the 0.96/1.04 band on the comparison endpoint.

Also not portable: hardcoded quality gates, `status: index < 5 ? "approved"`,
forecast and policy panes that are constants end to end, regex-only citation
validation, and a 32-bit djb2 hash presented as a content checksum.

The trunk's rule is that every number on screen traces to the request that
produced it. An honest empty state beats a plausible number.
