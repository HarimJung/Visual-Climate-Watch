import { sites } from '@openai/sites-vite-plugin';
import tailwindcss from '@tailwindcss/postcss';
import vinext from 'vinext';
import { defineConfig } from 'vite';
import hostingConfig from './.openai/hosting.json';

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  '00000000-0000-4000-8000-000000000000';

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === 'seatbelt';

const localBindingConfig = {
  main: 'vinext/server/fetch-handler',
  compatibility_flags: ['nodejs_compat'],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: 'site-creator-d1',
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: 'site-creator-r2',
        },
      ]
    : [],
};

export default defineConfig(async ({ command }) => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= 'false';
  process.env.WRANGLER_LOG_PATH ??= '.wrangler/logs';
  process.env.MINIFLARE_REGISTRY_PATH ??= '.wrangler/registry';

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import('@cloudflare/vite-plugin');

  return {
    css: { postcss: { plugins: [tailwindcss()] } },
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
        config: {
          ...localBindingConfig,
          // The site's own name. Every canonical and og:url is built from the
          // host that served the request (lib/record.ts origin()), so this one
          // line is what makes them say visualclimate.org instead of a
          // workers.dev subdomain. The zone has to exist in the Cloudflare
          // account or `wrangler deploy` stops here rather than half-way.
          // Adding routes makes wrangler switch the workers.dev address off by
          // default, and a custom domain that cannot attach (no zone in the
          // account yet) then leaves the site with no address at all: one
          // deploy did exactly that. The subdomain stays on regardless.
          workers_dev: true,
          routes: [
            { pattern: 'www.visualclimate.org', custom_domain: true },
            // The apex only exists to redirect: see proxy.ts.
            { pattern: 'visualclimate.org', custom_domain: true },
          ],
          // Lets the worker read its own staged data files; see lib/record.ts.
          assets: { binding: 'ASSETS' },
          // The combined local launcher supplies this binding. Never bake a
          // localhost upstream into a production build.
          ...(command === 'serve' && process.env.CLIMATE_API_BASE
            ? { vars: { CLIMATE_API_BASE: process.env.CLIMATE_API_BASE } }
            : {}),
        },
      }),
    ],
  };
});
