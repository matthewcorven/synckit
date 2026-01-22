import { test, expect } from '@playwright/test';

test('app boots and renders the header', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.app-title').first()).toHaveText('Dog Trials');
});

test('trials page renders', async ({ page }) => {
  await page.goto('/trials');
  await expect(page.locator('mat-card-title', { hasText: 'Trials' }).first()).toBeVisible();
});
