import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import qiankun from 'vite-plugin-qiankun';

const __dirname = import.meta.dirname;

export default defineConfig({
  plugins: [react(), qiankun('ai', { useDevMode: true })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 8005,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
