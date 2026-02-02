import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Shared packages
      { find: '@deckhand/schema', replacement: path.resolve(__dirname, '../../packages/schema/src') },
      { find: '@deckhand/sync', replacement: path.resolve(__dirname, '../../packages/sync/src') },
      { find: '@deckhand/components', replacement: path.resolve(__dirname, '../../packages/components/src') },
      // Local src alias
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Force single React instance (monorepo)
      { find: 'react', replacement: path.resolve(__dirname, '../../node_modules/react') },
      { find: 'react-dom', replacement: path.resolve(__dirname, '../../node_modules/react-dom') },
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5178,
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
  build: {
    outDir: '../../dist/editor',
    sourcemap: true,
  },
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
});
