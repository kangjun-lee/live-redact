import path from 'node:path'

import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type ProxyOptions } from 'vite'

/**
 * api.typesafe.ai only allows CORS from console.typesafe.ai, so requests are forwarded unchanged.
 * Origin is dropped so the API treats them as a non-browser client.
 */
const typesafeProxy: Record<string, ProxyOptions> = {
  '/api/typesafe': {
    target: 'https://api.typesafe.ai',
    changeOrigin: true,
    rewrite: (url) => url.replace(/^\/api\/typesafe/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (request) => request.removeHeader('origin'))
    },
  },
}

export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: { proxy: typesafeProxy },
  preview: { proxy: typesafeProxy },
})
