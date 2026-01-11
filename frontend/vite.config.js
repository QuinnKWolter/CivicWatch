import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Set base path for production (prototype03)
  base: process.env.NODE_ENV === 'production' ? '/prototype03/' : '/',
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
    allowedHosts: ['.ngrok-free.app'],
    host: true,
    port: 6173,
    proxy: {
      '/api': {
        target: 'http://localhost:8500',
        changeOrigin: true,
      },
    }
  },
})
