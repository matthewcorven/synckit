import { test, expect } from '@playwright/test';

const trialId = '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49';

test('dog fields accept input and retain values', async ({ page }) => {
  await page.goto(`/register/${trialId}`);

  const breed = page.getByRole('textbox', { name: 'Breed', exact: true });
  const callName = page.getByRole('textbox', { name: 'Call Name' });
  const dob = page.getByRole('textbox', { name: 'Date of Birth' });
  const ascaReg = page.getByRole('textbox', { name: 'ASCA Registration #' });
  const color = page.getByRole('textbox', { name: 'Color' });
  const sire = page.getByRole('textbox', { name: 'Sire' });
  const dam = page.getByRole('textbox', { name: 'Dam' });
  const breeders = page.getByRole('textbox', { name: 'Breeder(s)' });

  await ascaReg.fill('E-12345');
  await breed.fill('Australian Shepherd');
  await callName.fill('Ranger');
  await dob.fill('4/10/2021');
  await color.fill('Blue Merle');
  await page.getByRole('radio', { name: 'Male', exact: true }).check();
  await sire.fill('Sire Name');
  await dam.fill('Dam Name');
  await breeders.fill('Breeder Name');

  await expect(ascaReg).toHaveValue('E-12345');
  await expect(breed).toHaveValue('Australian Shepherd');
  await expect(callName).toHaveValue('Ranger');
  await expect(dob).toHaveValue(/\d/);
  await expect(color).toHaveValue('Blue Merle');
  await expect(page.getByRole('radio', { name: 'Male', exact: true })).toBeChecked();
  await expect(sire).toHaveValue('Sire Name');
  await expect(dam).toHaveValue('Dam Name');
  await expect(breeders).toHaveValue('Breeder Name');
});

test('required dog fields show inline validation errors', async ({ page }) => {
  await page.goto(`/register/${trialId}`);

  const breed = page.getByRole('textbox', { name: 'Breed', exact: true });
  await breed.focus();
  await page.keyboard.press('Tab');

  await expect(page.getByText('Breed is required.')).toBeVisible();
});
