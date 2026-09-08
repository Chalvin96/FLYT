import {
  expect,
  API_URL,
  loginAs,
  lookupIcon as icon,
  selectText,
  test,
  waitForContentScript,
} from './fixtures/extension';

test.beforeEach(async ({ page, serviceWorker }) => {
  await page.goto('/article.html');
  await waitForContentScript(serviceWorker);
});

test('selecting a word mounts a styled affordance beside it and opens the popup', async ({
  page,
}) => {
  await selectText(page, '#single');

  await expect(icon(page)).toBeVisible();
  const wordBox = await page.locator('#single').boundingBox();
  const iconBox = await icon(page).boundingBox();
  // Beside the selection, not covering it.
  expect(iconBox!.x).toBeGreaterThan(wordBox!.x);
  expect(iconBox!.y).toBeGreaterThan(wordBox!.y);
  // The shadow stylesheet resolved: an unstyled button would not be 28px.
  expect(iconBox!.width).toBeGreaterThanOrEqual(24);
  expect(iconBox!.height).toBeGreaterThanOrEqual(24);

  // A mousedown outside a selection collapses it. Without the button's
  // preventDefault the range would be gone before the click handler ran, and
  // the popup would have nothing to resolve or position against.
  await icon(page).click();

  await expect(icon(page)).toBeHidden();
  await expect(
    page.getByRole('button', { name: 'Add to review' }).first(),
  ).toBeVisible();
});

test('a selection against the viewport floor flips the affordance above it', async ({
  page,
}) => {
  // Real layout, real viewport height — the unit test can only assert the
  // arithmetic against a synthetic rect.
  await selectText(page, '#near-bottom');

  await expect(icon(page)).toBeVisible();
  const wordBox = await page.locator('#near-bottom').boundingBox();
  const iconBox = await icon(page).boundingBox();
  expect(iconBox!.y).toBeLessThan(wordBox!.y);
});

test('selecting inside a textarea offers nothing', async ({ page }) => {
  // A textarea's selection never reaches the document Selection, so this is a
  // browser behavior jsdom only approximates.
  await page.locator('#notes').selectText();

  await expect(icon(page)).toBeHidden();
});

test('test_sentence_selection_given_authenticated_learner_expect_translation_and_contextual_lookup', async ({
  page,
  context,
  serviceWorker,
}) => {
  await loginAs(context, 'extension-sentence@example.com');
  let translationAuthorization: string | undefined;
  await context.route('**/extension/translate', async (route) => {
    translationAuthorization = route.request().headers().authorization;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        source_text: 'Jeg leser en bok hver dag.',
        translated_text: 'I read a book every day.',
        source_language: 'no',
        target_language: 'en',
      }),
    });
  });

  await selectText(page, '#sentence');
  await expect(
    page.getByRole('dialog', { name: 'Translate selected text' }),
  ).toBeHidden();
  await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id === undefined) throw new Error('active tab is unavailable');
    await chrome.tabs.sendMessage(tab.id, {
      kind: 'showTranslation',
      text: 'Jeg leser en bok hver dag.',
    });
  });

  const dialog = page.getByRole('dialog', { name: 'Translate selected text' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Jeg leser en bok hver dag.')).toBeVisible();
  await expect(dialog.getByText('I read a book every day.')).toBeVisible();
  expect(translationAuthorization).toMatch(/^Bearer /);

  await page.locator('.flyt-source-word').filter({ hasText: 'bok' }).click();
  await expect(
    page.getByRole('button', { name: 'Add to review' }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Add to review' }).first().click();
  await expect(
    page.getByRole('button', { name: /Added/ }).first(),
  ).toBeVisible();

  const dueResponse = await context.request.get(`${API_URL}/me/cards/due`);
  expect(dueResponse.ok()).toBeTruthy();
  expect(JSON.stringify(await dueResponse.json())).toContain(
    'Jeg leser en bok hver dag.',
  );
  await waitForContentScript(serviceWorker);
});

test('test_single_word_action_given_authenticated_learner_expect_dictionary_without_translation_and_contextual_save', async ({
  page,
  context,
  serviceWorker,
}) => {
  await loginAs(context, 'extension-word-action@example.com');
  let translationRequests = 0;
  await context.route('**/extension/translate', async (route) => {
    translationRequests += 1;
    await route.abort();
  });

  await page.evaluate(() => {
    const node = document.querySelector('#sentence')?.firstChild;
    if (!node?.textContent) throw new Error('sentence text is unavailable');
    const start = node.textContent.indexOf('bok');
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + 3);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id === undefined) throw new Error('active tab is unavailable');
    await chrome.tabs.sendMessage(tab.id, {
      kind: 'showFor',
      word: 'bok',
    });
  });

  const dialog = page.getByRole('dialog', { name: 'Definition of bok' });
  await expect(dialog).toBeVisible();
  expect(translationRequests).toBe(0);
  await dialog.getByRole('button', { name: 'Add to review' }).first().click();
  await expect(
    dialog.getByRole('button', { name: /Added/ }).first(),
  ).toBeVisible();

  const dueResponse = await context.request.get(`${API_URL}/me/cards/due`);
  expect(dueResponse.ok()).toBeTruthy();
  expect(JSON.stringify(await dueResponse.json())).toContain(
    'Jeg leser en bok hver dag.',
  );
});
