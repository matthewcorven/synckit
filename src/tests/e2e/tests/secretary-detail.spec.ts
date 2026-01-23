import { test, expect } from '@playwright/test';
import path from 'path';

const roleStorageKey = 'dog-trials.role';

const screenshotPath = path.resolve(
  __dirname,
  '../../../../artifacts/WI-A13/playwright/secretary-detail-screenshot.png'
);

test.describe('secretary detail', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'Secretary');
    }, roleStorageKey);
  });

  test('secretary views detail and downloads pdf', async ({ page }) => {
    await page.goto('/secretary/entries/d7b99d91-2c6a-4fd0-9d4f-7c49d88c7b10');

    await expect(page.getByText('Entry Detail')).toBeVisible();
    await expect(page.getByText('Ranger Blue Sky')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PDF' }).click();
    await downloadPromise;

    await page.screenshot({ path: screenshotPath, fullPage: true });
  });

  test('retry pdf appears for failed status', async ({ page }) => {
    await page.goto('/secretary/entries/3f3d9c9c-8f62-4cc4-a5a1-45e284f5f8a8');

    await expect(page.getByRole('button', { name: 'Retry PDF' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry PDF' }).click();
    await expect(page.getByText('PDF Queued')).toBeVisible();
  });
});
