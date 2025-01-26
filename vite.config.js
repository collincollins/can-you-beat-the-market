import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import react from '@vitejs/plugin-react';

export default defineConfig({
  build: {
    outDir: 'build', // output directory
    sourcemap: false,
    rollupOptions: {
    },
  },
  plugins: [
    svelte(),
    react() // so it can handle .jsx files
  ]
});