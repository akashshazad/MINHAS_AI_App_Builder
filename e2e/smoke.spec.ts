
import { test, expect } from '@playwright/test';

test('API health and Expo web shell', async ({ page, request }) => {
  const apiURL = process.env.E2E_API_URL || 'http://127.0.0.1:3000';
  const health = await request.get(`${apiURL}/api/health`);
  expect(health.ok()).toBeTruthy();
  await page.goto(process.env.E2E_BASE_URL || 'http://127.0.0.1:8081', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('body')).toBeVisible();
});


