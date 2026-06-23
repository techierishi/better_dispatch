import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
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
