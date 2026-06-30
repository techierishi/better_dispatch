import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: './',
  root: 'src/tab',
  build: {
    outDir: '../../dist/tab',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/tab/index.html',
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});
