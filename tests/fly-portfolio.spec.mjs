import { expect, test } from '@playwright/test';

for (const width of [390, 1366]) {
  test(`fly explorer separates archives and preserves neuron identity at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/demos/fly/');
    const body = page.locator('#body-frame');
    await expect(body).not.toHaveAttribute('src');
    await page.locator('#node-picker').selectOption('720575940618028125');
    await expect(page.locator('#network-inspection')).toContainText('Buddy is a source cell-type label');
    await expect(page.locator('#network-inspection')).toContainText('not verified');
    await page.getByRole('tab', { name: '3D fly', exact: true }).click();
    await page.getByRole('tab', { name: '3D fly', exact: true }).press('Control+Home');
    await expect(page.getByRole('tab', { name: '3D fly', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#paired-controls')).toBeHidden();
    await expect(page.locator('#paired-output')).toBeHidden();
    await expect(page.locator('.framing')).toBeHidden();
    await expect(body).toHaveAttribute('src', 'body/index.html');
    await expect(page.locator('#view-description')).toContainText('separate saved author archive');
    await page.getByRole('tab', { name: 'Connections', exact: true }).click();
    await expect(page.locator('#paired-controls')).toBeVisible();
    await expect(page.locator('.framing')).toBeVisible();
    await expect(page.locator('#node-picker')).toHaveValue('720575940618028125');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });

  test(`body replay keeps controls contextual and uses one scroll area at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/demos/fly/');
    await page.getByRole('tab', { name: '3D fly', exact: true }).click();
    const frame = page.frameLocator('#body-frame');
    await expect(frame.locator('html')).toHaveAttribute('data-loading', 'false', { timeout: 20000 });
    await expect(page.locator('#body-status')).toBeHidden();
    const scene = frame.locator('#scene');
    const transport = frame.locator('.transport');
    expect((await transport.boundingBox()).y).toBeGreaterThanOrEqual((await scene.boundingBox()).y + (await scene.boundingBox()).height - 1);
    await expect(frame.locator('.run-settings')).toBeVisible();
    const fitsFrame = async () => frame.locator('main').evaluate(main => {
      const size = main.getBoundingClientRect();
      return Math.abs(window.innerHeight - Math.ceil(size.height)) <= 2 && document.documentElement.scrollWidth <= window.innerWidth;
    });
    await expect.poll(fitsFrame).toBe(true);
    await frame.locator('#neural-details > summary').click();
    await expect(frame.locator('#raster')).toBeVisible();
    await expect.poll(fitsFrame).toBe(true);
    await frame.locator('#neural-details > summary').click();
    await expect.poll(fitsFrame).toBe(true);
    await frame.getByRole('button', { name: 'Compare runs', exact: true }).click();
    await expect(scene).toHaveAttribute('data-compare', 'true');
    await expect(frame.locator('#pairing-note')).toBeVisible();
    await expect.poll(fitsFrame).toBe(true);
    await frame.getByRole('button', { name: 'Single fly', exact: true }).click();
    await expect(scene).toHaveAttribute('data-compare', 'false');
    await expect.poll(fitsFrame).toBe(true);
    await frame.locator('#movement-details > summary').click();
    await frame.locator('#block-mn9').check();
    await frame.locator('#movement-details > summary').click();
    await expect(frame.locator('#active-blocks')).toBeVisible();
    await expect(frame.locator('#active-block-status')).toContainText('MN9 drive blocked');
    await frame.locator('#trial').selectOption({ index: 1 });
    await expect(frame.locator('#active-blocks')).toBeVisible();
    await expect(frame.locator('#clip-time')).toContainText('-400.0');
    await frame.getByRole('button', { name: 'Clear drive blocks', exact: true }).click();
    await expect(frame.locator('#active-blocks')).toBeHidden();
    await expect(frame.locator('#block-mn9')).not.toBeChecked();
    await expect.poll(fitsFrame).toBe(true);
    await page.getByRole('tab', { name: 'Connections', exact: true }).click();
    await page.getByRole('tab', { name: '3D fly', exact: true }).click();
    await expect.poll(fitsFrame).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
}
