import { expect, test } from './fixtures';
import { loginAs } from './helpers/auth';

// Navigate from the reading list to the first available story and return the
// page (already on the story reader URL). Avoids hard-coding story UUIDs.
async function openFirstStory(
  page: Parameters<typeof loginAs>[0],
): Promise<void> {
  await page.goto('/reading');
  // Any anchor whose href starts with /reading/story/ is a story card link.
  const storyLink = page.locator('a[href^="/reading/story/"]').first();
  await expect(storyLink).toBeVisible();
  await storyLink.click();
  await expect(page).toHaveURL(/\/reading\/story\//);
}

// ── Auth guard ──────────────────────────────────────────────────────────────

test('unauthenticated access to a story reader redirects to login', async ({
  page,
}) => {
  // Use a well-formed but non-existent UUID. The auth guard fires before the
  // story is fetched, so any valid-looking UUID triggers the redirect.
  await page.goto('/reading/story/00000000-0000-0000-0000-000000000001');

  await expect(page).toHaveURL(/\/login$/);
});

// ── Navigation ───────────────────────────────────────────────────────────────

test('clicking a story from the reading list opens the story reader', async ({
  page,
}) => {
  await loginAs(page, 'learner@example.com');
  await page.goto('/reading');

  const storyLink = page.locator('a[href^="/reading/story/"]').first();
  await expect(storyLink).toBeVisible();
  await storyLink.click();

  // URL must change to the story reader route.
  await expect(page).toHaveURL(/\/reading\/story\//);
});

test('reader header shows "Back" link instead of the app logo', async ({
  page,
}) => {
  await loginAs(page, 'learner@example.com');
  await openFirstStory(page);

  // The reader layout replaces the "Flyt" logo with a back link.
  const backLink = page.getByRole('link', { name: /back/i });
  await expect(backLink).toBeVisible();

  // The app logo text must not appear in the reader header.
  await expect(page.getByRole('link', { name: 'Flyt' })).toHaveCount(0);
});

test('"← Back" link returns the user to the reading list', async ({ page }) => {
  await loginAs(page, 'learner@example.com');
  await openFirstStory(page);

  await page.getByRole('link', { name: /back/i }).click();

  await expect(page).toHaveURL(/\/reading$/);
});

// ── Desktop side panel ───────────────────────────────────────────────────────

test('test_readerRail_given_no_selected_word_expect_page_vocabulary', async ({
  page,
}) => {
  await loginAs(page, 'learner@example.com');
  await openFirstStory(page);

  const rail = page.getByRole('complementary', {
    name: 'Words on this page',
  });
  await expect(rail).toBeVisible();
  await expect(
    rail.getByRole('heading', { name: 'Words on this page' }),
  ).toBeVisible();
  await expect(
    rail.getByText('Click a word to see its meaning.'),
  ).toBeVisible();
  await expect(rail.getByLabel('Page vocabulary')).toBeVisible();
  await expect(rail.getByTestId('word-button').first()).toBeVisible();
  await expect(rail.getByTestId('definition-panel')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('test_readerRail_given_word_lookup_expect_definition_and_return_to_word_list', async ({
  page,
}) => {
  await loginAs(page, 'learner@example.com');
  await openFirstStory(page);

  const wordButton = page
    .getByRole('main')
    .getByRole('button', { name: 'bok', exact: true })
    .first();
  await expect(wordButton).toBeVisible();
  await wordButton.click();
  const rail = page.getByRole('complementary', {
    name: 'Words on this page',
  });
  await expect(rail.getByTestId('definition-panel')).toBeVisible();
  await expect(rail.getByTestId('reader-lookup')).toBeVisible();
  await expect(rail.getByText('book', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await rail.getByRole('button', { name: 'Back to word list' }).click();
  await expect(rail.getByTestId('definition-panel')).toHaveCount(0);
  await expect(rail.getByLabel('Page vocabulary')).toBeVisible();
});

// ── Mobile layout (<1024px) ──────────────────────────────────────────────────

test('test_readingMode_given_mobile_reader_expect_pinned_header_and_page_controls', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAs(page, 'learner@example.com');
  await openFirstStory(page);

  await expect(
    page.getByRole('navigation', { name: /mobile navigation/i }),
  ).toHaveCount(0);
  const header = page.getByRole('banner');
  await expect(
    header.getByRole('link', { name: 'Back to Reading' }),
  ).toBeVisible();
  await expect(header.getByRole('button', { name: 'Ask Flyt' })).toBeVisible();
  await expect(header.getByText(/^1 \/ \d+$/)).toBeVisible();
  const title = await page.getByRole('heading', { level: 1 }).innerText();
  await expect(header).toContainText(title);
  const pagination = page.getByRole('navigation', { name: 'Story pages' });
  await expect(pagination).toBeVisible();
  await expect(
    pagination.getByRole('button', { name: 'Previous page' }),
  ).toHaveCount(0);
  await expect(
    pagination.getByRole('button', { name: /^(Next page|Finish story)$/ }),
  ).toBeVisible();
  await expect(
    pagination.getByRole('progressbar', { name: 'Story page progress' }),
  ).toHaveAttribute('aria-valuetext', /^Page 1 of \d+$/);
  const reader = page.getByTestId('reader-scroll');
  const shortViewportHeight = 240;
  await page.setViewportSize({ width: 375, height: shortViewportHeight });
  await expect
    .poll(() =>
      reader.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
        return element.scrollTop;
      }),
    )
    .toBeGreaterThan(0);
  await expect(header).toBeInViewport();
  await expect(pagination).toBeInViewport();
  const headerBounds = await header.boundingBox();
  const footerBounds = await page.getByRole('contentinfo').boundingBox();
  expect(headerBounds?.y).toBe(0);
  expect(footerBounds && footerBounds.y + footerBounds.height).toBe(
    shortViewportHeight,
  );
});

test('test_readerVocabulary_given_mobile_reader_expect_word_list_sheet_without_rail', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAs(page, 'learner@example.com');
  await openFirstStory(page);

  await expect(
    page.getByRole('complementary', { name: 'Words on this page' }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Word list' }).click();
  const sheet = page.getByRole('dialog', { name: 'Words on this page' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Page vocabulary')).toBeVisible();
  await expect(sheet.getByTestId('word-button').first()).toBeVisible();
});

test('mobile: tapping an interactive word opens a bottom sheet dialog', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAs(page, 'learner@example.com');
  await openFirstStory(page);

  // Interactive words are rendered as <button data-testid="word-button">
  // inside the story body.
  const wordButton = page.locator('[data-testid="word-button"]').first();
  await expect(wordButton).toBeVisible();

  // Wait for the definition lookup response before asserting dialog content.
  const definitionResponse = page.waitForResponse(
    (res) => res.url().includes('/headword') || res.url().includes('/lemma'),
  );

  await wordButton.click();
  await definitionResponse;

  // On mobile the definition appears in a bottom sheet (Radix UI Dialog).
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // The dialog must contain some definition content (not empty).
  await expect(dialog).not.toBeEmpty();
});

test('mobile: bottom sheet dismisses when clicking the overlay', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAs(page, 'learner@example.com');
  await openFirstStory(page);

  const wordButton = page.locator('[data-testid="word-button"]').first();
  await expect(wordButton).toBeVisible();

  const definitionResponse = page.waitForResponse(
    (res) => res.url().includes('/headword') || res.url().includes('/lemma'),
  );

  await wordButton.click();
  await definitionResponse;

  // Confirm the bottom sheet opened before attempting to dismiss it.
  await expect(page.getByRole('dialog')).toBeVisible();

  // Prefer the explicit close button when present (aria-label="Close" is
  // Radix UI's default). Fall back to clicking the overlay backdrop.
  const closeButton = page.getByRole('button', { name: /close/i });
  if ((await closeButton.count()) > 0) {
    await closeButton.first().click();
  } else {
    // Click the Radix Dialog overlay (rendered outside the dialog content).
    // Clicking at a corner of the screen reliably hits the backdrop on mobile.
    await page.mouse.click(10, 10);
  }

  await expect(page.getByRole('dialog')).toHaveCount(0);
});
