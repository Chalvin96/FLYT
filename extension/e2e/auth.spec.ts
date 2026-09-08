import type { Page, Worker } from '@playwright/test';

import {
  API_URL,
  expect,
  loginAs,
  lookupIcon,
  selectText,
  test,
  waitForContentScript,
} from './fixtures/extension';

async function openLookupForBok(
  page: Page,
  serviceWorker: Worker,
): Promise<void> {
  await page.goto('/article.html');
  await waitForContentScript(serviceWorker);
  await selectText(page, '#single');
  await lookupIcon(page).click();
}

test('a lookup resolves without sending the session token', async ({
  page,
  serviceWorker,
}) => {
  // /lexicons/resolve is deliberately anonymous; a Bearer header here would
  // widen where the app's session token travels. The length assertion keeps
  // this honest — if the route never observed the service worker's request,
  // "every header was undefined" would be vacuously true.
  const authHeaders: (string | undefined)[] = [];
  await page.context().route('**/lexicons/resolve*', async (route) => {
    authHeaders.push(route.request().headers()['authorization']);
    await route.continue();
  });

  await openLookupForBok(page, serviceWorker);

  await expect(page.getByRole('button', { name: 'Add to review' }).first()).toBeVisible();
  expect(authHeaders.length).toBeGreaterThan(0);
  expect(authHeaders.every((header) => header === undefined)).toBe(true);
});

test('adding a resolved word to the deck reuses the app session cookie', async ({
  page,
  context,
  serviceWorker,
}) => {
  // The path no unit test can reach: chrome.cookies reads the app's httpOnly
  // session cookie in the service worker and resends it as a Bearer header.
  await loginAs(context, 'extension@example.com');

  await openLookupForBok(page, serviceWorker);

  const addButton = page.getByRole('button', { name: 'Add to review' }).first();
  await expect(addButton).toBeVisible();
  await addButton.click();

  await expect(page.getByRole('button', { name: /Added/ }).first()).toBeVisible();

  // Really in the deck, not just optimistically labelled. A freshly added card
  // has no review history, and the listing hides unstarted cards by default.
  const response = await context.request.get(
    `${API_URL}/me/cards?limit=100&started_only=false`,
  );
  expect(response.ok()).toBeTruthy();
  expect(JSON.stringify(await response.json())).toContain('bok');
});

test('adding without a session offers sign-in instead of failing silently', async ({
  page,
  context,
  serviceWorker,
}) => {
  await context.clearCookies();

  await openLookupForBok(page, serviceWorker);

  const addButton = page.getByRole('button', { name: 'Add to review' }).first();
  await expect(addButton).toBeVisible();
  await addButton.click();

  await expect(page.getByText(/[Ss]ign in/).first()).toBeVisible();
});
