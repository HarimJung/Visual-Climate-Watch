# Visual Climate — The Paris Movement

## Local preview

```sh
npm run dev
```

This starts the local data engine if needed, verifies its country records, then
starts the web app. An already running engine is reused and is not stopped when
the preview exits. The launcher stops an engine it started when the preview exits.

The default upstream is `http://127.0.0.1:8787`. An existing `CLIMATE_API_BASE`
in `.dev.vars` takes precedence, followed by the process environment. A configured
remote upstream must already be running. Local upstream bindings are not included
in production builds.

`npm run dev:web` starts only the web app; `npm run engine:serve` starts only
the data engine. Use those commands only when managing the services separately.

Open the Local URL printed by the web server. Use **Replay the assembly** to
play the assembly sequence, or scroll to move through its chapters.

## Pages

- `/` — the instrument. The dial, its parts, and the evidence sheet behind each one.
- `/country/<ISO3>` — the full record for one country: emissions by source, the
  pledge and what has and has not been read from it, transparency components,
  vulnerability, CMIP6 projections, every generated clause, and the provenance
  of every input. Each part of the dial links to the section that holds it.

## How the app gets its data

Two paths, in this order:

1. `CLIMATE_API_BASE` — a running engine (`npm run engine:serve`). `npm run dev`
   starts one if nothing answers.
2. the staged static payload — `scripts/stage-data.mjs` copies `data/countries/`
   and `data/engine-index.json` into `public/data/`, and `predev`/`prebuild` run
   it. This is what a deployed build serves, so production needs no upstream.

There is no third path. A country the engine has not built returns 404; nothing
is substituted for it.

## Checks

```sh
npm test
npm run engine:verify
node engine/cli.ts report
npm run engine:index    # rewrite data/engine-index.json without a full build
```

The engine serves stored, sourced records. Country coverage does not imply that
every field is populated or that a live data collection schedule is running.
