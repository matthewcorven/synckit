import { test, expect } from '@playwright/test';
import path from 'path';

const roleStorageKey = 'dog-trials.role';

const screenshotPath = path.resolve(
  __dirname,
  '../../../../artifacts/WI-A12/playwright/secretary-list-screenshot.png'
);

test.describe('secretary list', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((key) => {
      localStorage.setItem(key, 'Secretary');
    }, roleStorageKey);
  });

  test('secretary views entries list and navigates to detail', async ({ page }) => {
    await page.goto('/secretary');

    // Wait for entries table to be visible
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('jane@email.com')).toBeVisible();

    // Click View on first entry (Ranger - has mock detail data)
    await page.getByRole('link', { name: 'View' }).first().click();
    await expect(page).toHaveURL(/\/secretary\/entries\//);

    // Wait for detail page to load and check for Entry Detail heading
    await expect(page.locator('mat-card-title').filter({ hasText: 'Entry Detail' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Ranger Blue Sky')).toBeVisible();

    // Navigate back to secretary list
    await page.goto('/secretary');
    await expect(page.getByRole('table')).toBeVisible();

    // Test trial dropdown filter
    await page.getByLabel('Trial').click();
    await page.getByRole('option', { name: 'Fall Championship 2026' }).click();
    await expect(page.getByText('Echo Summerset')).toBeVisible();

    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
