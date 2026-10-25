import { defineConfig, devices } from '@playwright/test';

const storybookPort = process.env.FLYT_E2E_STORYBOOK_PORT ?? '6307';
const baseURL = process.env.FLYT_E2E_BASE_URL ?? 'http://127.0.0.1:4173';

export default defineConfig({
  webServer: {
    command: `./node_modules/.bin/storybook build --quiet && python3 -m http.server ${storybookPort} --bind 127.0.0.1 --directory storybook-static`,
    url: `http://127.0.0.1:${storybookPort}/iframe.html`,
    env: {
      STORYBOOK_DISABLE_TELEMETRY: '1',
      FLYT_API_URL: process.env.FLYT_E2E_API_URL ?? 'http://127.0.0.1:18000',
    },
    timeout: 600_000,
  },
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  // No retries: specs mutate seeded users' lesson/review state and the
  // database is seeded once for the whole run. A retry would run against
  // already-mutated state, not the original scenario.
  retries: 0,
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
