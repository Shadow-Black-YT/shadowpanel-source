import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api':  { target: 'http://localhost:5000', changeOrigin: true },
      '/ws':   { target: 'ws://localhost:5000', ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:   ['react','react-dom','react-router-dom'],
          query:    ['@tanstack/react-query','axios'],
          charts:   ['recharts'],
          terminal: ['@xterm/xterm','@xterm/addon-fit'],
          monaco:   ['@monaco-editor/react'],
          motion:   ['framer-motion'],
        },
      },
    },
  },
})
