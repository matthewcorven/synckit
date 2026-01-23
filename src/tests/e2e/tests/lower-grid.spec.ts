import { test, expect } from '@playwright/test';

const trialId = '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49';

test('lower grid selections toggle and disabled cells block', async ({ page }) => {
  await page.goto(`/register/${trialId}`);

  const sheepNov = page.getByRole('button', { name: 'Sheep NOV' });
  const ducksPost = page.getByRole('button', { name: 'Ducks POST ADV' });

  await expect(ducksPost).toBeDisabled();

  await sheepNov.click();
  await expect(sheepNov).toHaveText(/X/);

  await sheepNov.click();
  await expect(sheepNov).not.toHaveText(/X/);
});

test('upper and lower grids can be selected together', async ({ page }) => {
  await page.goto(`/register/${trialId}`);

  const upperSheepStd = page.getByRole('button', { name: 'Sheep STD' });
  const lowerSheepFEO = page.getByRole('button', { name: 'Sheep FEO' });

  await upperSheepStd.click();
  await lowerSheepFEO.click();

  await expect(upperSheepStd).toHaveText(/X/);
  await expect(lowerSheepFEO).toHaveText(/X/);

  await page.screenshot({
    path: '../../artifacts/WI-A08/playwright/lower-grid-screenshot.png',
    fullPage: true
  });
});
