import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Two-mode build:
//   vite build --mode content  → content.js as IIFE (all deps inlined)
//   vite build                 → popup.html + popup.js as ESM
export default defineConfig(({ mode }) => {
  if (mode === 'content') {
    return {
      plugins: [react()],
      build: {
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
          input: resolve(__dirname, 'src/content/index.tsx'),
          output: {
            format: 'iife',
            entryFileNames: 'content.js',
            inlineDynamicImports: true,
          },
        },
      },
    }
  }

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      rollupOptions: {
        input: {
          popup: resolve(__dirname, 'popup.html'),
          background: resolve(__dirname, 'src/background/index.ts'),
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
    },
  }
})
