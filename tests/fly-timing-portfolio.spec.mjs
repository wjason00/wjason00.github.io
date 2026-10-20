import { test, expect } from '@playwright/test';

test('timing outcomes lead; selection, input caveats and evidence remain available', async ({ page }) => {
  await page.goto('/demos/fly/timing/');
  await expect(page.locator('#results')).toBeVisible();
  await expect(page.locator('#finding')).toContainText('no consistent direction');
  await expect(page.locator('.limit')).toBeVisible();
  await expect(page.locator('#contrasts tbody tr')).toHaveCount(5);
  expect(await page.locator('#contrasts').evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(await page.locator('#counts').evaluate(el => el.getBoundingClientRect().top));
  await expect(page.locator('details[open]')).toHaveCount(0);
  await expect(page.locator('#input-boundary')).toBeVisible();
  await expect(page.locator('#input-boundary')).toHaveText('Matched scheduled pulses do not guarantee identical applied input pulses or sensory-neuron (GRN) spikes.');
  await page.locator('#template').selectOption('1005');
  await page.locator('#pattern').selectOption('staggered');
  await expect(page.locator('#counts .count-row strong')).toHaveText(['30', '29', '20']);
  await expect(page.locator('#input-boundary')).toBeVisible();
  await page.locator('.input-details > summary').click();
  await expect(page.locator('.input-details .input-warning')).toContainText('not guaranteed applied input');
  await expect(page.locator('#raster')).toBeVisible();
  await page.locator('.methods > summary').click();
  await expect(page.locator('#sources a')).toHaveCount(6);
  await expect(page.getByRole('link', { name: 'Download the results', exact: true })).toBeVisible();
  for (const width of [1366, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('a failed evidence load hides results and offers a visible retry', async ({ page }) => {
  await page.route('**/timing/data.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('/demos/fly/timing/');
  await expect(page.locator('#status')).toContainText('Results could not load');
  await expect(page.locator('#results')).toBeHidden();
  await expect(page.locator('#reload')).toBeVisible();
  await expect(page.locator('#reload')).toHaveText('Try again');
  await expect(page.locator('.limit')).toBeVisible();
});
