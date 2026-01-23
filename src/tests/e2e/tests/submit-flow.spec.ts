import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const trialId = '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49';
const artifactsDir = path.resolve(__dirname, '../../../../artifacts/WI-A11/playwright');
const telemetryDir = path.resolve(__dirname, '../../../../artifacts/WI-A11/telemetry');

test.use({ trace: 'off' });

test('submit flow shows confirmation with support ID', async ({ page }) => {
  await page.context().tracing.start({ screenshots: true, snapshots: true });
  await page.goto(`/register/${trialId}`);

  await page.getByRole('textbox', { name: /^Breed$/ }).fill('Australian Shepherd');
  await page.getByLabel('Call Name').fill('Ranger');
  await page.getByLabel('Date of Birth').fill('04/10/2021');
  await page.locator('mat-radio-button[value="Male"]').click();

  await page.getByLabel('Owner(s) *').fill('Jane Handler');
  await page.getByLabel('Email *').fill('handler@example.com');
  await page.getByLabel('Phone *').fill('555-555-5555');

  await page.getByLabel('Name *').fill('Emergency Contact');
  await page.getByLabel('Phone/Number *').fill('555-111-2222');
  await page.getByLabel('Total Entry Fees *').fill('25');

  await page.getByRole('button', { name: 'Sheep STD' }).click();

  await page.getByRole('button', { name: /review terms/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /accept/i }).click();

  await page.getByRole('button', { name: /submit entry/i }).click();

  await expect(page.getByText('Entry Submitted')).toBeVisible();
  const supportId = page.getByTestId('support-id');
  await expect(supportId).toBeVisible();

  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.mkdirSync(telemetryDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactsDir, 'submit-confirmation.png'),
    fullPage: true
  });

  await page.screenshot({
    path: path.join(telemetryDir, 'support-id-verification.png'),
    fullPage: true
  });

  await page.context().tracing.stop({
    path: path.join(artifactsDir, 'submit-success-trace.zip')
  });
});

test('submit error displays support ID and message', async ({ page }) => {
  await page.goto(`/register/${trialId}?submitError=true`);

  await page.getByRole('textbox', { name: /^Breed$/ }).fill('Australian Shepherd');
  await page.getByLabel('Call Name').fill('Ranger');
  await page.getByLabel('Date of Birth').fill('04/10/2021');
  await page.locator('mat-radio-button[value="Male"]').click();

  await page.getByLabel('Owner(s) *').fill('Jane Handler');
  await page.getByLabel('Email *').fill('handler@example.com');
  await page.getByLabel('Phone *').fill('555-555-5555');

  await page.getByLabel('Name *').fill('Emergency Contact');
  await page.getByLabel('Phone/Number *').fill('555-111-2222');
  await page.getByLabel('Total Entry Fees *').fill('25');

  await page.getByRole('button', { name: 'Sheep STD' }).click();

  await page.getByRole('button', { name: /review terms/i }).click();
  await page.getByRole('dialog').getByRole('button', { name: /accept/i }).click();

  await page.getByRole('button', { name: /submit entry/i }).click();

  await expect(page.getByText('Submission failed')).toBeVisible();
  await expect(page.getByTestId('submit-support-id')).toBeVisible();

  fs.mkdirSync(artifactsDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactsDir, 'submit-error.png'),
    fullPage: true
  });
});
