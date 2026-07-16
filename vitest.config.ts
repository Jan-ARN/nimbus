import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Vitest treibt den reinen Rechen-Kern (src/lib/wx). Kein DOM nötig → node-Env.
// Der @-Alias spiegelt tsconfig, damit Tests wie App-Code importieren können.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
