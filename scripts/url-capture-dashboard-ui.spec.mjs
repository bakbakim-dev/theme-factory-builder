import { test, expect } from '@playwright/test';

test('Static Site mode exposes Certified URL capture controls', async ({ page }) => {
  await page.goto('http://127.0.0.1:5174/', { waitUntil: 'networkidle' });

  await page.getByRole('button', { name: /Static Site/i }).click();

  await expect(page.getByText('Public React URL (Certified Capture)')).toBeVisible();
  await page.getByRole('radio', { name: /Public React URL \(Certified Capture\)/i }).check();
  await expect(page.getByLabel(/Public URL/i)).toBeVisible();
  await expect(page.getByLabel(/Optional sitemap URL/i)).toBeVisible();
  await expect(page.getByText('Certification Status')).toBeVisible();
});
