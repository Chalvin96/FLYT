import { expect, test } from '@playwright/test';

import { loginAs } from './helpers/auth';

// Without an OpenRouter key the stack boots with the openrouter provider
// disabled, leaving only the locked ChatGPT provider — nothing can generate, so
// there is no walkthrough to record.
test.skip(
  !process.env.OPENROUTER_API_KEY,
  'needs OPENROUTER_API_KEY: the stack disables the openrouter provider without one',
);

// Record this suite only. The global config keeps video: 'retain-on-failure'
// so other suites don't bloat artifacts; this spec opts in to always-on video.
test.use({ video: 'on' });

// A real model call through the arq worker is not instantaneous. Generous
// upper bound for the whole generate→ready transition; we assert on real
// conditions, never on this timeout.
const GENERATION_TIMEOUT_MS = 180_000;

// Slow the interaction pace so the recording reads as a walkthrough rather
// than a blur. These are pacing pauses only — every assertion waits on a
// real condition.
const PACE_MS = 900;

test('recorded walkthrough: generate a Norwegian story, look up a word, import it', async ({
  page,
}) => {
  // The model call is a real OpenRouter request through the worker, so the
  // whole journey needs headroom well beyond Playwright's 30s default.
  test.setTimeout(200_000);

  // Mobile viewport so a word tap opens the bottom-sheet lookup (the clearest
  // visual proof that lookup works on generated text before import).
  await page.setViewportSize({ width: 390, height: 844 });

  // 1. Log in as a seeded learner and open the generate route.
  await loginAs(page, 'learner@example.com');
  await page.goto('/reading/generate');

  await expect(
    page.getByRole('heading', { name: 'Generate a story to read' }),
  ).toBeVisible();

  // 2. Show the request form: anchored providers, anchors, lengths, topic
  // suggestions, and the remaining Flyt percentage.
  await expect(page.getByText('Build it from', { exact: true })).toBeVisible();
  await expect(page.getByText('Length', { exact: true })).toBeVisible();
  await expect(page.getByText('Written by', { exact: true })).toBeVisible();
  await expect(page.getByText(/\d+% left/).first()).toBeVisible();

  // The ChatGPT provider is visibly locked for a learner who never linked it.
  const chatgptProvider = page.getByRole('radio', { name: /ChatGPT/i });
  await expect(chatgptProvider).toBeDisabled();
  await expect(page.getByText(/^Locked$/)).toBeVisible();

  // The no-anchor ("Anything") option is available; the deck/frequency anchors
  // have nothing to draw on in the e2e seed.
  const anythingAnchor = page.getByRole('radio', { name: /Anything/i });
  await expect(anythingAnchor).toBeEnabled();

  // 3. Take a suggested topic so it fills the field.
  const suggestions = page.locator('[aria-label="Topic suggestions"] button');
  await expect(suggestions.first()).toBeVisible();
  const suggestionText = (await suggestions.first().textContent()) ?? '';
  await suggestions.first().click();
  await expect(page.getByLabel('Topic', { exact: true })).toHaveValue(
    suggestionText.trim(),
  );

  // 4. Choose the no-anchor option.
  await anythingAnchor.click();
  await expect(anythingAnchor).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(PACE_MS);

  // 5. Generate — this hits the real OpenRouter API through the worker.
  const generateStartedAt = Date.now();
  const generationResponse = page.waitForResponse(
    (res) =>
      res.url().endsWith('/story-generation/generations') &&
      res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^Generate$/i }).click();
  await generationResponse;

  // The processing state is the immediate feedback that the request landed.
  await expect(
    page.getByRole('heading', { name: /Writing your story/i }),
  ).toBeVisible();

  // 6. Wait for the ready state and show the generated Norwegian story.
  const storyArticle = page.locator('article[aria-label="Generated story"]');
  await expect(
    storyArticle,
    'story should reach the ready state within the model-call timeout',
  ).toBeVisible({ timeout: GENERATION_TIMEOUT_MS });
  const modelCallMs = Date.now() - generateStartedAt;

  await expect(page.getByText(/Not saved\./)).toBeVisible();
  await storyArticle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(PACE_MS);

  const storyText = (await storyArticle.textContent()) ?? '';
  expect(
    storyText.trim().length,
    'generated story must produce non-empty text',
  ).toBeGreaterThan(20);
  const hasNorwegianLetters = /[æøå]/i.test(storyText);
  // Length is already reported by the page; surface the model-call duration
  // and whether the text reads as Norwegian for the post-run report.
  test.info().annotations.push({
    type: 'model-call-ms',
    description: String(modelCallMs),
  });
  test.info().annotations.push({
    type: 'story-has-norwegian-letters',
    description: String(hasNorwegianLetters),
  });
  test.info().annotations.push({
    type: 'story-preview',
    description: storyText.slice(0, 200),
  });
  await page.waitForTimeout(PACE_MS);

  // 7. Tap a word to open the lookup sheet on generated text (pre-import).
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
  await page.waitForTimeout(PACE_MS);

  // Close the sheet so the import button is unobstructed for the next step.
  const closeButton = page.getByRole('button', { name: /close/i });
  if ((await closeButton.count()) > 0) {
    await closeButton.first().click();
  } else {
    await page.mouse.click(10, 10);
  }
  await expect(lookupSheet).toHaveCount(0);
  await page.waitForTimeout(PACE_MS);

  // 8. Import, and show the import succeeding by navigating to the reader.
  const importResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/story-generation/generations/current/import') &&
      res.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /^Import to library$/i }).click();
  await importResponse;

  await expect(page).toHaveURL(/\/reading\/story\//);
});
