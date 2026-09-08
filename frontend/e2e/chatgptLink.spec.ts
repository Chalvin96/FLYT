import { expect, test } from '@playwright/test';

import { loginAs } from './helpers/auth';

test('test_chatgpt_ui_given_account_page_expect_hidden', async ({ page }) => {
  let chatGPTRequestCount = 0;
  await page.route('**/chatgpt/link**', async (route) => {
    chatGPTRequestCount += 1;
    await route.abort();
  });

  await loginAs(page, 'chatgpt-hidden@example.com');
  await page.goto('/account');

  await expect(page.getByText('ChatGPT', { exact: true })).toHaveCount(0);
  expect(chatGPTRequestCount).toBe(0);
});
