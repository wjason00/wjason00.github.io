import { expect, test } from '@playwright/test';

for (const width of [1366, 390, 320]) {
  test(`portfolio opening keeps identity, large native routes and research discoverable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 });
    await page.goto('/');
    const artwork = page.locator('.opening-art img');
    await artwork.evaluate(image => image.decode());
    await expect(page.locator('#intro-title')).toBeInViewport();
    await expect(artwork).toBeVisible();
    await expect(artwork).toHaveAttribute('alt', '');
    await expect(page.locator('.opening-art')).toHaveAttribute('aria-hidden', 'true');
    const routes = page.getByRole('navigation', { name: 'Explore my work' });
    for (const label of ['Research', 'Software', 'About']) {
      await expect(routes.getByRole('link', { name: label, exact: true })).toBeInViewport();
    }
    await expect(page.locator('#fly-study-details')).not.toHaveAttribute('open');
    const workTop = await page.locator('#selected-work').evaluate(element => element.getBoundingClientRect().top);
    expect(workTop).toBeLessThan(width < 800 ? 700 : 600);
    const research = routes.getByRole('link', { name: 'Research', exact: true });
    await research.focus();
    await research.press('Enter');
    await expect(page.getByRole('heading', { name: 'Selected research', exact: true })).toBeInViewport();
    const selected = page.locator('.work-index__item').first();
    await expect(selected.locator('a.gallery-action')).toHaveAttribute('href', '#morphbrain');
    await expect(selected.locator('.gallery-limit')).toBeVisible();
    await selected.locator('a.gallery-action').click();
    await expect(page.locator('#preview-morphbrain')).toBeVisible();
    await expect(page.locator('#morphbrain .project__lede')).toBeInViewport();
    await expect(page.locator('#g27 a.gallery-action')).toHaveAttribute('href', /^https:\/\/docs\.google\.com\/presentation\/d\/.+\/present$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('reduced motion preserves the static decoration and complete selected software', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#selected-work').scrollIntoViewIfNeeded();
  expect(await page.locator('.opening-art img').evaluate(element => getComputedStyle(element).transform)).toBe('none');
  const tab = page.locator('#select-morphbrain');
  await tab.scrollIntoViewIfNeeded(); await tab.focus(); await tab.press('ArrowRight');
  const panel = page.locator('#preview-model-morpher');
  await expect(page.locator('#select-model-morpher')).toBeFocused();
  await expect(panel).toBeVisible();
  await expect(panel.locator('#model-morpher')).toBeVisible();
});

test('native study disclosure reveals figures without JavaScript', async ({ browser }) => {
  // Isolate native access from smooth-scroll animation when traversing anchors.
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: 'reduce' });
  const page = await context.newPage(); await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('.opening-art img')).toBeVisible();
  await page.getByRole('navigation', { name: 'Explore my work' }).getByRole('link', { name: 'Research', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Selected research', exact: true })).toBeInViewport();
  const summary = page.locator('#fly-study-details > summary');
  await summary.scrollIntoViewIfNeeded(); await summary.focus(); await summary.press('Enter');
  await expect(page.locator('.fly-comparison img')).toBeVisible();
  await expect(page.locator('#fly-preview')).toHaveAttribute('controls', '');
  await context.close();
});

test('legacy scientific hashes reveal the corresponding complete native account', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [hash, disclosure] of [['fly-visuals', 'fly-study-details'], ['fly-strength-study', 'fly-study-details'], ['fly-timing-title', 'fly-study-details'], ['dpca', 'signal-study-details']]) {
    await page.goto(`/#${hash}`);
    await expect(page.locator(`#${disclosure}`)).toHaveAttribute('open', '');
    await expect(page.locator(`#${hash}`)).toBeInViewport();
  }
});
