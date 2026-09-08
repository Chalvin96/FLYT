import { expect, test } from '@playwright/test';

import { loginAs } from './helpers/auth';

// The E2E seed (`seed_e2e_user_state`) gives `power-learner` 3 NEW review cards
// from lesson-owned pools — i.e. 3 *grammar* cards, all in the `not_started`
// bucket. The default My Cards view is started-only, so those 3 are hidden
// behind the not-started toggle. This is exactly the surface of the F0 bug the
// page fixed (the toggle used to send the param under the wrong casing and
// return nothing), so it is the highest-value journey to lock down.

test('empty user sees the empty My Cards state', async ({ page }) => {
  await loginAs(page, 'empty-words@example.com');
  await page.goto('/words');

  await expect(
    page.getByRole('heading', { name: 'No cards yet' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Browse lessons' }),
  ).toBeVisible();
});

test('not-started toggle reveals the seeded cards (F0 regression)', async ({
  page,
}) => {
  await loginAs(page, 'power-learner@example.com');
  await page.goto('/words');

  // Gallery loads with the summary strip; the not_started bucket holds all 3.
  await expect(page.getByRole('heading', { name: 'My cards' })).toBeVisible();
  await expect(page.getByTestId('bucket-not_started')).toContainText('3');

  // Started-only default view is empty (every seeded card is not_started) and
  // says so rather than showing a wall of rows.
  await expect(page.getByText('No cards in this view.')).toBeVisible();
  await expect(page.getByTestId('badge-not_started')).toHaveCount(0);

  // Activate the not-started view — the toggle must actually return rows.
  await page.getByRole('button', { name: 'Show 3 not-started cards' }).click();

  // The 3 seeded cards are grammar cards that collapse into per-lesson
  // groups (each group header carries a single not_started badge for its
  // weakest card), so the badge count is the number of grammar-lesson groups,
  // not 3. The F0 regression guard is that the toggle returns rows at all —
  // here we assert the grouped rows actually render (non-empty).
  await expect(page.getByText('All · Weakest first')).toBeVisible();
  expect(await page.getByTestId('badge-not_started').count()).toBeGreaterThan(
    0,
  );

  // Grammar rows link to their lesson; recovery back to the started view exists.
  await expect(page.getByRole('link', { name: /Browse lessons/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('button', { name: 'Back to started cards' }),
  ).toBeVisible();
});
