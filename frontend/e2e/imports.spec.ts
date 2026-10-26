import { expect, test } from './fixtures';
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

test('test_import_given_untitled_paste_and_inline_rename_expect_default_title_and_saved_reader_title', async ({
  page,
}) => {
  await loginAs(page, 'importer@example.com');
  await page.goto('/reading/imports');

  await page
    .getByRole('button', { name: /import text/i })
    .first()
    .click();

  await page.getByLabel(/^text/i).fill(IMPORT_TEXT);
  await page.getByRole('button', { name: /^import$/i }).click();

  const defaultTitle = 'Det var en gang en liten by ved fjorden.';
  await expect(
    page.getByRole('link', { name: defaultTitle, exact: false }),
  ).toBeVisible({ timeout: READY_TIMEOUT_MS });
  await page.getByRole('button', { name: `Rename ${defaultTitle}` }).click();
  const titleField = page.getByRole('textbox', { name: 'Import title' });
  await expect(titleField).toBeFocused();
  await titleField.fill('Byen ved fjorden');
  const renameResponse = page.waitForResponse(
    (response) =>
      /^\/imports\/[^/]+$/.test(new URL(response.url()).pathname) &&
      response.request().method() === 'PATCH',
  );
  await titleField.press('Enter');
  expect((await renameResponse).ok()).toBe(true);
  await expect(page.getByRole('textbox', { name: 'Import title' })).toHaveCount(
    0,
  );
  await page.reload();
  await page.getByRole('link', { name: /Byen ved fjorden/i }).click();
  await expect(page).toHaveURL(/\/reading\/story\//);
  await expect(
    page.getByRole('heading', { name: 'Byen ved fjorden' }),
  ).toBeVisible();

  await expect(page.getByTestId('word-button').first()).toBeVisible();
});
