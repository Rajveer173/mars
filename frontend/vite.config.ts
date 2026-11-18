import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Root-relative, so no Node path helpers are needed here.
  resolve: { alias: { '@': '/src' } },
  server: {
    port: 5173,
    strictPort: true,
    // Preserve the browser-facing Host so the API can verify same-origin POSTs
    // on localhost, 127.0.0.1 and explicitly exposed development addresses.
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
  preview: { proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } } },
  build: { outDir: 'dist', sourcemap: false },
});
