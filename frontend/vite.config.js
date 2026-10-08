import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Dev-режим: /api запросы идут на бэкенд (node server.js, порт 3001)
      '/api': 'http://localhost:3001'
    }
  },
})
