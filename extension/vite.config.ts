import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

import manifestFactory from './src/manifest.config.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiOrigin = env.VITE_API_ORIGIN ?? 'http://localhost:8000';
  const appOrigin = env.VITE_APP_ORIGIN ?? 'http://localhost:5173';
  const browser = env.FLYT_BROWSER ?? 'chrome';

  if (browser !== 'chrome' && browser !== 'firefox') {
    throw new Error(`Invalid FLYT_BROWSER: ${browser}`);
  }
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(apiOrigin)) {
    throw new Error(`Invalid VITE_API_ORIGIN: ${apiOrigin}`);
  }
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(appOrigin)) {
    throw new Error(`Invalid VITE_APP_ORIGIN: ${appOrigin}`);
  }

  return {
    plugins: [
      crx({ browser, manifest: manifestFactory(apiOrigin, browser) }),
      react(),
    ],
    build: {
      outDir: `dist/${browser}`,
      target: 'esnext',
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/[name].[hash].js',
        },
      },
    },
  };
});
