import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// The panel is served by the gateway itself, so the build output is a plain
// static bundle read from panel/dist by server.mjs.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
  },
  server: {
    port: 5199,
    proxy: { '/api': 'http://127.0.0.1:8787', '/v1': 'http://127.0.0.1:8787' },
  },
});
