import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const trialId = '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49';
const artifactsDir = path.resolve(__dirname, '../../../../artifacts/WI-A10/playwright');

test.use({ trace: 'off' });

test('terms modal flow captures acceptance', async ({ page }) => {
  await page.context().tracing.start({ screenshots: true, snapshots: true });
  await page.goto(`/register/${trialId}`);

  await page.getByRole('button', { name: /review terms/i }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.terms-modal__title')).toBeVisible();

  await dialog.getByRole('button', { name: /accept/i }).click();

  const checkbox = page.getByRole('checkbox', { name: /I have read and accept the terms/i });
  await expect(checkbox).toBeChecked();

  const submitButton = page.getByRole('button', { name: /submit/i });
  await expect(submitButton).toBeEnabled();

  fs.mkdirSync(artifactsDir, { recursive: true });

  await page.screenshot({
    path: path.join(artifactsDir, 'terms-modal-screenshot.png'),
    fullPage: true
  });

  await page.context().tracing.stop({
    path: path.join(artifactsDir, 'terms-modal-trace.zip')
  });
});
