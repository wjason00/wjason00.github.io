import { expect, test } from '@playwright/test';

for (const width of [1366, 390, 320]) {
  test(`research gallery opens with a compact identity and a readable study entry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 });
    await page.goto('/');
    const specimen = page.locator('.specimen-opening__scene img');
    await specimen.evaluate(image => image.decode());
    await expect(page.locator('#intro-title')).toBeInViewport();
    await expect(specimen).toBeVisible();
    await expect(page.locator('#opening-specimen-caption a[href="#model-morpher"]')).toBeVisible();
    await expect(page.locator('#fly-study-details')).not.toHaveAttribute('open');
    const workTop = await page.locator('#selected-work').evaluate(element => element.getBoundingClientRect().top);
    expect(workTop).toBeLessThan(width < 800 ? 700 : 600);
    await expect(page.getByRole('link', { name: 'Explore the work', exact: true })).toBeInViewport();
    await page.getByRole('link', { name: /Explore the work/ }).click();
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

test('reduced motion preserves the static specimen and complete selected software', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#selected-work').scrollIntoViewIfNeeded();
  expect(await page.locator('.specimen-opening__scene img').evaluate(element => getComputedStyle(element).transform)).toBe('none');
  const tab = page.locator('#select-morphbrain');
  await tab.scrollIntoViewIfNeeded(); await tab.focus(); await tab.press('ArrowRight');
  const panel = page.locator('#preview-model-morpher');
  await expect(page.locator('#select-model-morpher')).toBeFocused();
  await expect(panel).toBeVisible();
  await expect(panel.locator('#model-morpher')).toBeVisible();
});

test('native study disclosure reveals figures without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage(); await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('.specimen-opening__scene img')).toBeVisible();
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
