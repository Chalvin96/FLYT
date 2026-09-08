import { expect, test } from '@playwright/test';

import { loginAs } from './helpers/auth';

// Dictionary lookup from the app shell. The entry point and lemma surface
// differ by viewport: desktop exposes the search field in the header and
// renders the selected lemma in the same top-anchored popover the search input
// used (swap-in-place, Spotlight-style); mobile exposes search via the
// bottom-navbar "Dictionary" button and renders lemma content as a bottom
// sheet. These specs guard both paths end-to-end.

test('desktop: selecting a search result opens the lemma in the anchored popover', async ({
  page,
}) => {
  await loginAs(page, 'learner@example.com');
  await page.goto('/home');

  // The desktop navbar search button is identified by its aria-label (which
  // overrides the visible "Look up a word…" copy for accessible naming).
  await page.getByRole('button', { name: 'Search dictionary' }).click();

  // Search sheet input.
  const input = page.getByPlaceholder('Search a Norwegian word');
  await expect(input).toBeVisible();
  await input.fill('bo');

  // Wait for the suggestions listbox and grab the first option. The e2e lexicon
  // fixtures seed "bok", so prefix "bo" resolves to at least one suggestion.
  const listbox = page.getByRole('listbox', { name: /suggestions/i });
  await expect(listbox).toBeVisible();
  const firstOption = listbox.getByRole('option').first();
  await expect(firstOption).toBeVisible();

  // Wait for the browse/lemma lookup that fires on selection. Anchor to the
  // lexicons path segment so an unrelated request with "browse"/"lemma" in its
  // URL can't satisfy the wait.
  const definitionResponse = page.waitForResponse((res) =>
    /\/lexicons\/(browse|lemmas)\b/.test(new URL(res.url()).pathname),
  );
  await firstOption.click();
  await definitionResponse;

  // Regression: on desktop app shell the lemma must render in the same
  // top-anchored popover the search input used (not a bottom sheet). Before
  // the fix, LookupSheet returned null for all desktop lemma mode and the
  // result click opened nothing.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toBeEmpty();
  await expect(dialog).toHaveClass(/top-20/);
  await expect(dialog).not.toHaveClass(/bottom-4/);
});

test('mobile: selecting a search result opens the lemma bottom sheet', async ({
  page,
}) => {
  // Match the mobile layout breakpoint used elsewhere (reading.spec). Below
  // 1024px the header search field disappears and lookup is reached via the
  // bottom navbar's "Dictionary" button.
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAs(page, 'learner@example.com');
  await page.goto('/home');

  // The mobile bottom navbar has a "Dictionary" button (icon + label) rather
  // than the header search field used on desktop.
  await page
    .getByRole('navigation', { name: /mobile navigation/i })
    .getByRole('button', { name: /dictionary/i })
    .click();

  const input = page.getByPlaceholder('Search a Norwegian word');
  await expect(input).toBeVisible();
  await input.fill('bo');

  const listbox = page.getByRole('listbox', { name: /suggestions/i });
  await expect(listbox).toBeVisible();
  const firstOption = listbox.getByRole('option').first();
  await expect(firstOption).toBeVisible();

  const definitionResponse = page.waitForResponse((res) =>
    /\/lexicons\/(browse|lemmas)\b/.test(new URL(res.url()).pathname),
  );
  await firstOption.click();
  await definitionResponse;

  // On mobile the lemma renders as a bottom sheet (Radix Dialog).
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toBeEmpty();
});
