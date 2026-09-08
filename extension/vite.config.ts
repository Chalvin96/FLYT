import { defineConfig, loadEnv } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import manifestFactory from './src/manifest.config.ts';

// CRXJS wires the MV3 manifest, HMR for content scripts, and the service worker build.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiOrigin = env.VITE_API_ORIGIN ?? 'http://localhost:8000';
  const appOrigin = env.VITE_APP_ORIGIN ?? 'http://localhost:5173';

  // Keep build URLs locked to exact origins; the API origin also scopes host_permissions.
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(apiOrigin)) {
    throw new Error(`Invalid VITE_API_ORIGIN: ${apiOrigin}`);
  }
  if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(appOrigin)) {
    throw new Error(`Invalid VITE_APP_ORIGIN: ${appOrigin}`);
  }

  return {
    plugins: [crx({ manifest: manifestFactory(apiOrigin) }), react()],
    build: {
      target: 'esnext',
      rollupOptions: {
        output: {
          chunkFileNames: 'assets/[name].[hash].js',
        },
      },
    },
  };
});
