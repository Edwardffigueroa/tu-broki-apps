import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  base: '/diagramas/',
  build: {
    outDir: path.resolve(dir, '../../../public/diagramas'),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4747',
        changeOrigin: true,
      },
      '/acceso': {
        target: 'http://127.0.0.1:4747',
        changeOrigin: true,
      },
    },
  },
})
