/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const paket = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages liefert die Seite unter https://tammerle.github.io/angie/ aus.
  base: command === 'build' ? '/angie/' : '/',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`${paket.version} · ${new Date().toISOString().slice(0, 10)}`),
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
  server: {
    port: 5200,
    strictPort: true,
  },
  preview: {
    port: 5201,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
}))
