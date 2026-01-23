import { test, expect } from '@playwright/test';

const trialId = '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49';

test('emergency contact and fees fields accept input and retain values', async ({ page }) => {
  await page.goto(`/register/${trialId}`);

  const section = page.locator('app-emergency-fees-section');
  const emergencyName = section.getByRole('textbox', { name: /^Name \*/i });
  const emergencyPhone = section.getByRole('textbox', { name: /Phone\/Number \*/i });
  const totalFees = section.getByRole('spinbutton', { name: /Total Entry Fees \*/i });

  await emergencyName.fill('Emergency Contact');
  await emergencyPhone.fill('555-111-2222');
  await totalFees.fill('25');

  await expect(emergencyName).toHaveValue('Emergency Contact');
  await expect(emergencyPhone).toHaveValue('555-111-2222');
  await expect(totalFees).toHaveValue('25');
  await expect(page.getByText('Total: $25.00 USD')).toBeVisible();
});

test('required emergency and fee fields show validation errors', async ({ page }) => {
  await page.goto(`/register/${trialId}`);

  const section = page.locator('app-emergency-fees-section');
  const emergencyName = section.getByRole('textbox', { name: /^Name \*/i });
  const emergencyPhone = section.getByRole('textbox', { name: /Phone\/Number \*/i });
  const totalFees = section.getByRole('spinbutton', { name: /Total Entry Fees \*/i });

  await emergencyName.focus();
  await emergencyName.blur();
  await emergencyPhone.focus();
  await emergencyPhone.blur();
  await totalFees.focus();
  await totalFees.blur();

  await expect(page.getByText('Emergency contact name is required.')).toBeVisible();
  await expect(page.getByText('Emergency contact number is required.')).toBeVisible();
  await expect(page.getByText('Total entry fees are required.')).toBeVisible();
});
