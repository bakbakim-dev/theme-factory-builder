import { test, expect } from '@playwright/test';

test('dashboard loads without runtime error and shows output mode options', async ({ page }) => {
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://127.0.0.1:5174/';

  await page.goto(dashboardUrl, { waitUntil: 'networkidle' });

  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('Output Mode', { exact: true })).toBeVisible();
  await expect(page.getByText('Static Site', { exact: true })).toBeVisible();
  await expect(page.getByText('WordPress / Platinum', { exact: true })).toBeVisible();
});
