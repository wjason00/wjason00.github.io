import { expect, test } from '@playwright/test';

for (const width of [1366, 390]) {
  test(`opening introduces the actual research without a full-screen hero at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const question = page.locator('.fly-project-heading p');
    await expect(question).toBeInViewport();
    const network = await page.locator('.fly-circuit img').boundingBox();
    expect(network.y).toBeLessThan(width < 800 ? 844 : 900);
    await expect(page.locator('.fly-circuit figcaption')).toContainText('This is wiring, not activity flow.');
    await expect(page.locator('#fly-preview')).not.toHaveAttribute('autoplay');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('reduced motion keeps selected software and scientific evidence fully present', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const tab = page.locator('#select-morphbrain');
  await tab.scrollIntoViewIfNeeded(); await tab.focus(); await tab.press('ArrowRight');
  const panel = page.locator('#preview-model-morpher');
  await expect(page.locator('#select-model-morpher')).toBeFocused();
  await expect(panel).toBeVisible();
  await expect(panel.locator('#model-morpher')).toBeVisible();
  const visual = panel.locator('.project-gallery__visual');
  expect(await visual.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').length)).toBe(0);
  await page.locator('.fly-circuit img').scrollIntoViewIfNeeded();
  await expect(page.locator('.fly-circuit img')).toBeVisible();
  expect(await page.locator('#fly-visuals').evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
});
