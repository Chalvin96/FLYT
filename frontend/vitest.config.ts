import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const dirname = import.meta.dirname;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '@/components/ui',
        replacement: path.resolve(dirname, '../packages/ui/src/components'),
      },
      { find: '@', replacement: path.resolve(dirname, './src') },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    css: true,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.stories.tsx',
        '**/*.config.*',
        '**/dist/',
      ],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          // Node-only: the MSW server here cannot load in the browser project.
          setupFiles: ['./src/test/setup.ts'],
          include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            '../packages/ui/src/**/*.{test,spec}.{ts,tsx}',
            '../packages/lexicon/src/**/*.{test,spec}.{ts,tsx}',
          ],
          exclude: ['**/*.stories.{ts,tsx}'],
        },
      },
      {
        extends: true,
        plugins: [
          storybookTest({ configDir: path.join(dirname, '.storybook') }),
        ],
        // Pre-bundle the autodocs renderer once at server start. Without this,
        // parallel browser workers race Vite's cold dep-optimizer on the lazy
        // `@storybook/addon-docs` import, intermittently failing with
        // "Failed to fetch dynamically imported module".
        optimizeDeps: {
          include: [
            '@storybook/addon-docs',
            '@storybook/addon-docs/blocks',
            '@tanstack/router-devtools',
            '@testing-library/dom',
            'next-themes',
          ],
        },
        test: {
          name: 'storybook',
          // Vite may restart its dev server when parallel browser workers discover
          // a dependency missing from the cold optimizer cache.
          fileParallelism: false,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
