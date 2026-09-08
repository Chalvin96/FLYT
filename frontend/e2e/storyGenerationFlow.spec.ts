import { expect, test } from '@playwright/test';

import { loginAs } from './helpers/auth';

// Always-on counterpart to the recorded walkthrough in storyGeneration.spec.ts.
// Runs without OPENROUTER_API_KEY: the stack boots with the stub provider, and
// the arq worker runs the real pipeline over its canned Norwegian text.

// The worker still paginates, annotates, and links lemmas; generous upper
// bound for the generate→ready transition, asserted on real conditions only.
const GENERATION_TIMEOUT_MS = 120_000;

test('generated story flow: stub provider drives ready, lookup, and import', async ({
  page,
}) => {
  test.setTimeout(180_000);

  // Mobile viewport so a word tap opens the bottom-sheet lookup, proving
  // lookup works on generated text before import.
  await page.setViewportSize({ width: 390, height: 844 });

  await loginAs(page, 'learner@example.com');
  await page.goto('/reading/generate');

  await expect(
    page.getByRole('heading', { name: 'Generate a story to read' }),
  ).toBeVisible();

  // 1. The request form renders with the Flyt-funded provider.
  await expect(page.getByText('Build it from', { exact: true })).toBeVisible();
  await expect(page.getByText('Length', { exact: true })).toBeVisible();
  await expect(page.getByText('Written by', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+% left/).first()).toBeVisible();

  // 2. The ChatGPT provider is present and visibly locked for a learner who
  // never linked it.
  const chatgptProvider = page.getByRole('radio', { name: /ChatGPT/i });
  await expect(chatgptProvider).toBeDisabled();
  await expect(page.getByText(/^Locked$/)).toBeVisible();

  // 3. Generate from the no-anchor option.
  const anythingAnchor = page.getByRole('radio', { name: /Anything/i });
  await expect(anythingAnchor).toBeEnabled();
  await anythingAnchor.click();
  await expect(anythingAnchor).toHaveAttribute('aria-checked', 'true');

  const generationResponse = page.waitForResponse(
    (res) =>
      res.url().endsWith('/story-generation/generations') &&
      res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^Generate$/i }).click();
  await generationResponse;

  // 4. The processing state is the immediate feedback that the request landed.
  await expect(
    page.getByRole('heading', { name: /Writing your story/i }),
  ).toBeVisible();

  // 5. The ready state renders the generated story.
  const storyArticle = page.locator('article[aria-label="Generated story"]');
  await expect(storyArticle).toBeVisible({ timeout: GENERATION_TIMEOUT_MS });

  const storyText = (await storyArticle.textContent()) ?? '';
  expect(storyText.trim().length).toBeGreaterThan(20);
  expect(storyText).toMatch(/æ/i);
  expect(storyText).toMatch(/ø/i);
  expect(storyText).toMatch(/å/i);

  // 6. Tap a word to open the lookup sheet on generated text (pre-import).
  // Only a token that resolved to a seeded lemma renders as a word-button.
  const wordButton = page.locator('[data-testid="word-button"]').first();
  await expect(wordButton).toBeVisible();

  const lookupResponse = page.waitForResponse(
    (res) => res.url().includes('/lemmas/') || res.url().includes('/browse'),
  );
  await wordButton.click();
  await lookupResponse;

  const lookupSheet = page.getByRole('dialog');
  await expect(lookupSheet).toBeVisible();
  await expect(lookupSheet).not.toBeEmpty();

  const closeButton = page.getByRole('button', { name: /close/i });
  if ((await closeButton.count()) > 0) {
    await closeButton.first().click();
  } else {
    await page.mouse.click(10, 10);
  }
  await expect(lookupSheet).toHaveCount(0);

  // 7. Import, and land on the reader for the imported story.
  const importResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/story-generation/generations/current/import') &&
      res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^Import to library$/i }).click();
  await importResponse;

  await expect(page).toHaveURL(/\/reading\/story\//);
});
