import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

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
