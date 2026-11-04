import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `base: './'` lets the calculator live in any folder (on the site it is /kalkulator/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 3000 },
})
