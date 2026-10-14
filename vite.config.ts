import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-agents': {
        target: 'https://api.agents.snsihub.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api-agents/, ''),
        timeout: 900000, // 15 minutes maximum timeout
        proxyTimeout: 900000,
      },
    },
  },
})
