import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-server proxies (ported from eva-advisor) so the chat can reach real services
// same-origin — the browser calls http://localhost:5183/api/... and Vite forwards.
// Keys live in .env (VITE_GEMINI_API_KEY, VITE_ECONOMIC_*) — never commit them.
// `base` is '/eva-continued/' for production builds (GitHub Pages) only; dev stays '/'.
// The public Pages build ships WITHOUT keys → the app runs in mock/demo mode.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/eva-continued/' : '/',
  plugins: [react()],
  css: { transformer: 'postcss' },
  build: { cssMinify: false },
  server: {
    proxy: {
      // Google Gemini — the LLM that answers.
      '/api/gemini': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/gemini/, ''),
      },
      // e-conomic REST API (Phase 2 — real bookkeeping data).
      '/api/economic': {
        target: 'https://restapi.e-conomic.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/economic/, ''),
      },
      '/api/openapi': {
        target: 'https://apis.e-conomic.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/openapi/, ''),
      },
    },
  },
}))
