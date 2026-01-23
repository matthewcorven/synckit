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

    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('jane@email.com')).toBeVisible();

    await page.getByLabel('Trial').click();
    await page.getByRole('option', { name: 'Summer Invitational' }).click();

    await expect(page.getByText('Echo Summerset')).toBeVisible();

    await page.getByRole('link', { name: 'View' }).first().click();
    await expect(page).toHaveURL(/\/secretary\/entries\//);
    await expect(page.locator('mat-card-title', { hasText: 'Entry Detail' })).toBeVisible();

    await page.goto('/secretary');
    await expect(page.getByRole('table')).toBeVisible();
    await page.screenshot({ path: screenshotPath, fullPage: true });
  });
});
