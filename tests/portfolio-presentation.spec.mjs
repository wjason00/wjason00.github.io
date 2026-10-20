import { expect, test } from '@playwright/test';

for (const width of [1366, 390]) {
  test(`specimen opening leads to a readable work index at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 });
    await page.goto('/');
    const specimen = page.locator('.specimen-opening__scene img');
    await specimen.evaluate(image => image.decode());
    await expect(page.getByRole('heading', { name: 'Jason Wang', exact: true })).toBeInViewport();
    await expect(specimen).toBeVisible();
    await expect(page.locator('#opening-specimen-caption')).toContainText('Anatomical illustration');
    await expect(page.locator('#fly-study-details')).not.toHaveAttribute('open');
    await page.getByRole('link', { name: /Explore the work/ }).click();
    await expect(page.getByRole('heading', { name: 'Selected work' })).toBeInViewport();
    await expect(page.locator('.work-index__item').first()).toContainText('all 15 paired model comparisons');
    await expect(page.locator('.work-index__item').first()).toContainText('no change in real feeding behaviour');
    await page.getByRole('link', { name: /Read the study & paired results/ }).click();
    await expect(page.locator('#fly-study-details')).toHaveAttribute('open', '');
    await expect(page.locator('.fly-study-contribution')).toBeVisible();
    await expect(page.locator('.fly-circuit img')).toBeVisible();
    await expect(page.locator('.fly-comparison img')).toBeVisible();
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
