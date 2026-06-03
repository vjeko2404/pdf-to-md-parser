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
  server: {
    port: 5173,
    // Forward API + SignalR hub to the .NET backend during dev (api host port 6670).
    proxy: {
      '/api': 'http://localhost:6670',
      '/hub': { target: 'http://localhost:6670', ws: true },
    },
  },
})
