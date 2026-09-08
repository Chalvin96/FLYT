import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    // e2e/ is Playwright's; its specs cannot run under vitest.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
