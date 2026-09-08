import { expect, test } from '@playwright/test';

import { loginAs } from './helpers/auth';

test('unauthenticated home redirects to login', async ({ page }) => {
  await page.goto('/home');

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole('heading', { name: 'Start learning Norwegian.' }),
  ).toBeVisible();
});

test('learner dashboard shows lesson and review next steps', async ({
  page,
}) => {
  await loginAs(page, 'learner@example.com');
  await page.goto('/home');

  await expect(
    page.getByRole('heading', { name: 'Choose your next step' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Continue your path' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Review your cards' }),
  ).toBeVisible();
  const desktopNav = page.getByRole('navigation', {
    name: 'Desktop navigation',
  });
  await expect(
    desktopNav.getByRole('link', { name: 'Home', exact: true }),
  ).toBeVisible();
  await expect(
    desktopNav.getByRole('link', { name: 'Lesson', exact: true }),
  ).toBeVisible();
  await expect(
    desktopNav.getByRole('link', { name: 'Practice', exact: true }),
  ).toBeVisible();
});
