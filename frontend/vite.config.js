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
    allowedHosts: ['.ngrok-free.app'],
    host: true,
    port: 6173,
    proxy: {
      '/api': 'http://localhost:9000',
    }
  },
})
