import { expect, test, type Locator, type Page } from '@playwright/test';

const storybookPort = process.env.FLYT_E2E_STORYBOOK_PORT ?? '6307';
test.use({ baseURL: `http://127.0.0.1:${storybookPort}` });

const STORY_ROOT = '#storybook-root';
const VIEWPORT = { width: 1024, height: 900 };
const MAX_TAB_STOPS = 40;

type Corner = 'borderTopLeftRadius' | 'borderTopRightRadius';

async function openStory(page: Page, story: string): Promise<void> {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`/iframe.html?id=${story}&viewMode=story`);
  await expect(page.locator(STORY_ROOT)).toBeVisible();
}

async function tokenColour(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('div');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const painted = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return painted;
  }, token);
}

async function tabTo(page: Page, selector: string): Promise<void> {
  for (let stop = 0; stop < MAX_TAB_STOPS; stop += 1) {
    await page.keyboard.press('Tab');
    const reached = await page.evaluate(
      (target) => document.activeElement?.matches(target) ?? false,
      selector,
    );
    if (reached) {
      return;
    }
  }
  throw new Error(`no tab stop reached ${selector} within ${MAX_TAB_STOPS}`);
}

async function focusedBoxShadow(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof Element)) {
      throw new Error('nothing holds focus');
    }
    return getComputedStyle(active).boxShadow;
  });
}

async function expectFocusRing(page: Page, colour: string): Promise<void> {
  await expect
    .poll(() => focusedBoxShadow(page), {
      message: `the focused control must paint its ring in ${colour}`,
    })
    .toContain(colour);
}

async function scrollAwayFromBottom(page: Page): Promise<void> {
  const viewport = page.locator('[data-slot="message-scroller-viewport"]');
  const box = await viewport.boundingBox();
  if (box === null) {
    throw new Error(
      'the message viewport must have geometry before it can scroll',
    );
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, -1200);
  await expect(page.locator('[data-slot="message-scroller-button"]')).toHaveCSS(
    'opacity',
    '1',
  );
}

async function paintedRadius(
  segment: Locator,
  corner: Corner,
): Promise<number> {
  const value = await segment.evaluate(
    (element, property) => getComputedStyle(element)[property],
    corner,
  );
  return Number.parseFloat(value);
}

test('test_progress_bar_given_mixed_segment_states_expect_painted_tokens_and_shapes', async ({
  page,
}) => {
  await openStory(page, 'features-lesson-progressbar--mixed-kinds-and-states');
  const segments = page.getByTestId('lesson-progress-segment');
  await expect(segments).toHaveCount(6);

  await expect(segments.nth(0)).toHaveCSS(
    'background-color',
    await tokenColour(page, '--progress-primary-complete'),
  );
  await expect(segments.nth(1)).toHaveCSS(
    'background-color',
    await tokenColour(page, '--progress-secondary-complete'),
  );
  await expect(segments.nth(2)).toHaveCSS(
    'background-color',
    await tokenColour(page, '--progress-primary-current'),
  );
  await expect(segments.nth(4)).toHaveCSS(
    'background-color',
    await tokenColour(page, '--progress-locked'),
  );
  await expect(segments.nth(5)).toHaveCSS(
    'background-color',
    await tokenColour(page, '--progress-locked'),
  );

  expect(await tokenColour(page, '--progress-primary-complete')).not.toBe(
    await tokenColour(page, '--progress-secondary-complete'),
  );
  expect(await tokenColour(page, '--progress-primary-current')).not.toBe(
    await tokenColour(page, '--progress-secondary-current'),
  );

  const section = segments.nth(1);
  const sectionBox = await section.boundingBox();
  expect(
    await paintedRadius(section, 'borderTopLeftRadius'),
  ).toBeGreaterThanOrEqual((sectionBox?.height ?? 0) / 2);

  await expect(segments.nth(2)).toHaveCSS('height', '14px');
  await expect(segments.nth(3)).toHaveCSS('height', '8px');
  await expect(segments.nth(2)).toHaveCSS('border-top-left-radius', '0px');

  expect(
    await paintedRadius(segments.nth(0), 'borderTopLeftRadius'),
  ).toBeGreaterThan(0);
  await expect(segments.nth(0)).toHaveCSS('border-top-right-radius', '0px');
  expect(
    await paintedRadius(segments.nth(5), 'borderTopRightRadius'),
  ).toBeGreaterThan(0);
  await expect(segments.nth(5)).toHaveCSS('border-top-left-radius', '0px');

  await expect(page.getByRole('button', { name: /, current$/ })).toHaveCSS(
    'height',
    '24px',
  );
  await expect(page.getByRole('button', { name: /, current$/ })).toHaveCSS(
    'cursor',
    'pointer',
  );
  await expect(
    page.getByRole('button', { name: /, locked$/ }).first(),
  ).toHaveCSS('cursor', 'not-allowed');
});

test('test_progress_bar_given_keyboard_focus_expect_ring_around_segment', async ({
  page,
}) => {
  await openStory(page, 'features-lesson-progressbar--mixed-kinds-and-states');

  await tabTo(page, 'button[aria-label^="Go to"]');

  await expectFocusRing(page, await tokenColour(page, '--border-focused'));
});

test('test_message_scroller_given_keyboard_focus_expect_visible_ring', async ({
  page,
}) => {
  await openStory(
    page,
    'features-chatbot-flytchatbotpanel--scrolled-conversation',
  );
  const ring = await tokenColour(page, '--border-focused');

  await tabTo(page, '[data-slot="message-scroller-viewport"]');
  await expectFocusRing(page, ring);
});

test('test_message_scroller_given_keyboard_focus_on_scroll_button_expect_visible_ring', async ({
  page,
}) => {
  await openStory(
    page,
    'features-chatbot-flytchatbotpanel--scrolled-conversation',
  );
  const ring = await tokenColour(page, '--border-focused');

  await scrollAwayFromBottom(page);
  await tabTo(page, '[data-slot="message-scroller-button"]');
  await expectFocusRing(page, ring);
});

test('test_answer_option_given_selected_option_under_pointer_expect_selected_hover_surface', async ({
  page,
}) => {
  await openStory(page, 'features-flashcard-answer-option--all-states');
  const selected = page.getByRole('radio', { name: /selected answer option/i });

  await expect(selected).toHaveCSS(
    'background-color',
    await tokenColour(page, '--background-selected'),
  );

  await selected.hover();

  await expect(selected).toHaveCSS(
    'background-color',
    await tokenColour(page, '--background-selected-hovered'),
  );
  await page.mouse.move(0, 0);
});

test('test_extension_popup_search_control_given_pointer_contact_expect_link_affordance', async ({
  page,
}) => {
  await openStory(
    page,
    'features-extension-popup-search-control--resting-treatment',
  );
  const control = page.getByRole('button', { name: 'Search' });

  await expect(control).toHaveCSS(
    'color',
    await tokenColour(page, '--text-brand'),
  );
  await expect(control).toHaveCSS('text-decoration-line', 'none');

  await control.hover();

  await expect(control).toHaveCSS(
    'color',
    await tokenColour(page, '--text-brand'),
  );
  await expect(control).toHaveCSS('text-decoration-line', 'underline');
  await page.mouse.move(0, 0);
});
