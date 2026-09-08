import { expect, test, type Page } from '@playwright/test';

import { loginAs } from './helpers/auth';

async function continueCurrentLesson(page: Page): Promise<void> {
  const progress = page.getByRole('progressbar', {
    name: 'Lesson page progress',
  });
  const startingProgress = await progress.getAttribute('aria-valuenow');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(progress).not.toHaveAttribute(
    'aria-valuenow',
    startingProgress ?? '',
  );
}

test('new user can start the first lesson from the lesson hub', async ({
  page,
}) => {
  await loginAs(page, 'new-user@example.com');
  await page.goto('/lesson');

  await expect(
    page.getByRole('link', { name: 'Start this lesson' }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Start this lesson' }).click();

  await expect(
    page.getByRole('button', { name: 'Start lesson' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start lesson' }).click();

  await continueCurrentLesson(page);
});

test('learner can resume an in-progress lesson', async ({ page }) => {
  await loginAs(page, 'learner@example.com');
  await page.goto('/lesson');

  await expect(page.locator('main')).toBeVisible();
  await page
    .locator('main a[href^="/lesson/"]')
    .filter({ hasText: 'In progress' })
    .first()
    .click();

  await expect(page.getByRole('button', { name: 'Start lesson' })).toHaveCount(
    0,
  );
  await continueCurrentLesson(page);
});
