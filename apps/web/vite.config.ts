import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.message.includes('try_get_request_store') &&
          warning.message.includes('.svelte-kit/output/server/index.js')
        ) {
          return;
        }

        warn(warning);
      }
    }
  }
});
