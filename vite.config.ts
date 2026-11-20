import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Check if .env file exists in src/, fall back to root if not
  const hasSrcEnv =
    fs.existsSync(path.resolve(import.meta.dirname, 'src/.env')) ||
    fs.existsSync(path.resolve(import.meta.dirname, `src/.env.${mode}`));

  return {
    envDir: hasSrcEnv ? './src' : './',
    plugins: [react()],
    build: {
      outDir: 'dist',
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('@mui') || id.includes('@emotion')) {
                return 'mui';
              }
              return 'vendor';
            }
          },
        },
      },
    },
  };
});

