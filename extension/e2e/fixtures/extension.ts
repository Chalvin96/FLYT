import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  chromium,
  test as base,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';

const DIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../dist',
);

export const API_URL = process.env.FLYT_E2E_API_URL ?? 'http://127.0.0.1:18000';

type ExtensionFixtures = {
  context: BrowserContext;
  serviceWorker: Worker;
};

// An MV3 extension needs a persistent profile, so the context is built here
// rather than in `use`.
export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`,
        '--no-first-run',
        // Without these, background/occluded-tab throttling makes extension
        // timing flaky under CI load.
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    const worker =
      context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    // A worker that throws on startup otherwise surfaces only as an unrelated
    // timeout, and worker console output is not in the trace.
    worker.on('console', (message) => {
      if (message.type() === 'error') console.error(`[sw] ${message.text()}`);
    });
    await use(worker);
  },

});

export const expect = test.expect;

export const LOOKUP_BUTTON = '[aria-label="Look up with Flyt"]';

export function lookupIcon(page: Page) {
  return page.locator(LOOKUP_BUTTON);
}

// selectText fires selectionchange exactly once, so an assertion retry cannot
// recover from injecting before the listener exists.
export async function waitForContentScript(
  serviceWorker: Worker,
): Promise<void> {
  await expect
    .poll(
      () =>
        serviceWorker.evaluate(async () => {
          const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          try {
            return await chrome.tabs.sendMessage(tab!.id!, { kind: 'ping' });
          } catch {
            // "Receiving end does not exist" until the script is injected.
            return false;
          }
        }),
      { timeout: 15_000 },
    )
    .toBe(true);
}

export async function selectText(page: Page, selector: string): Promise<void> {
  await page.evaluate((target) => {
    const node = document.querySelector(target);
    if (!node) throw new Error(`missing ${target}`);
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, selector);
}

// Authenticating the browser context is enough: the extension reads the cookie
// from the shared cookie store.
export async function loginAs(
  context: BrowserContext,
  email: string,
): Promise<void> {
  const response = await context.request.post(`${API_URL}/test/login`, {
    data: { email },
  });
  expect(response.ok()).toBeTruthy();
}
