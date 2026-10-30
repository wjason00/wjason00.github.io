import { expect, test } from '@playwright/test';

const surface = page => page.locator('#portfolio-scene');
const state = canvas => canvas.evaluate(element => ({
  x: Number(element.dataset.rotationX),
  y: Number(element.dataset.rotationY),
  influence: Number(element.dataset.pointerInfluence),
  renders: Number(element.dataset.renderCount),
}));

async function readySurface(page) {
  await page.goto('/');
  const canvas = surface(page);
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-scene-ready', 'true');
  await expect(canvas).toHaveAttribute('data-point-count', '4096');
  await expect.poll(async () => (await state(canvas)).renders).toBeGreaterThan(0);
  return canvas;
}

async function canvasPoint(page, canvas, x = .65, y = .45) {
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  return {
    x: Math.max(2, Math.min(viewport.width - 2, box.x + box.width * x)),
    y: Math.max(2, Math.min(viewport.height - 2, box.y + box.height * y)),
  };
}

test('the opening has a substantial live surface and native routes to the full work', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const canvas = await readySurface(page);
  await expect(canvas).toBeInViewport({ ratio: .35 });
  const box = await canvas.boundingBox();
  expect(box.y).toBeLessThan(450);
  expect(box.width).toBeGreaterThanOrEqual(600);
  expect(box.height).toBeGreaterThanOrEqual(300);
  await expect(canvas).toHaveAttribute('tabindex', '0');
  await expect(canvas).toHaveAccessibleName(/\S/);
  const fullWork = page.locator('a[href*="work.html"]');
  expect(await fullWork.count()).toBeGreaterThan(0);
  expect(await fullWork.evaluateAll(links => links.some(link => link.getClientRects().length > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('video[autoplay]').count()).toBe(0);
});

test('native pointer movement changes the rendered surface rather than only a cursor overlay', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const canvas = await readySurface(page);
  await page.mouse.move(-10, -10);
  await page.waitForTimeout(1600);
  const before = await state(canvas);
  const pixels = await canvas.evaluate(element => element.toDataURL());
  const point = await canvasPoint(page, canvas, .72, .44);
  await page.mouse.move(point.x, point.y, { steps: 8 });
  await expect.poll(async () => (await state(canvas)).renders).toBeGreaterThan(before.renders);
  await expect.poll(async () => Math.abs((await state(canvas)).y - before.y)).toBeGreaterThan(.02);
  await expect.poll(() => canvas.evaluate(element => element.toDataURL())).not.toBe(pixels);
});

test('drag orbit and keyboard reset manipulate the same surface, then rendering settles', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const canvas = await readySurface(page);
  await canvas.focus();
  await canvas.press('Home');
  await page.mouse.move(-10, -10);
  await page.waitForTimeout(1600);
  const reset = await state(canvas);
  const start = await canvasPoint(page, canvas, .46, .45);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 110, start.y + 25, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await state(canvas)).y - reset.y)).toBeGreaterThan(.2);
  await page.mouse.move(-10, -10);
  await canvas.focus();
  await canvas.press('Home');
  await expect.poll(async () => Math.abs((await state(canvas)).y - reset.y)).toBeLessThan(.01);
  await canvas.press('ArrowRight');
  await expect.poll(async () => (await state(canvas)).y - reset.y).toBeGreaterThan(.1);
  await page.waitForTimeout(2200);
  const idle = await state(canvas);
  await page.waitForTimeout(300);
  expect((await state(canvas)).renders).toBe(idle.renders);
});

test('reduced motion keeps direct rotation and does not animate continuously', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const canvas = await readySurface(page);
  await page.mouse.move(-10, -10);
  await canvas.focus();
  await canvas.press('Home');
  const before = await state(canvas);
  await canvas.press('ArrowRight');
  await expect.poll(async () => (await state(canvas)).y - before.y).toBeGreaterThan(.1);
  await page.waitForTimeout(300);
  const resting = await state(canvas);
  await page.waitForTimeout(300);
  expect((await state(canvas)).renders).toBe(resting.renders);
  expect(await page.locator('video[autoplay]').count()).toBe(0);
});

test('legacy scientific links still open their preserved accounts', async ({ page }) => {
  for (const id of ['g27', 'fly-visuals', 'morphbrain-synthetic-study']) {
    await page.goto(`/#${id}`);
    await expect(page).toHaveURL(new RegExp(`/work\\.html#${id}$`));
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
});

test.describe('narrow touch access', () => {
  test.use({ viewport: { width: 320, height: 844 }, isMobile: true, hasTouch: true });

  test('horizontal touch rotates while a vertical swipe can scroll the page', async ({ page, context }) => {
    const canvas = await readySurface(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await canvas.evaluate(element => getComputedStyle(element).touchAction)).toContain('pan-y');
    const before = await state(canvas);
    const start = await canvasPoint(page, canvas, .35, .45);
    const input = await context.newCDPSession(page);
    const touch = async (type, points) => input.send('Input.dispatchTouchEvent', {
      type, touchPoints: points.map(([x, y]) => ({ x, y, id: 1 })),
    });
    try {
      await touch('touchStart', [[start.x, start.y]]);
      for (let i = 1; i <= 5; i++) await touch('touchMove', [[start.x + i * 12, start.y]]);
      await touch('touchEnd', []);
      await expect.poll(async () => Math.abs((await state(canvas)).y - before.y)).toBeGreaterThan(.15);
      await expect(canvas).toHaveAttribute('data-dragging', 'false');
      const scrollBefore = await page.evaluate(() => scrollY);
      const vertical = await canvasPoint(page, canvas, .55, .7);
      await touch('touchStart', [[vertical.x, vertical.y]]);
      for (let i = 1; i <= 6; i++) await touch('touchMove', [[vertical.x, vertical.y - i * 25]]);
      await touch('touchEnd', []);
      await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore + 20);
    } finally {
      await input.detach();
    }
  });
});

test.describe('the homepage without JavaScript', () => {
  test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });

  test('the atlas fallback and ordinary full-work links remain usable', async ({ page }) => {
    await page.goto('/');
    const poster = page.locator('img[src$="brain-surface.svg"]').first();
    await expect(poster).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const fullWork = page.locator('a[href*="work.html"]:visible').first();
    await expect(fullWork).toBeVisible();
    await fullWork.click();
    await expect(page).toHaveURL(/\/work\.html(?:#.*)?$/);
    await expect(page.getByRole('link', { name: 'Return to the interactive homepage', exact: true })).toBeVisible();
  });
});
