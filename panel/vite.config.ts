import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 控制台由网关自己伺服，构建产物是 panel/dist 下的静态包。
// 性能取向：按页面分包 + 把 React / 图标拆成可长期缓存的 vendor chunk，
// 关闭压缩体积报告，产物全部是静态文件（无外部 CDN、无字体网络请求）。
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: true,
    reportCompressedSize: false,
    assetsInlineLimit: 2048,
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
          if (id.includes('node_modules/lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5199,
    proxy: { '/api': 'http://127.0.0.1:8787', '/v1': 'http://127.0.0.1:8787' },
  },
});
