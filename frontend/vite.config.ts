import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    // pdf.js + the markdown/syntax stack push the main bundle past Vite's default 500 kB
    // hint. It's an SPA loaded once over localhost — the size is expected, not a regression.
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      // Silence rolldown's INVALID_ANNOTATION noise about a misplaced /*#__PURE__*/ comment
      // inside @microsoft/signalr (a dependency we don't control). Everything else still logs.
      onLog(level, log, handler) {
        if (log.code === 'INVALID_ANNOTATION' && log.message.includes('@microsoft/signalr')) return
        handler(level, log)
      },
    },
  },
  server: {
    port: 5173,
    // Forward API + SignalR hub to the .NET backend during dev (api host port 6670).
    proxy: {
      '/api': 'http://localhost:6670',
      '/hub': { target: 'http://localhost:6670', ws: true },
    },
  },
})
