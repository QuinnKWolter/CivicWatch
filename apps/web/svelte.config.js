import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(configDir, '../..');

loadDotEnv(resolve(repoRoot, '.env'));
loadDotEnv(resolve(configDir, '.env'));

function loadDotEnv(path) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);

    if (!match || process.env[match[1]] !== undefined) {
      continue;
    }

    process.env[match[1]] = normalizeEnvValue(match[2]);
  }
}

function normalizeEnvValue(value) {
  let result = value.trim();

  if (
    (result.startsWith('"') && result.endsWith('"')) ||
    (result.startsWith("'") && result.endsWith("'"))
  ) {
    result = result.slice(1, -1);
  }

  return result.replace(/\\n/g, '\n');
}

function civicwatchAdapter() {
  const baseAdapter = adapter();

  return {
    ...baseAdapter,
    async adapt(builder) {
      const warn = console.warn;

      console.warn = (...args) => {
        const message = args.join(' ');

        if (
          message.includes('try_get_request_store') &&
          message.includes('.svelte-kit/output/server/index.js')
        ) {
          return;
        }

        warn(...args);
      };

      try {
        await baseAdapter.adapt(builder);
      } finally {
        console.warn = warn;
      }
    }
  };
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: civicwatchAdapter(),
    paths: {
      base: process.env.PUBLIC_BASE_PATH || ''
    }
  }
};

export default config;
