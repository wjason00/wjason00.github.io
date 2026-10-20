import { expect, test } from '@playwright/test';

for (const width of [390, 1366]) {
  test(`advanced keeps parent evidence visible and settings explicit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/demos/fly/');
    const advanced = page.locator('#advanced-toggle');
    await expect(advanced).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#gain')).toBeHidden();
    await expect(page.locator('#seed')).toBeHidden();
    await expect(page.locator('#edge-filter')).toBeHidden();
    await expect(page.locator('#network-graph')).toBeVisible();
    await expect(page.locator('#chart')).toBeVisible();
    await expect(page.locator('#reference-material > summary')).toBeVisible();
    await expect(page.locator('#network-inspection .evidence-limit')).toBeVisible();
    await advanced.press('Enter');
    await expect(advanced).toHaveAttribute('aria-expanded', 'true');
    await page.locator('#gain').selectOption('1.2');
    await page.locator('#seed').selectOption('3');
    const result = await page.locator('#result').textContent();
    await advanced.press('Space');
    await expect(advanced).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#experiment-summary')).toContainText('1.2');
    await expect(page.locator('#experiment-summary')).toContainText(/seed 3/i);
    await expect(page.locator('#result')).toHaveText(result);
    await page.locator('#node-picker').selectOption('720575940618028125');
    await expect(page.locator('#network-inspection .evidence-limit')).toBeVisible();
    await expect(page.locator('#network-inspection .source-id')).toBeHidden();
    if (width > 800) {
      const graph = await page.locator('#network-graph').boundingBox();
      const chart = await page.locator('#chart').boundingBox();
      expect(chart.x).toBeGreaterThan(graph.x + graph.width - 2);
      expect(chart.y).toBeLessThan(graph.y + graph.height);
      expect(chart.width).toBeGreaterThanOrEqual(290);
    }
    await page.getByRole('tab', { name: '3D neurons', exact: true }).click();
    await expect(page.locator('.morphology-stage canvas')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.morphology-picker')).toBeVisible();
    await expect(page.locator('#node-picker')).toBeHidden();
    await expect(page.locator('#chart')).toBeVisible();
    await expect(advanced).toHaveAttribute('aria-expanded', 'false');
    await page.locator('.morphology-picker').selectOption('720575940660219265');
    await expect(page.locator('#network-inspection')).toContainText('MN9');
    await expect(page.locator('#network-inspection .source-id')).toBeHidden();
    await page.locator('.morphology-isolate').check();
    await advanced.click();
    await advanced.click();
    await expect(page.locator('.morphology-isolate')).toBeChecked();
    await page.getByRole('tab', { name: 'Connections', exact: true }).click();
    await expect(page.locator('#gain')).toHaveValue('1.2');
    await expect(page.locator('#seed')).toHaveValue('3');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('UX sheet keeps the release contract readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/demos/fly/ux-sheet.html');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('main')).toContainText('Advanced');
  await expect(page.locator('a[href="https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/"]')).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.close();
});
