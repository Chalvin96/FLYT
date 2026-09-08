import { expect, test } from '@playwright/test';

import { loginAs } from './helpers/auth';

// Long enough to page, short enough to finish inside READY_TIMEOUT_MS.
const IMPORT_TEXT = [
  'Det var en gang en liten by ved fjorden.',
  'Hver morgen gikk folk til brygga for å se på båtene.',
  'Om vinteren lå snøen tungt på takene, og barna gikk på ski til skolen.',
].join('\n\n');

// The worker must pick the job off Redis, tokenize, and page the text.
const READY_TIMEOUT_MS = 60_000;

test('unauthenticated access to the imports page redirects to login', async ({
  page,
}) => {
  await page.goto('/reading/imports');

  await expect(page).toHaveURL(/\/login$/);
});

test('imports page loads against the real API', async ({ page }) => {
  await loginAs(page, 'importer@example.com');
  await page.goto('/reading/imports');

  await expect(
    page.getByRole('heading', { name: /your imports/i }),
  ).toBeVisible();

  await expect(page.getByText(/could not load your imports/i)).toHaveCount(0);
});

test('pasting text creates an import that becomes readable', async ({
  page,
}) => {
  await loginAs(page, 'importer@example.com');
  await page.goto('/reading/imports');

  await page
    .getByRole('button', { name: /import text/i })
    .first()
    .click();

  await page.getByLabel(/^title/i).fill('Byen ved fjorden');
  await page.getByLabel(/^text/i).fill(IMPORT_TEXT);
  await page.getByRole('button', { name: /^import$/i }).click();

  const card = page.getByRole('link', { name: /Byen ved fjorden/i });
  await expect(card).toBeVisible({ timeout: READY_TIMEOUT_MS });

  await card.click();
  await expect(page).toHaveURL(/\/reading\/story\//);
  await expect(
    page.getByRole('heading', { name: 'Byen ved fjorden' }),
  ).toBeVisible();

  await expect(page.getByTestId('word-button').first()).toBeVisible();
});
