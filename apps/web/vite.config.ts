import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: __dirname,
  base: '/',
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  preview: {
    allowedHosts: ['localhost', '.railway.app'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@craft-agent/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@craft-agent/core': path.resolve(__dirname, '../../packages/core/src'),
      '@craft-agent/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
