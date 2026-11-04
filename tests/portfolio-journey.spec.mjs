import { expect, test } from '@playwright/test';

const ready = page => page.waitForFunction(() => document.documentElement.dataset.journey === 'ready');

for (const viewport of [{ width: 360, height: 800 }, { width: 1280, height: 640 }]) {
  test(`each scientific stage keeps its limit beside the visual at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await ready(page);
    for (const id of ['work-model-morpher', 'work-g27', 'work-morphbrain']) {
      const inStage = page.locator(`#${id} .jr-pin .jr-limit`);
      await expect(inStage).toHaveCount(1);
      const inSheet = page.locator(`#${id} .jr-sheet .portal-limit`).first();
      expect(await inStage.textContent()).toBe(await inSheet.textContent());
      await page.locator(`#${id}`).evaluate(node => window.scrollTo(0, node.offsetTop));
      await expect(inStage).toBeInViewport();
    }
    await expect(page.locator('#work-fly .jr-pin .fly-limit')).toHaveCount(1);
  });
}

test('Skip moves to the details and Back returns to the stage', async ({ page }) => {
  await page.goto('/#work-g27');
  await ready(page);
  await page.locator('.jr-eeg .jr-skip').click();
  await expect(page).toHaveURL(/#sheet-eeg$/);
  await expect(page.locator('#sheet-eeg')).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/#work-g27$/);
});

test('the chapter bar stays reachable by keyboard from the top of the page', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.locator('.portal-wayfinder a').first().focus();
  await expect(page.locator('.jr-way')).toHaveCSS('opacity', '1');
});

test('reduced motion keeps the published page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#portal-morpher-title')).toBeVisible();
  await expect(page.locator('html')).not.toHaveClass(/has-journey/);
  await expect(page.locator('.jr-stage')).toHaveCount(0);
});

test('a failed motion library leaves the published page', async ({ page }) => {
  await page.route('**/ScrollTrigger.min.js', route => route.abort());
  await page.goto('/');
  await page.waitForFunction(() => document.documentElement.dataset.journey === 'failed');
  await expect(page.locator('html')).not.toHaveClass(/has-journey/);
  await expect(page.locator('.jr-stage')).toHaveCount(0);
  await expect(page.locator('#portal-morpher-title')).toBeVisible();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the published page stands', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#portal-morpher-title')).toBeVisible();
    await expect(page.locator('.jr-stage')).toHaveCount(0);
  });
});
