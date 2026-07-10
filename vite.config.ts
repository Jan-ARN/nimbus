import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

// Rein statische App — alle Wetter-Quellen (Open-Meteo, Bright Sky) sind key-frei
// und CORS-fähig und werden direkt aus dem Browser aufgerufen. Kein Backend.
// `base` = Unterpfad für GitHub Pages (https://<user>.github.io/nimbus/).
export default defineConfig({
  base: '/nimbus/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
})
