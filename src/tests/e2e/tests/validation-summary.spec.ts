import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const trialId = '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49';

test('validation summary shows errors and scrolls to fields', async ({ page }) => {
  await page.goto(`/register/${trialId}`);

  await page.getByRole('button', { name: /review for errors/i }).click();

  const summary = page.getByText('Validation summary');
  await expect(summary).toBeVisible();

  const artifactsDir = path.resolve(
    __dirname,
    '../../../../artifacts/WI-A09/playwright'
  );
  fs.mkdirSync(artifactsDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactsDir, 'validation-error-state.png'),
    fullPage: true
  });

  const callNameError = page.getByRole('button', { name: /Call Name is required/i });
  await callNameError.click();

  const callNameInput = page.locator('[data-control-path="dog.callName"]');
  await expect(callNameInput).toBeFocused();

  await callNameInput.fill('Ranger');

  await expect(page.getByText('Call Name is required.')).toBeHidden();
});
