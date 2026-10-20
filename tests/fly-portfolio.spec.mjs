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
    await expect(body).toHaveAttribute('src', /^body\/index\.html\?v=/);
    await expect(page.locator('#view-description')).toContainText('separate saved author archive');
    await page.getByRole('tab', { name: 'Connections', exact: true }).click();
    await expect(page.locator('#paired-controls')).toBeVisible();
    await expect(page.locator('.framing')).toBeHidden();
    await expect(page.locator('#node-picker')).toHaveValue('720575940618028125');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  });

  test(`body replay keeps controls contextual and uses one scroll area at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/demos/fly/#body');
    await expect(page.getByRole('tab', { name: '3D fly', exact: true })).toHaveAttribute('aria-selected', 'true');
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
    await expect(frame.locator('#raster')).toBeVisible();
    const advanced = frame.locator('#body-advanced-toggle');
    await expect(advanced).toHaveAttribute('aria-expanded', 'false');
    await expect(frame.locator('#input-cue')).toBeHidden();
    await expect(frame.locator('#trial')).toBeHidden();
    await expect(frame.locator('#speed')).toBeHidden();
    await expect(frame.locator('#next-motor-event')).toBeHidden();
    await expect(frame.locator('#body-run-summary')).toBeVisible();
    await expect(frame.locator('select:visible')).toHaveCount(2);
    const signal = await frame.locator('#neural-details').boundingBox();
    const specimen = await scene.boundingBox();
    if (width > 800) {
      expect(signal.x).toBeGreaterThan(specimen.x + specimen.width);
      expect(Math.abs(signal.y - specimen.y)).toBeLessThan(80);
      expect(signal.width).toBeGreaterThan(360);
    } else {
      expect(signal.y).toBeGreaterThan(specimen.y);
      expect(specimen.y).toBeLessThan(844);
    }
    const raster = frame.locator('#raster');
    expect((await raster.boundingBox()).width).toBeGreaterThan(width > 800 ? 340 : 270);
    expect(await raster.evaluate(canvas => canvas.width > 0 && canvas.height > 0)).toBe(true);
    if (process.env.FLY_REVIEW_CAPTURE) {
      await page.screenshot({ path: `output/fly-ux-20261020/basic-${width}.png`, fullPage: width < 800 });
    }
    await frame.locator('#play').click();
    await expect(frame.locator('#play')).toHaveText('Pause');
    await advanced.click();
    await advanced.click();
    await expect(frame.locator('#play')).toHaveText('Pause');
    await frame.locator('#reset').click();
    await advanced.click();
    await expect(advanced).toHaveAttribute('aria-expanded', 'true');
    await frame.locator('#next-motor-event').click();
    await expect(frame.locator('#clip-time')).not.toContainText('-400.0');
    await expect(frame.locator('#play')).toHaveText('Continue');
    await expect(frame.locator('#mn9-cue-0')).toBeVisible();
    await expect.poll(fitsFrame).toBe(true);
    const steppedTime = await frame.locator('#clip-time').textContent();
    await advanced.click();
    await expect(frame.locator('#next-motor-event')).toBeHidden();
    await expect(frame.locator('#clip-time')).toHaveText(steppedTime);
    await expect(raster).toBeVisible();
    await advanced.click();
    await frame.getByRole('button', { name: 'Compare runs', exact: true }).click();
    await expect(scene).toHaveAttribute('data-compare', 'true');
    await expect(frame.locator('#pairing-note')).toBeVisible();
    await expect(raster).toBeVisible();
    expect((await raster.boundingBox()).height).toBe(244);
    await advanced.click();
    await expect(frame.locator('#pairing-note')).toBeVisible();
    await expect(frame.locator('#body-run-summary')).toContainText(/compar|intact/i);
    await expect.poll(fitsFrame).toBe(true);
    await advanced.click();
    await frame.getByRole('button', { name: 'Single fly', exact: true }).click();
    await expect(scene).toHaveAttribute('data-compare', 'false');
    await expect.poll(fitsFrame).toBe(true);
    await frame.locator('#block-mn9').check();
    await advanced.click();
    await expect(frame.locator('#active-blocks')).toBeVisible();
    await expect(frame.locator('#active-block-status')).toContainText('MN9 drive blocked');
    await advanced.click();
    await frame.locator('#trial').selectOption({ index: 1 });
    await frame.locator('#speed').selectOption('0.5');
    await frame.locator('#repeat').check();
    await advanced.click();
    await expect(frame.locator('#body-run-summary')).toContainText(/trial 2/i);
    await expect(frame.locator('#body-run-summary')).toContainText(/½|0.5|half/i);
    await expect(frame.locator('#body-run-summary')).toContainText(/cycl/i);
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
