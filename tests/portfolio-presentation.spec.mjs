import { expect, test } from '@playwright/test';

for (const width of [1366, 390, 320]) {
  test(`portfolio opening keeps identity, native routes and research discoverable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 900 });
    await page.goto('/');
    const identity = page.getByRole('heading', { level: 1, name: 'Jason Wang', exact: true });
    const specimen = page.locator('#opening-morpher');
    const video = specimen.getByLabel('Model Morpher prototype recording');
    await expect(identity).toBeInViewport();
    await expect(video).toBeVisible();
    await expect(video).not.toHaveAttribute('autoplay');
    await expect(video).toHaveAttribute('poster', './assets/portfolio/model-morpher.webp');
    await expect(video).toHaveAttribute('aria-describedby', 'opening-morpher-limit');
    await expect(specimen.locator('figcaption')).toBeVisible();
    await expect(specimen.locator('#opening-morpher-limit')).toContainText(/Geometric interpolation, not anatomical correspondence or development/);
    const routes = page.getByRole('navigation', { name: 'Explore my work' });
    for (const [label, href] of [['Research', '#selected-work'], ['Software', '#projects'], ['About', '#about']]) {
      const route = routes.locator(`a[href="${href}"]`);
      await expect(route).toContainText(label);
      await expect(route).toBeInViewport();
      if (width < 800) expect((await route.boundingBox()).height).toBeGreaterThanOrEqual(44);
      await expect(page.locator(`.site-nav a[href="${href}"]`)).toHaveText(label);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('#fly-study-details')).not.toHaveAttribute('open');
    const workTop = await page.locator('#selected-work').evaluate(element => element.getBoundingClientRect().top);
    expect(workTop).toBeLessThan(width < 800 ? 700 : 600);
    const research = routes.locator('a[href="#selected-work"]');
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
    for (const file of ['timing-original.png', 'montage-original.png'])
      await expect(page.locator(`#g27 img[src="./assets/portfolio/g27/${file}"]`)).toBeVisible();
    await expect(page.locator('#g27 img[src$=".svg"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('reduced motion keeps the recording opt-in and selected software complete', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#opening-morpher');
  const video = page.locator('#opening-morpher video');
  await expect(video).toBeVisible();
  await expect(video).not.toHaveAttribute('autoplay');
  expect(await video.evaluate(element => element.paused && element.currentTime === 0)).toBe(true);
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
  await expect(page.locator('#opening-morpher video')).toBeVisible();
  await expect(page.locator('#opening-morpher video')).toHaveAttribute('controls', '');
  await expect(page.locator('#opening-morpher-limit')).toBeVisible();
  await page.getByRole('navigation', { name: 'Explore my work' }).locator('a[href="#selected-work"]').click();
  await expect(page.getByRole('heading', { name: 'Selected research', exact: true })).toBeInViewport();
  const summary = page.locator('#fly-study-details > summary');
  await summary.scrollIntoViewIfNeeded(); await summary.focus(); await summary.press('Enter');
  await expect(page.locator('.fly-comparison img')).toBeVisible();
  await expect(page.locator('#fly-preview')).toHaveAttribute('controls', '');
  await context.close();
});

test('linked recording supports play, pause, keyboard seeking and offscreen pause', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/#opening-morpher');
  const specimen = page.locator('#opening-morpher');
  const video = specimen.locator('video');
  const controls = specimen.getByRole('group', { name: 'Model Morpher recording controls' });
  const play = controls.getByRole('button', { name: 'Play Model Morpher recording', exact: true });
  const expand = controls.getByRole('button', { name: 'Expand Model Morpher recording to full screen', exact: true });
  await expect(expand).toBeVisible();
  const expandContrast = await expand.evaluate(button => {
    const luminance = colour => {
      const rgb = colour.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255);
      const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const foreground = luminance(getComputedStyle(button).color);
    const background = luminance(getComputedStyle(button.closest('[role="group"]')).backgroundColor);
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
  expect(expandContrast).toBeGreaterThanOrEqual(4.5);
  expect(await video.evaluate(element => element.paused && element.currentTime === 0)).toBe(true);
  await play.click();
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.1);
  await controls.getByRole('button', { name: 'Pause Model Morpher recording', exact: true }).click();
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(true);

  const seek = controls.getByRole('slider');
  await expect(seek).toBeEnabled();
  expect((await seek.boundingBox()).width).toBeGreaterThanOrEqual(150);
  await seek.focus();
  await seek.press('Home');
  await seek.press('ArrowRight');
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThanOrEqual(0.08);
  await seek.press('End');
  await expect.poll(() => video.evaluate(element => element.currentTime / element.duration)).toBeGreaterThan(0.95);
  await seek.press('Home');
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeLessThan(0.1);
  await play.click();
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(false);
  await page.locator('#about').scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(true);
});

test('legacy scientific hashes reveal the corresponding complete native account', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [hash, disclosure] of [['fly-visuals', 'fly-study-details'], ['fly-strength-study', 'fly-study-details'], ['fly-timing-title', 'fly-study-details'], ['dpca', 'signal-study-details']]) {
    await page.goto(`/#${hash}`);
    await expect(page.locator(`#${disclosure}`)).toHaveAttribute('open', '');
    await expect(page.locator(`#${hash}`)).toBeInViewport();
  }
});
