import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const saved = { window: {} };
vm.runInNewContext(readFileSync('assets/portfolio/rare-errors/data.js', 'utf8'), saved);
const results = saved.window.rareErrorResults;

for (const width of [390, 1366]) {
  test(`saved study remains usable in both themes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/rare-errors.html');
    await page.getByRole('button', { name: /Switch to dark colour theme/ }).click();
    for (const theme of ['dark', 'light']) {
      const toggle = page.getByRole('button', { name: /Switch to .* colour theme/ });
      if (await page.locator('html').getAttribute('data-theme') !== theme)
        await toggle.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      for (const count of [0, 1, 2, 5, 10, 20]) {
        await page.locator(`[data-errors="${count}"]`).click();
        await expect(page.locator(`[data-errors="${count}"]`)).toHaveAttribute('aria-pressed', 'true');
        for (const cell of await page.locator('[data-cell="error"] strong').all()) await expect(cell).toHaveText(String(count));
        for (const cell of await page.locator('[data-cell="correct"] strong').all()) await expect(cell).toHaveText(String(results[count].correct));
        await expect(page.locator('[data-overview="purity"]')).toHaveText(count ? `${(results[count].choice_intended_purity.mean * 100).toFixed(2)}%` : 'No fit');
        await expect(page.locator('#design-state')).toContainText(`design rank ${results[count].rank} of 4`);
      }
      await page.locator('[data-open-diagnostics]').click();
      await expect(page.locator('#seed-diagnostics')).toHaveAttribute('open', '');
      expect(await page.locator('[data-metric="purity"] [data-seed]').count()).toBe(5);
      expect(await page.locator('[data-metric="error"] [data-seed]').count()).toBe(5);
      const settings = await page.locator('#trial-settings').boundingBox();
      const header = await page.locator('.site-header').boundingBox();
      expect(settings.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}

test('MorphBrain reports an empty frame and retry replaces it; closing releases it and restores focus', async ({ page }) => {
  await page.clock.install();
  await page.route('**/demos/morphbrain/assets/*.js', route => route.abort());
  await page.goto('/work.html');
  await page.locator('#select-morphbrain').click();
  const opener = page.locator('#preview-morphbrain [data-launch-demo]').first();
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.demo-dialog__status')).toContainText('Loading the model interface');
  await page.clock.fastForward(16_000);
  await expect(dialog.locator('.demo-dialog__status')).toContainText('taking longer to load');
  await expect(dialog.getByRole('link', { name: 'Open the model full page' })).toHaveAttribute('href', /demos\/morphbrain\//);
  const firstFrame = await dialog.locator('iframe').elementHandle();
  await dialog.getByRole('button', { name: 'Retry', exact: true }).click();
  expect(await firstFrame.evaluate(node => node.isConnected)).toBe(false);
  await firstFrame.evaluate(node => node.dispatchEvent(new Event('error')));
  await expect(dialog.locator('.demo-dialog__status')).toContainText('Loading the model interface');
  await expect(dialog.locator('iframe')).toHaveCount(1);
  await dialog.getByRole('button', { name: /Close/ }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.demo-dialog__mount iframe')).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/demo-is-open/);
});

test('four project choices support keyboard selection, real playback and pause on switching', async ({ page }) => {
  await page.goto('/work.html');
  const brain = page.locator('#select-morphbrain');
  const liner = page.locator('#select-morphliner');
  const morpher = page.locator('#select-model-morpher');
  const fly = page.locator('#select-fly');
  for (const tab of [morpher, liner, fly, brain]) await expect(tab).toHaveAttribute('role', 'tab');
  await brain.focus();
  await brain.press('Home');
  await expect(morpher).toBeFocused();
  await expect(morpher).toHaveAttribute('aria-selected', 'true');
  await morpher.press('End');
  await expect(brain).toBeFocused();
  await expect(brain).toHaveAttribute('aria-selected', 'true');
  await brain.press('ArrowLeft');
  await expect(fly).toBeFocused();
  await expect(page.locator('#preview-fly #fly-preview')).toBeVisible();
  await fly.press('Home');
  await morpher.press('ArrowRight');
  await expect(liner).toHaveAttribute('aria-selected', 'true');
  await expect(liner).toBeFocused();
  await liner.press('Control+Home');
  await expect(liner).toHaveAttribute('aria-selected', 'true');
  const panel = page.locator('#preview-morphliner');
  await panel.getByRole('button', { name: 'Editor', exact: true }).click();
  await expect(panel.locator('[data-morphliner-panel="editor"]')).toBeVisible();
  await panel.getByRole('button', { name: 'Another scene', exact: true }).click();
  await expect(panel.locator('[data-morphliner-panel="render"]')).toBeVisible();
  await panel.getByRole('button', { name: 'Demo', exact: true }).click();
  const video = panel.locator('video');
  await panel.locator('.video-play').click();
  await expect.poll(() => video.evaluate(element => !element.paused)).toBe(true);
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.1);
  await brain.click();
  await expect(page.locator('#preview-morphbrain')).toBeVisible();
  await expect(page.locator('.gallery-panel:not([hidden])')).toHaveCount(1);
  expect(await video.evaluate(element => element.paused)).toBe(true);
});

test('actual MorphBrain interface clears the loading status and supports Escape from its frame', async ({ page }) => {
  await page.goto('/work.html');
  await page.locator('#select-morphbrain').click();
  const panel = page.locator('#preview-morphbrain');
  const comparison = panel.locator('#compare-input');
  await expect(comparison).toBeVisible();
  await comparison.focus();
  await comparison.press('End');
  await expect(comparison).toHaveValue('100');
  await expect.poll(() => panel.locator('.comparison').evaluate(element => element.style.getPropertyValue('--position'))).toBe('100%');
  const opener = panel.locator('[data-launch-demo]').first();
  await expect(opener).toBeVisible();
  await opener.click();
  const frame = page.frameLocator('.demo-dialog iframe');
  await expect(frame.locator('#root')).not.toBeEmpty({ timeout: 20_000 });
  await expect(page.locator('.demo-dialog__status')).toBeHidden({ timeout: 20_000 });
  await frame.locator('body').press('Escape');
  await expect(page.locator('.demo-dialog')).not.toBeVisible();
  await expect(page.locator('.demo-dialog__mount')).toBeEmpty();
});

test('theme persists on secondary pages and nested 404 offers valid recovery routes', async ({ page }) => {
  await page.goto('/third-party-notices.html');
  await page.getByRole('button', { name: /Switch to dark colour theme/ }).click();
  await page.goto('/licenses/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.route('**/missing/deep/path', async route => route.fulfill({ status: 404, contentType: 'text/html', body: readFileSync('404.html', 'utf8') }));
  await page.goto('/missing/deep/path');
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  for (const path of ['/', '/work.html#experience', '/demos/fly/', '/rare-errors.html', '/demos/morphbrain/']) {
    await expect(page.locator(`main a[href="${path}"]`)).toBeVisible();
  }
});
