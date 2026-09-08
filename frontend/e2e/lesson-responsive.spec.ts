import { expect, test, type Page } from '@playwright/test';

const lessonSummaries = [
  {
    id: 1,
    source_id: 'responsive-fixture',
    kind: 'grammar',
    family_id: 'basics',
    title: 'Responsive lesson',
    cefr_level: 'A1',
    goal: 'Practice a responsive lesson layout.',
    order: 1,
    state: 'not_started',
    estimated_minutes: 5,
    last_activity_at: null,
  },
];

const user = {
  id: 1,
  uuid: 'responsive-fixture-user',
  email: 'responsive-fixture@example.com',
  display_name: 'Responsive fixture',
  avatar_url: null,
  last_login: null,
};

async function frameMetrics(page: Page) {
  return page.getByTestId('lesson-page').evaluate((frame) => ({
    documentWidth: document.documentElement.scrollWidth,
    frameWidth: frame.getBoundingClientRect().width,
    viewportWidth: window.innerWidth,
  }));
}

async function closeChatbotIfOpen(page: Page): Promise<void> {
  const toggle = page.getByRole('button', { name: 'Ask Flyt' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
}

test('test_lesson_page_given_viewport_expect_shell_width_to_follow_breakpoint', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/users/me', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(user),
      });
      return;
    }
    await route.continue();
  });
  await page.route('**/lessons', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(lessonSummaries),
      });
      return;
    }
    await route.continue();
  });

  for (const viewportWidth of [390, 1023, 1024, 1440]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    await page.goto('/lesson');
    await expect(page.getByTestId('lesson-page')).toBeVisible();
    if (viewportWidth >= 1024) {
      await closeChatbotIfOpen(page);
    }

    const metrics = await frameMetrics(page);
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);

    if (viewportWidth < 1024) {
      expect(metrics.frameWidth).toBeLessThanOrEqual(430);
    } else {
      expect(metrics.frameWidth).toBeGreaterThan(900);
    }
  }
});

test('test_lesson_page_given_desktop_loading_expect_page_width_to_expand', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.route('**/users/me', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(user),
      });
      return;
    }
    await route.continue();
  });

  let releaseRequest: () => void = () => undefined;
  const requestBlocked = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });

  await page.route('**/lessons', async (route) => {
    if (route.request().method() === 'GET') {
      await requestBlocked;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(lessonSummaries),
      });
      return;
    }
    await route.continue();
  });

  try {
    await page.goto('/lesson');
    await expect(page.getByRole('status')).toBeVisible();
    await closeChatbotIfOpen(page);

    const metrics = await frameMetrics(page);
    expect(metrics.frameWidth).toBeGreaterThan(900);
  } finally {
    releaseRequest();
    await page.unroute('**/lessons');
  }
});
