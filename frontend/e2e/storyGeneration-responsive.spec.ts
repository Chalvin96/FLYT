import { expect, test, type Page } from '@playwright/test';

const user = {
  id: 1,
  uuid: 'story-responsive-fixture-user',
  email: 'story-responsive@example.com',
  display_name: 'Story fixture',
  avatar_url: null,
  last_login: null,
};

const surface = {
  providers: [
    {
      name: 'openrouter',
      model: 'openrouter/free',
      available: true,
      limitedByFlyt: true,
      reason: null,
      action: null,
      remainingPercent: 77,
    },
    {
      name: 'chatgpt',
      model: 'gpt-5',
      available: false,
      limitedByFlyt: false,
      reason: 'account_not_linked',
      action: 'link_account',
      remainingPercent: null,
    },
  ],
  anchors: [
    { type: 'frequency', available: true, reason: null },
    { type: 'none', available: true, reason: null },
  ],
  deckCollapsesWithFrequency: true,
  minDeckSize: 100,
  lengthOptions: [150, 300],
  topicSuggestions: ['A rainy day'],
};

// Long enough that the result overflows any bounded region at every viewport.
const longStoryPage = (index: number) => ({
  index,
  content: Array.from(
    { length: 8 },
    (_, sentence) =>
      `Setning ${index}-${sentence} forteller en lang historie om solen over fjellet.`,
  ).join(' '),
  tokens: [],
  wordCount: 64,
});

const readyGeneration = {
  generationId: 1,
  status: 'ready',
  provider: 'openrouter',
  anchor: 'none',
  length: 300,
  topic: 'A rainy day',
  pages: Array.from({ length: 6 }, (_, index) => longStoryPage(index)),
  userStates: {},
  failureCode: null,
  failureMessage: null,
};

async function mockStoryRoutes(page: Page) {
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
  await page.route('**/story-generation', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(surface),
      });
      return;
    }
    await route.continue();
  });
  await page.route('**/story-generation/generations/current', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(readyGeneration),
      });
      return;
    }
    await route.continue();
  });
}

test('test_story_generation_given_viewport_expect_actions_reachable_without_overflow', async ({
  page,
}) => {
  await mockStoryRoutes(page);

  for (const viewportWidth of [390, 768, 1440]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    await page.goto('/reading/generate');

    const shelf = page.getByTestId('generated-story-actions');
    await expect(shelf).toBeVisible();
    for (const name of [
      'Read story',
      'Import to library',
      'Generate another',
    ]) {
      await expect(shelf.getByRole('button', { name })).toBeVisible();
    }
    await expect(
      page.getByRole('article', { name: 'Generated story' }),
    ).toBeVisible();

    const metrics = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewportWidth);

    if (viewportWidth < 1280) {
      const shelfClass = (await shelf.getAttribute('class')) ?? '';
      expect(shelfClass).toContain('sticky');
      expect(shelfClass).toContain('top-0');
    } else {
      // Desktop: the story body scrolls inside a bounded region while the
      // shelf stays put above it.
      const card = page.getByTestId('generated-story');
      const cardClass = (await card.getAttribute('class')) ?? '';
      expect(cardClass).toContain('xl:max-h-');

      const body = page.getByTestId('generated-story-body');
      await expect(body).toBeVisible();
      const shelfTop = (await shelf.boundingBox())?.y;
      await body.evaluate((element) => {
        element.scrollTop = 480;
      });
      expect(await body.evaluate((element) => element.scrollTop)).toBe(480);
      expect((await shelf.boundingBox())?.y).toBe(shelfTop);
    }
  }
});

test('test_story_generation_given_mobile_scroll_expect_sticky_actions_not_covered', async ({
  page,
}) => {
  await mockStoryRoutes(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/reading/generate');

  const shelf = page.getByTestId('generated-story-actions');
  const importButton = shelf.getByRole('button', { name: 'Import to library' });

  await page
    .getByRole('article', { name: 'Generated story' })
    .evaluate((element) => {
      element.scrollIntoView({ block: 'end' });
    });
  await page.mouse.wheel(0, 600);

  const shelfBox = await shelf.boundingBox();
  const actionBox = await importButton.boundingBox();
  expect(shelfBox).not.toBeNull();
  expect(actionBox).not.toBeNull();

  const shelfTop = shelfBox?.y ?? Number.NaN;
  const actionTop = actionBox?.y ?? Number.NaN;
  const actionBottom = actionBox ? actionBox.y + actionBox.height : Number.NaN;
  expect(shelfTop).toBeGreaterThanOrEqual(0);
  expect(actionTop).toBeGreaterThanOrEqual(shelfTop);
  expect(actionBottom).toBeLessThanOrEqual(844);
  await expect(importButton).toBeEnabled();
  await expect(importButton).toBeInViewport({ ratio: 1 });
});
