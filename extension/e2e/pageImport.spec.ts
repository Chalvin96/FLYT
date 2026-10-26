import {
  expect,
  loginAs,
  resolveSelection,
  selectText,
  test,
  waitForContentScript,
} from './fixtures/extension';

// Playwright cannot click a browser context menu, but the menu handler's only
// job is to send this tab command, and that is unit-tested. What is untested
// anywhere else is the cross-context journey it starts: service worker →
// content script → Readability extraction → back to the worker → the API.
test('a page-import command reaches the API with the session token', async ({
  page,
  context,
  serviceWorker,
}) => {
  await loginAs(context, 'extension-import@example.com');

  // The submit runs in the service worker, so only context-level routing sees
  // it; page.waitForRequest never would.
  let submitted: {
    authorization?: string;
    body: string;
    fromServiceWorker: boolean;
  } | null = null;
  await context.route('**/imports/extension', async (route) => {
    submitted = {
      authorization: route.request().headers()['authorization'],
      body: route.request().postData() ?? '{}',
      fromServiceWorker: route.request().serviceWorker() !== null,
    };
    await route.continue();
  });

  await page.goto('/article.html');
  await waitForContentScript(serviceWorker);

  const importResponse = context.waitForEvent('response', {
    predicate: (response) =>
      new URL(response.url()).pathname === '/imports/extension' &&
      response.request().method() === 'POST',
  });
  await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab!.id!, { kind: 'runImport' });
  });

  // The toast is the content script confirming it received the command.
  await expect(page.getByRole('status')).toBeVisible();

  expect((await importResponse).ok()).toBe(true);
  await expect(page.getByText('Page saved')).toBeVisible();
  await expect(
    page.getByText('We’ll prepare it for reading. You can keep browsing.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'View in Flyt' })).toBeVisible();
  await page.waitForTimeout(5_500);
  await expect(page.getByText('Page saved')).toBeVisible();
  expect(submitted!.authorization).toMatch(/^Bearer /);
  // Proves the worker sent it, not merely that some context hit the URL.
  expect(submitted!.fromServiceWorker).toBe(true);
  const body = JSON.parse(submitted!.body);
  expect(body.source_url).toContain('/article.html');
  expect(body.title).toContain('Klimaendringene');
  expect(body.text).toContain('Isen smelter');
});

// Toast and popup render from one overlay snapshot on one shadow surface, so a
// toast dismissal that leaked into the popup slice would close the lookup.
test('test_import_toast_given_open_popup_expect_dismissal_to_leave_the_popup_intact', async ({
  page,
  context,
  serviceWorker,
}) => {
  await loginAs(context, 'extension-import@example.com');

  await page.goto('/article.html');
  await waitForContentScript(serviceWorker);

  await selectText(page, '#single');
  await resolveSelection(page);
  const dialog = page.getByRole('dialog', { name: 'Definition of bok' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('book', { exact: true })).toBeVisible();
  const popupBefore = await dialog.innerText();

  const importResponse = context.waitForEvent('response', {
    predicate: (response) =>
      new URL(response.url()).pathname === '/imports/extension' &&
      response.request().method() === 'POST',
  });
  await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) {
      throw new Error('Expected an active tab with an ID to run page import');
    }
    await chrome.tabs.sendMessage(tab.id, { kind: 'runImport' });
  });

  expect((await importResponse).ok()).toBe(true);
  await expect(page.getByText('Page saved')).toBeVisible();
  await expect(dialog).toBeVisible();

  await page.getByRole('button', { name: 'Dismiss' }).press('Enter');
  await expect(page.getByText('Page saved')).toBeHidden();
  await expect(dialog).toBeVisible();
  expect(await dialog.innerText()).toBe(popupBefore);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
