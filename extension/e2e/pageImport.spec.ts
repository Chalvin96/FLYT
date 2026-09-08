import { expect, loginAs, test, waitForContentScript } from './fixtures/extension';

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

  await serviceWorker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.tabs.sendMessage(tab!.id!, { kind: 'runImport' });
  });

  // The toast is the content script confirming it received the command.
  await expect(page.getByRole('status')).toBeVisible();

  await expect.poll(() => submitted, { timeout: 15_000 }).not.toBeNull();
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
