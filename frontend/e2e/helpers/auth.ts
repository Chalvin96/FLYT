import { expect, type Page } from '@playwright/test';

const apiUrl = process.env.FLYT_E2E_API_URL ?? 'http://127.0.0.1:18000';

export async function loginAs(page: Page, email: string): Promise<void> {
  const response = await page.request.post(`${apiUrl}/test/login`, {
    data: { email },
  });

  expect(response.ok()).toBeTruthy();
}
