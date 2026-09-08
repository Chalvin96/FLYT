import { defineConfig } from '@playwright/test';

const FIXTURE_PORT = Number(process.env.FLYT_E2E_FIXTURE_PORT ?? 4180);

export default defineConfig({
  testDir: './e2e',
  // Each test launches its own persistent profile with the unpacked extension.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${FIXTURE_PORT}`,
    trace: 'retain-on-failure',
  },
  // Content scripts do not run on file:// or data: URLs.
  webServer: {
    command: `python3 -m http.server ${FIXTURE_PORT} --bind 127.0.0.1 --directory e2e/fixtures`,
    url: `http://127.0.0.1:${FIXTURE_PORT}/article.html`,
    // Never reuse: a stray server on this port serves a different page and
    // every spec fails on a missing fixture node.
    reuseExistingServer: false,
    stdout: 'ignore',
  },
});
