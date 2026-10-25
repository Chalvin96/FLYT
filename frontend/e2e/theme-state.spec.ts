import { expect, test, type Page } from '@playwright/test';

const storybookPort = process.env.FLYT_E2E_STORYBOOK_PORT ?? '6307';
test.use({ baseURL: `http://127.0.0.1:${storybookPort}` });

async function openStory(page: Page, story: string): Promise<void> {
  await page.goto(`/iframe.html?id=${story}&viewMode=story`);
  await expect(page.locator('#storybook-root')).toBeVisible();
}

async function getContrast(page: Page, foreground: string, background: string) {
  return page.evaluate(
    ({ foreground, background }) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas colour resolution is unavailable');
      const probe = document.createElement('span');
      document.body.append(probe);
      const getLuminance = (colour: string) => {
        probe.style.color = colour;
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = getComputedStyle(probe).color;
        context.fillRect(0, 0, 1, 1);
        const channels = context.getImageData(0, 0, 1, 1).data;
        return [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
          const value = channels[index] / 255;
          return (
            sum +
            weight *
              (value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4)
          );
        }, 0);
      };
      const first = getLuminance(foreground);
      const second = getLuminance(background);
      probe.remove();
      return (
        (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
      );
    },
    { foreground, background },
  );
}

test('test_success_roles_given_shared_secondary_steps_expect_readable_feedback', async ({
  page,
}) => {
  await openStory(page, 'features-flashcard-answer-option--all-states');
  for (const [success, neutral] of [
    ['--background-success-subtle', '--background-neutral-pressed'],
    ['--icon-success', '--icon-default'],
    ['--text-success', '--background-neutral-bold'],
  ]) {
    expect(await getContrast(page, `var(${success})`, `var(${neutral})`)).toBe(
      1,
    );
  }
  for (const background of [
    '--background-success-subtle',
    '--background-success',
  ]) {
    expect(
      await getContrast(page, 'var(--text-success)', `var(${background})`),
    ).toBeGreaterThanOrEqual(4.5);
    for (const foreground of ['--border-success', '--icon-success']) {
      expect(
        await getContrast(page, `var(${foreground})`, `var(${background})`),
      ).toBeGreaterThanOrEqual(3);
    }
  }
});

test('test_story_status_given_progress_and_completion_expect_readable_labels_and_completed_check', async ({
  page,
}) => {
  for (const [story, label] of [
    ['features-reading-storycard--card-in-progress', 'In progress'],
    ['features-reading-storycard--card-completed', 'Finished'],
  ]) {
    await openStory(page, story);
    const status = page.getByText(label, { exact: true });
    await expect(status).toBeVisible();
    const colours = await status.evaluate((element) => ({
      text: getComputedStyle(element).color,
      fill: getComputedStyle(element.closest('a') ?? element).backgroundColor,
    }));
    expect(
      await getContrast(page, colours.text, colours.fill),
    ).toBeGreaterThanOrEqual(4.5);
  }
  await expect(
    page.getByText('Finished', { exact: true }).locator('..').locator('svg'),
  ).toBeVisible();
});

test('test_match_tile_given_correct_pair_expect_check_and_accessible_label_with_distinct_emphasis', async ({
  page,
}) => {
  await openStory(page, 'features-flashcard-flashcardmatch--default');
  await page.getByRole('button', { name: 'jeg leser', exact: true }).click();
  await page.getByRole('button', { name: 'I read', exact: true }).click();
  for (const text of ['jeg leser', 'I read']) {
    const tile = page.getByRole('button', { name: `${text}, correct` });
    await expect(tile).toBeDisabled();
    const check = tile.getByText('✓', { exact: true });
    await expect(check).toBeVisible();
    const colour = await check.evaluate(
      (element) => getComputedStyle(element).color,
    );
    const background = await tile.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(
      await getContrast(page, colour, 'var(--icon-default)'),
    ).toBeGreaterThan(1.1);
    expect(await getContrast(page, colour, background)).toBeGreaterThanOrEqual(
      4.5,
    );
  }
});

test('test_feature_icons_given_success_accents_expect_labelled_glyphs_with_distinct_emphasis', async ({
  page,
}) => {
  await page.goto(process.env.FLYT_E2E_BASE_URL ?? 'http://127.0.0.1:4173');
  const features = page.locator('#features');
  const neutralIcon = features
    .getByRole('article')
    .filter({
      has: page.getByRole('heading', { name: 'Ask in plain English' }),
    })
    .locator('svg');
  const neutralColour = await neutralIcon.evaluate(
    (element) => getComputedStyle(element).color,
  );
  const title = 'Honest progress';
  const feature = features
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: title }) });
  await expect(feature.getByRole('heading', { name: title })).toBeVisible();
  const icon = feature.locator('svg');
  await expect(icon).toBeVisible();
  const colour = await icon.evaluate(
    (element) => getComputedStyle(element).color,
  );
  const background = await icon
    .locator('..')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(await getContrast(page, colour, neutralColour)).toBeGreaterThan(1.1);
  expect(await getContrast(page, colour, background)).toBeGreaterThanOrEqual(3);
});

test('test_mobile_navigation_given_active_item_expect_selected_indicator_above_contrast_floor', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await openStory(page, 'features-common-baseherocard--default');
  const active = page
    .getByRole('navigation', { name: 'Mobile navigation' })
    .locator('[aria-current="page"]');
  const indicator = active.locator(':scope > span').first();
  await expect(indicator).toHaveCSS('border-top-width', '2px');
  const colours = await indicator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      border: style.borderTopColor,
      fill: style.backgroundColor,
      text: style.color,
    };
  });
  expect(
    await getContrast(page, colours.border, colours.fill),
  ).toBeGreaterThanOrEqual(3);
  expect(
    await getContrast(page, colours.border, 'var(--surface-overlay)'),
  ).toBeGreaterThanOrEqual(3);
  expect(
    await getContrast(page, colours.text, colours.fill),
  ).toBeGreaterThanOrEqual(4.5);
});

test('test_progress_given_ten_percent_completion_expect_full_width_fill_and_unscaled_border', async ({
  page,
}) => {
  await openStory(page, 'features-common-progress--ten-percent');
  const bars = page.getByRole('progressbar');
  await expect(bars).toHaveCount(3);
  for (const bar of await bars.all()) {
    const fill = bar.locator(':scope > div').first();
    await expect(fill).toHaveCSS('transform', 'none');
    await expect(fill).toHaveCSS('border-top-width', '1px');
    await expect(fill).toHaveCSS(
      'clip-path',
      'inset(0px 90% 0px 0px round 9999px)',
    );
    const barBox = await bar.boundingBox();
    const fillBox = await fill.boundingBox();
    expect(fillBox?.width).toBeCloseTo(barBox?.width ?? 0, 0);
  }
});

test('test_secondary_button_given_pointer_and_press_expect_visible_fill_changes_with_readable_copy', async ({
  page,
}) => {
  await openStory(page, 'design-system-actions-button--approved-matrix');
  const button = page
    .locator('section')
    .filter({ has: page.getByText('Secondary', { exact: true }) })
    .getByRole('button', { name: 'Default', exact: true });
  const getColours = () =>
    button.evaluate((element) => ({
      background: getComputedStyle(element).backgroundColor,
      text: getComputedStyle(element).color,
    }));
  const resting = await getColours();
  await expect(button).toHaveCSS('background-color', 'rgb(240, 235, 255)');
  await button.hover();
  await expect(button).toHaveCSS('background-color', 'rgb(216, 208, 255)');
  const hovered = await getColours();
  expect(
    await getContrast(page, resting.background, hovered.background),
  ).toBeGreaterThan(1.2);
  await page.mouse.down();
  await expect(button).toHaveCSS('background-color', 'rgb(196, 183, 255)');
  const pressed = await getColours();
  expect(
    await getContrast(page, hovered.background, pressed.background),
  ).toBeGreaterThan(1.2);
  for (const state of [resting, hovered, pressed]) {
    expect(
      await getContrast(page, state.text, state.background),
    ).toBeGreaterThanOrEqual(4.5);
  }
  await page.mouse.up();
});
