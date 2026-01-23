import { test, expect } from '@playwright/test';

const trialId = '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49';

test('contact fields accept input and retain values', async ({ page }) => {
  await page.goto(`/register/${trialId}`);

  const section = page.locator('app-contact-section');
  const owners = section.getByRole('textbox', { name: /Owner\(s\)/i });
  const street = section.getByRole('textbox', { name: 'Street' });
  const city = section.getByRole('textbox', { name: 'City' });
  const state = section.getByRole('combobox', { name: 'State' });
  const zip = section.getByRole('textbox', { name: 'ZIP' });
  const email = section.getByRole('textbox', { name: /Email/i });
  const phone = section.getByRole('textbox', { name: /^Phone \*/i });
  const handler = section.getByRole('textbox', { name: /Handler \(if different from owner\)/i });
  const membership = section.getByRole('textbox', { name: 'Membership Number' });
  const juniorDob = section.getByRole('textbox', { name: 'Junior DOB' });
  const juniorMember = section.getByRole('textbox', { name: 'Junior Member ID' });

  await owners.fill('Owner One; Owner Two');
  await street.fill('123 Main St');
  await city.fill('Bryan');
  await state.click();
  await page.getByRole('option', { name: /TX — Texas/ }).click();
  await zip.fill('77801');
  await email.fill('handler@example.com');
  await phone.fill('555-555-5555');
  await handler.fill('Handler Name');
  await membership.fill('ASCA-1234');
  await juniorDob.fill('7/15/2012');
  await juniorMember.fill('JR-999');

  await expect(owners).toHaveValue('Owner One; Owner Two');
  await expect(street).toHaveValue('123 Main St');
  await expect(city).toHaveValue('Bryan');
  await expect(state).toHaveText(/TX/);
  await expect(zip).toHaveValue('77801');
  await expect(email).toHaveValue('handler@example.com');
  await expect(phone).toHaveValue('555-555-5555');
  await expect(handler).toHaveValue('Handler Name');
  await expect(membership).toHaveValue('ASCA-1234');
  await expect(juniorDob).toHaveValue(/\d/);
  await expect(juniorMember).toHaveValue('JR-999');
});

test('invalid email shows validation error', async ({ page }) => {
  await page.goto(`/register/${trialId}`);

  const email = page.getByRole('textbox', { name: /Email/i });
  await email.fill('not-an-email');
  await email.blur();

  await expect(page.getByText('Enter a valid email.')).toBeVisible();
});
