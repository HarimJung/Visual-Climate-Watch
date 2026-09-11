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
- `/unknown` — the Unknown Map. What this engine has not established, counted and
  ordered by how dark the question is, with the route to each set of reasons.
  Every figure on it is a subtraction inside `data/census.json`, which is the
  object `node engine/cli.ts report --json` prints.
- `/countries` — the collection: 218 records as sortable, filterable cards.
- `/divergence` — the same country and year as several sources hold it, unmerged.
- `/finance` — vulnerability against the Green Climate Fund ledger.
- `/refusals` — every calculation the engine declined, grouped by why.
- `/country/<ISO3>` — the full record for one country: emissions by source, the
  pledge and what has and has not been read from it, transparency components,
  vulnerability, CMIP6 projections, every generated clause, and the provenance
  of every input. Each part of the dial links to the section that holds it.

## How the app gets its data

Two paths, in this order:

1. `CLIMATE_API_BASE` — a running engine (`npm run engine:serve`). `npm run dev`
   starts one if nothing answers.
2. the staged static payload — `scripts/stage-data.mjs` copies `data/countries/`,
   `data/engine-index.json` and the published views (`refusals`, `divergence`,
   `finance`, `census`) into `public/data/`, and `predev`/`prebuild` run it. This
   is what a deployed build serves, so production needs no upstream.

There is no third path. A country the engine has not built returns 404; nothing
is substituted for it.

## Deploy

```sh
npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

Live at <https://visual-climate.visualclimate.workers.dev>. The worker is named
from `package.json`; renaming it after a deploy strands the old URL, so change
it only deliberately. `prebuild` stages `data/` into `public/`, and the deployed
worker reads those files through its `ASSETS` binding (`lib/record.ts`), so
production needs no upstream and `CLIMATE_API_BASE` is never baked into a build.

The site is published but not indexed: `public/robots.txt` disallows crawlers and
`app/layout.tsx` sends `noindex, nofollow`. Delete both to open it to search.

## Operations

- **Weekly refresh** — `.github/workflows/refresh.yml`, Mondays 03:17 UTC. Every
  source is collected from nothing, every filing re-parsed, all 218 records
  rebuilt, the contract gate and the suite run, and a pull request is opened
  with the diff. A person reads the census change and merges; nothing is
  deployed by the refresh itself. Trigger by hand from the Actions tab.
- **Deploy on main** — `.github/workflows/deploy.yml`. Test, verify, build,
  ship. Needs two repository secrets, `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID`; without them the job builds, warns, and stops.
- **Failure** — any failing step mails the repository owner.

## Checks

```sh
npm test
npm run engine:verify
node engine/cli.ts report
npm run engine:index    # rewrite data/engine-index.json without a full build
```

The engine serves stored, sourced records. Country coverage does not imply that
every field is populated or that a live data collection schedule is running.
