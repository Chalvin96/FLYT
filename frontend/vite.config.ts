import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  envPrefix: ['VITE_', 'FLYT_'],
  plugins: [
    tanstackRouter({
      routesDirectory: './src/routes',
      autoCodeSplitting: true,
      routeFileIgnorePattern: '.*\\.test\\.[jt]sx?$',
    }),
    react(),
  ],
  resolve: {
    alias: [
      {
        find: '@/components/ui',
        replacement: path.resolve(dirname, '../packages/ui/src/components'),
      },
      { find: '@', replacement: path.resolve(dirname, './src') },
    ],
  },
});
