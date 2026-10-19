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
    await expect(page.locator('#paired-controls')).toBeHidden();
    await expect(page.locator('#paired-output')).toBeHidden();
    await expect(body).toHaveAttribute('src', 'body/index.html');
    await expect(page.locator('#view-description')).toContainText('separate saved author archive');
    await page.getByRole('tab', { name: 'Connections', exact: true }).click();
    await expect(page.locator('#paired-controls')).toBeVisible();
    await expect(page.locator('#node-picker')).toHaveValue('720575940618028125');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });
}
