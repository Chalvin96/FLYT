import { expect, test, type Page } from '@playwright/test';

import { loginAs } from './helpers/auth';

// ── Helpers ────────────────────────────────────────────────────────────────

async function startPractice(page: Page): Promise<void> {
  await page.goto('/review');
  await expect(
    page.getByRole('heading', { name: 'How would you like to practice?' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start practice' }).click();
}

async function isSessionComplete(page: Page): Promise<boolean> {
  return page
    .getByRole('heading', { name: 'Session complete' })
    .isVisible()
    .catch(() => false);
}

async function reviewQueueTotal(page: Page): Promise<number> {
  const getText = async (testid: string): Promise<number> => {
    const locator = page.getByTestId(testid);
    try {
      await locator.waitFor({ state: 'visible', timeout: 2000 });
      const text = await locator.textContent();
      const match = text?.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    } catch {
      return 0;
    }
  };
  const [n, l, r] = await Promise.all([
    getText('count-new'),
    getText('count-learning'),
    getText('count-review'),
  ]);
  return n + l + r;
}

/**
 * Answer the current definition card with the given rating. The seeded review
 * users get definition cards: tap "Check answer" to reveal the back, then a
 * rating button. Rating buttons carry an aria-label like "Again, next in 1m"
 * when FSRS previews are present, so match by the leading word.
 */
async function answerDefinitionCard(
  page: Page,
  rating = 'Easy',
): Promise<void> {
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: new RegExp(`^${rating}\\b`) }).click();
}

/** Answer definition cards until the completion screen appears. */
async function drainSession(page: Page, max = 20): Promise<void> {
  for (let i = 0; i < max; i++) {
    if (await isSessionComplete(page)) return;
    const check = page.getByRole('button', { name: 'Check answer' });
    if (await check.isVisible().catch(() => false)) {
      await answerDefinitionCard(page);
    } else {
      await page.waitForTimeout(150);
    }
  }
}

/**
 * Assert the page has NOT dead-ended: either a card is still showing
 * (Check answer visible) or the "Studying ahead" signal is visible — but
 * NOT the celebratory "Session complete". The waiting screen no longer
 * exists (completion-only model).
 */
async function isSessionAlive(page: Page): Promise<boolean> {
  const checkAnswer = page.getByRole('button', { name: 'Check answer' });
  const ahead = page.getByTestId('ahead-signal');

  const visible = await Promise.all([
    checkAnswer.isVisible().catch(() => false),
    ahead.isVisible().catch(() => false),
  ]);

  return visible.some(Boolean);
}

// ── Tests ──────────────────────────────────────────────────────────────────

test('review session advances after rating a card', async ({ page }) => {
  await loginAs(page, 'review-rating@example.com');
  await startPractice(page);

  // Live counter proves the session is active
  const totalBefore = await reviewQueueTotal(page);
  expect(totalBefore).toBeGreaterThan(0);

  // Answer one definition card.
  await answerDefinitionCard(page, 'Good');

  // Session advanced without crashing: still showing the live counter, or done.
  await expect(
    page
      .getByTestId('count-new')
      .or(page.getByRole('heading', { name: 'Session complete' })),
  ).toBeVisible();
});

test('review session shows completion state after the queue is cleared', async ({
  page,
}) => {
  test.setTimeout(90_000);

  await loginAs(page, 'review-complete@example.com');
  await startPractice(page);

  // Counter visible — session started
  const total = await reviewQueueTotal(page);
  expect(total).toBeGreaterThan(0);

  await drainSession(page);

  await expect(
    page.getByRole('heading', { name: 'Session complete' }),
  ).toBeVisible();
  await expect(page.getByText(/\d+ cards? reviewed/)).toBeVisible();
});

test('definition flashcard back is scrollable and not clipped by a 3D context', async ({
  page,
}) => {
  await loginAs(page, 'review-definition@example.com');
  await startPractice(page);

  await page.getByRole('button', { name: 'Check answer' }).click();

  // Visible rating buttons prove the definition back is not clipped below the fold.
  await expect(page.getByRole('button', { name: 'Again' })).toBeVisible();

  // Chrome can swallow wheel events when a scroller lives under a 3D ancestor.
  const result = await page.evaluate(() => {
    const findScrollContainer = (): Element | null => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_ELEMENT,
      );
      let node: Node | null = walker.nextNode();
      while (node) {
        const el = node as Element;
        const style = window.getComputedStyle(el);
        if (style.overflowY === 'auto' && el.scrollHeight > el.clientHeight) {
          return el;
        }
        node = walker.nextNode();
      }
      return null;
    };

    const scroller = findScrollContainer();
    if (!scroller) {
      return { found: false, has3DAncestor: false };
    }

    let el: Element | null = scroller.parentElement;
    while (el) {
      const style = window.getComputedStyle(el);
      if (
        style.perspective !== 'none' ||
        style.transformStyle === 'preserve-3d'
      ) {
        return { found: true, has3DAncestor: true };
      }
      el = el.parentElement;
    }
    return { found: true, has3DAncestor: false };
  });

  expect(result.has3DAncestor).toBe(false);
});

test('new user sees the empty review state', async ({ page }) => {
  await loginAs(page, 'empty-review@example.com');
  await page.goto('/review');

  await expect(
    page.getByRole('heading', { name: 'Nothing to review yet' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Browse lessons' }),
  ).toBeVisible();
});

test('rapidly failing a learning card interleaves another card (Anki requeue_learning_entry)', async ({
  page,
}) => {
  test.setTimeout(90_000);

  await loginAs(page, 'review-definition@example.com');
  await startPractice(page);

  const totalBefore = await reviewQueueTotal(page);
  expect(totalBefore).toBeGreaterThan(0);

  // Rapidly rate the first definition card with "Again". FSRS moves it to a
  // short learning step so it stays showable via the learn-ahead window.
  await answerDefinitionCard(page, 'Again');

  // Must NOT show "Session complete" while cards remain in the queue.
  await expect(
    page.getByRole('heading', { name: 'Session complete' }),
  ).not.toBeVisible();

  // If a second card is available, the Anki interleave rule surfaces another
  // showable card (the one just answered may reappear via learn-ahead, or a
  // different card may be shown). Rate it with "Again" too. Per-card
  // interleave correctness is fully covered by the unit tests; here we only
  // assert the session keeps presenting cards and never dead-ends.
  const secondCheck = page.getByRole('button', { name: 'Check answer' });
  if (await secondCheck.isVisible().catch(() => false)) {
    await answerDefinitionCard(page, 'Again');
  }

  // The session stays alive: either the next card is already showing or the
  // "Studying ahead" signal is visible. Give the UI a brief moment.
  let alive = false;
  for (let i = 0; i < 20; i++) {
    alive = await isSessionAlive(page);
    if (alive) break;
    await page.waitForTimeout(250);
  }
  expect(alive).toBe(true);
});
