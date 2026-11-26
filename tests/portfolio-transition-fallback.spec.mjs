import { expect, test } from '@playwright/test';
import zlib from 'node:zlib';

// Read actual composited pixels, including the blank-screen case where the DOM exists.
function tones(png) {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  const bpp = png[25] === 6 ? 4 : 3, stride = width * bpp, parts = [];
  for (let offset = 8; offset < png.length;) {
    const length = png.readUInt32BE(offset);
    if (png.toString('ascii', offset + 4, offset + 8) === 'IDAT') parts.push(png.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts)), pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? pixels[y * stride + x - bpp] : 0;
      const b = y ? pixels[(y - 1) * stride + x] : 0;
      const c = y && x >= bpp ? pixels[(y - 1) * stride + x - bpp] : 0;
      let value = raw[y * (stride + 1) + 1 + x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[y * stride + x] = value & 255;
    }
  }
  const result = [];
  for (let y = 2; y < height; y += 4) for (let x = 2; x < width; x += 4) {
    const p = y * stride + x * bpp;
    result.push(Math.round((pixels[p] * 3 + pixels[p + 1] * 6 + pixels[p + 2]) / 10));
  }
  return result;
}

function ink(samples) {
  const histogram = new Uint32Array(256);
  samples.forEach(tone => histogram[tone]++);
  let mode = 0;
  histogram.forEach((count, tone) => { if (count > histogram[mode]) mode = tone; });
  return samples.filter(tone => Math.abs(tone - mode) > 14).length / samples.length;
}

async function positionOpening(page, progress) {
  await page.evaluate(p => {
    const opening = window.ScrollTrigger.getAll().find(trigger => trigger.trigger?.classList.contains('jr-dive'));
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo({ top: opening.start + (opening.end - opening.start) * p, behavior: 'instant' });
  }, progress);
  await page.waitForTimeout(450);
}

async function withBrowserPage(playwright, baseURL, viewport, args, check) {
  const browser = await playwright.chromium.launch({ args });
  try {
    const context = await browser.newContext({ baseURL, viewport });
    const page = await context.newPage();
    await check(page);
  } finally {
    await browser.close();
  }
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 360, height: 800 }]) {
  test.describe(`opening without WebGL at ${viewport.width}px`, () => {
    // A real browser capability failure, rather than replacing the application's canvas methods.
    test('the brain stays visible, moves with scrolling and reveals all five projects', async ({ playwright, baseURL }, testInfo) => {
      await withBrowserPage(playwright, baseURL, viewport, ['--disable-webgl'], async page => {
      await page.goto('/');
      await page.waitForFunction(() => document.documentElement.dataset.journey === 'ready');
      expect(await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl')))).toBe(false);
      await positionOpening(page, 0);
      const firstImage = await page.screenshot();
      await testInfo.attach(`opening-${viewport.width}-start`, { body: firstImage, contentType: 'image/png' });
      const first = tones(firstImage);
      expect(ink(first), 'the opening contains visible points before any scrolling').toBeGreaterThan(0.004);
      await positionOpening(page, 0.2);
      const movedImage = await page.screenshot();
      await testInfo.attach(`opening-${viewport.width}-moving`, { body: movedImage, contentType: 'image/png' });
      const moved = tones(movedImage);
      expect(ink(moved), 'the opening remains populated during the camera move').toBeGreaterThan(0.004);
      expect(moved.filter((tone, i) => Math.abs(tone - first[i]) > 14).length / moved.length,
        'scrolling changes the rendered points, not only hidden state').toBeGreaterThan(0.004);
      await positionOpening(page, 0.82);
      const copy = page.locator('.portal-opening .jr-copy');
      await expect.poll(() => copy.evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(0.98);
      const links = copy.locator('.portal-index a');
      await expect(links).toHaveCount(5);
      for (const link of await links.all()) await expect(link).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await testInfo.attach(`opening-${viewport.width}-projects`, { body: await page.screenshot(), contentType: 'image/png' });
      });
    });
  });
}

test.describe('WebGL context loss during the opening', () => {
  test('the current frame survives context loss and scrolling still reveals the index', async ({ playwright, baseURL }, testInfo) => {
    await withBrowserPage(playwright, baseURL, { width: 1280, height: 900 },
      ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'], async page => {
    await page.goto('/');
    await page.waitForFunction(() => document.documentElement.dataset.journey === 'ready');
    const canLoseContext = await page.locator('.jr-gl').evaluate(canvas =>
      Boolean(canvas.getContext('webgl')?.getExtension('WEBGL_lose_context')));
    test.skip(!canLoseContext, 'The browser does not expose WEBGL_lose_context');
    await positionOpening(page, 0.2);
    const before = await page.screenshot();
    expect(ink(tones(before)), 'the original WebGL frame is populated').toBeGreaterThan(0.004);
    const scrollBefore = await page.evaluate(() => scrollY);
    await testInfo.attach('opening-before-context-loss', { body: before, contentType: 'image/png' });
    await page.locator('.jr-gl').evaluate(canvas => canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext());
    await expect(page.locator('.jr-gl')).toHaveAttribute('data-renderer', 'canvas2d');
    expect(await page.evaluate(() => scrollY), 'context loss must not move the visitor').toBe(scrollBefore);
    const after = await page.screenshot();
    expect(ink(tones(after)), 'the replacement draws without requiring another scroll').toBeGreaterThan(0.004);
    await testInfo.attach('opening-after-context-loss', { body: after, contentType: 'image/png' });
    await positionOpening(page, 0.82);
    const copy = page.locator('.portal-opening .jr-copy');
    await expect.poll(() => copy.evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(0.98);
    const links = copy.locator('.portal-index a');
    await expect(links).toHaveCount(5);
    for (const link of await links.all()) await expect(link).toBeInViewport({ ratio: 1 });
    });
  });
});

test('the project index appears immediately if both opening renderers fail', async ({ playwright, baseURL }, testInfo) => {
  await withBrowserPage(playwright, baseURL, { width: 1280, height: 900 },
    ['--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'], async page => {
      await page.goto('/');
      await page.waitForFunction(() => document.documentElement.dataset.journey === 'ready');
      const canLoseContext = await page.locator('.jr-gl').evaluate(canvas =>
        Boolean(canvas.getContext('webgl')?.getExtension('WEBGL_lose_context')));
      test.skip(!canLoseContext, 'The browser does not expose WEBGL_lose_context');
      await positionOpening(page, 0.2);
      const scrollBefore = await page.evaluate(() => scrollY);
      // Synthetic denial of only this decorative canvas's second renderer; the loss event itself
      // is native. Every other canvas retains its real getContext implementation.
      await page.locator('.jr-gl').evaluate(canvas => {
        const nativeGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          if (kind === '2d' && this.classList.contains('jr-gl')) return null;
          return nativeGetContext.call(this, kind, ...args);
        };
        canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext();
      });
      const copy = page.locator('.portal-opening .jr-copy');
      await expect.poll(() => copy.evaluate(node => Number(getComputedStyle(node).opacity))).toBe(1);
      expect(await page.locator('.portal-opening .jr-pin').evaluate(node =>
        Number(getComputedStyle(node).getPropertyValue('--dark')))).toBe(1);
      expect(await page.evaluate(() => scrollY), 'the index appears without another scroll').toBe(scrollBefore);
      const links = copy.locator('.portal-index a');
      await expect(links).toHaveCount(5);
      for (const link of await links.all()) await expect(link).toBeInViewport({ ratio: 1 });
      await testInfo.attach('opening-both-renderers-unavailable', { body: await page.screenshot(), contentType: 'image/png' });
    });
});

async function recordTransitions(page) {
  await page.addInitScript(() => {
    addEventListener('pageswap', event => {
      sessionStorage.setItem('lastPortfolioTransition', JSON.stringify({
        from: location.pathname, active: Boolean(event.viewTransition),
      }));
    });
  });
}

test('native home and work navigation retains cross-document transitions where supported', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await recordTransitions(page);
  await page.goto('/');
  const supported = await page.evaluate(() => 'onpageswap' in window && 'CSSViewTransitionRule' in window);
  await page.locator('.xp-bar').getByRole('link', { name: 'Research', exact: true }).click();
  await expect(page).toHaveURL(/\/work\.html#selected-work$/);
  await expect(page.getByRole('heading', { name: 'Selected research' })).toBeInViewport();
  await expect(page.locator('h1')).toHaveText('Research & software');
  if (supported) expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('lastPortfolioTransition')).active)).toBe(true);
  await page.locator('a.site-name').click();
  await expect(page).toHaveURL(/\/index\.html$/);
  await expect(page.locator('h1')).toHaveText('Jason Wang');
  if (supported) expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('lastPortfolioTransition')).active)).toBe(true);
});

test('reduced motion keeps a readable index and native home and work navigation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await recordTransitions(page);
  await page.goto('/');
  await expect(page.locator('.portal-index a')).toHaveCount(5);
  await expect(page.locator('.jr-stage')).toHaveCount(0);
  for (const width of [320, 360, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const linksAndButton = await page.locator('.xp-bar a:visible, .xp-bar button:visible').evaluateAll(elements =>
      elements.map(element => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, right: x + width, centre: y + height / 2 };
      })
    );
    expect(linksAndButton.length).toBeGreaterThanOrEqual(4);
    for (const { x, right, centre } of linksAndButton) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(width);
      expect(centre).toBeCloseTo(linksAndButton[0].centre, 0);
    }
  }
  await page.locator('.xp-bar').getByRole('link', { name: 'Research', exact: true }).click();
  await expect(page).toHaveURL(/\/work\.html#selected-work$/);
  await expect(page.getByRole('heading', { name: 'Selected research' })).toBeInViewport();
  await expect(page.locator('h1')).toHaveText('Research & software');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('lastPortfolioTransition') || '{"active":false}').active)).toBe(false);
  await page.locator('a.site-name').click();
  await expect(page.locator('.portal-index a')).toHaveCount(5);
  await expect(page.locator('.jr-stage')).toHaveCount(0);
});
