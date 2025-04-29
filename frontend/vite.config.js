import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
    allowedHosts: ['fbad-2600-4041-33-cc00-cca1-35ab-595b-9e6b.ngrok-free.app']
  },
})
