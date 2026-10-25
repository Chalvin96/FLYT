import { expect, test } from './fixtures';
import { loginAs } from './helpers/auth';

test('test_chatgpt_ui_given_unlinked_account_expect_connect_action', async ({
  page,
}) => {
  await loginAs(page, 'chatgpt-hidden@example.com');
  const linkResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/chatgpt/link' &&
      response.request().method() === 'GET',
  );
  await page.goto('/account');
  expect((await linkResponse).ok()).toBe(true);

  await expect(
    page.getByRole('heading', { name: 'ChatGPT', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Connect', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText('Not connected', { exact: true }).first(),
  ).toBeVisible();
});
