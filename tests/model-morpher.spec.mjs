import { expect, test } from '@playwright/test';

const route = '/demos/model-morpher/';
const sourceCounts = new Map([[0, '19,884'], [15, '17,790'], [29, '46,456']]);

async function openStudy(page, width = 1366) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(route);
  const canvas = page.locator('#morph-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('data-morph-ready', 'true');
  await expect.poll(async () => Number(await canvas.getAttribute('data-render-count'))).toBeGreaterThan(0);
  await expect(page.locator('#controls')).toBeVisible();
  await expect(page.locator('#triptych')).toBeVisible();
  return canvas;
}

async function expectFrame(page, canvas, frame) {
  await expect(canvas).toHaveAttribute('data-frame', String(frame));
  const t = Number(await canvas.getAttribute('data-t'));
  expect(t).toBeCloseTo(frame / 29, 12);
  await expect(page.locator('#progress')).toHaveValue(String(frame));
  await expect(page.locator('#st-frame')).toHaveText(String(frame));
  await expect(page.locator('#badge-frame')).toHaveText(String(frame));
  await expect(page.locator('#st-t')).toHaveText(`${frame}/29`);
  await expect(page.locator('#st-points')).toHaveText(`2,048 of ${sourceCounts.get(frame)}`);
  await expect(canvas).toHaveAttribute('data-transitioning', 'false');
}

async function changeFrame(canvas, action) {
  const previousRenders = Number(await canvas.getAttribute('data-render-count'));
  await action();
  await expect.poll(async () => Number(await canvas.getAttribute('data-render-count'))).toBeGreaterThan(previousRenders);
}

async function paintedPixels(canvas) {
  return canvas.evaluate(element => {
    const pixels = element.getContext('2d').getImageData(0, 0, element.width, element.height).data;
    let painted = 0;
    let hash = 2166136261;
    for (let i = 0; i < pixels.length; i++) {
      hash = Math.imul(hash ^ pixels[i], 16777619);
      if (i % 4 === 3 && pixels[i] > 0) painted++;
    }
    return { painted, hash: hash >>> 0 };
  });
}

test('Model Morpher paints distinct saved surfaces and supports preset and native slider navigation', async ({ page }) => {
  const canvas = await openStudy(page);
  const hashes = [];
  for (const frame of [0, 15, 29]) {
    if (frame !== 0) {
      await changeFrame(canvas, () => page.locator(`[data-frame="${frame}"]`).click());
    }
    await expectFrame(page, canvas, frame);
    const pixels = await paintedPixels(canvas);
    expect(pixels.painted).toBeGreaterThan(200);
    hashes.push(pixels.hash);
  }
  expect(new Set(hashes).size).toBe(3);

  const slider = page.getByRole('slider', { name: 'Scrub through 30 computed surfaces' });
  await slider.focus();
  await changeFrame(canvas, () => slider.press('Home'));
  await expectFrame(page, canvas, 0);
  await changeFrame(canvas, () => slider.press('End'));
  await expectFrame(page, canvas, 29);
  await changeFrame(canvas, () => page.locator('[data-frame="0"]').click());
  await expectFrame(page, canvas, 0);
});

test('Model Morpher waits for user playback and pause holds one exact saved frame', async ({ page }) => {
  const canvas = await openStudy(page);
  const play = page.locator('#play');
  await expectFrame(page, canvas, 0);
  await expect(canvas).toHaveAttribute('data-playing', 'false');
  await expect(play).toHaveText('Play');
  await page.waitForTimeout(300);
  await expect(canvas).toHaveAttribute('data-frame', '0');

  await play.click();
  await expect(play).toHaveAttribute('aria-pressed', 'true');
  await expect(canvas).toHaveAttribute('data-playing', 'true');
  await expect.poll(async () => Number(await canvas.getAttribute('data-frame'))).toBeGreaterThan(0);
  await play.click();
  await expect(play).toHaveText('Play');
  await expect(play).toHaveAttribute('aria-pressed', 'false');
  await expect(canvas).toHaveAttribute('data-playing', 'false');
  await expect(canvas).toHaveAttribute('data-transitioning', 'false');
  const paused = await canvas.getAttribute('data-frame');
  await expect(page.locator('#progress')).toHaveValue(paused);
  await page.waitForTimeout(300);
  await expect(canvas).toHaveAttribute('data-frame', paused);
});

test('Model Morpher without JavaScript shows its endpoint poster and usable native recording', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 320, height: 844 } });
  try {
    const page = await context.newPage();
    await page.goto(route);
    const poster = page.locator('#plate-fallback');
    await expect(poster).toBeVisible();
    await expect(poster).toHaveAttribute('alt', 'Whole-brain endpoint, frame 29, from the original Model Morpher recording.');
    await expect.poll(() => poster.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await expect(page.locator('#st-frame')).toHaveText('29');
    await expect(page.locator('#st-t')).toHaveText('29/29');
    await expect(page.locator('#st-points')).toHaveText('Rendered surface; point viewer inactive');
    await expect(page.locator('#controls')).toBeHidden();
    await expect(page.locator('#triptych')).toBeHidden();
    await expect(page.locator('#view-help')).toBeHidden();
    await expect(page.locator('button:visible, input:visible')).toHaveCount(0);
    await page.locator('#recording summary').click();
    const video = page.locator('#recording-video');
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute('controls', '');
    expect(await video.getAttribute('autoplay')).toBeNull();
    await expect(video.locator('source')).toHaveAttribute('src', '../../assets/model-morpher/dentate-to-brain.mp4');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  } finally {
    await context.close();
  }
});

test('Model Morpher is operable at 320px with full checkbox labels and a usable native range', async ({ page }) => {
  const canvas = await openStudy(page, 320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  for (const id of ['blend', 'ghosts']) {
    const checkbox = page.locator(`#${id}`);
    const label = page.locator(`label:has(#${id})`);
    await label.scrollIntoViewIfNeeded();
    const box = await label.boundingBox();
    expect(box).not.toBeNull();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    const checked = await checkbox.isChecked();
    await label.click();
    await expect(checkbox).toBeChecked({ checked: !checked });
  }
  const slider = page.getByRole('slider', { name: 'Scrub through 30 computed surfaces' });
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(150);
  await slider.focus();
  await slider.press('End');
  await expectFrame(page, canvas, 29);
  await slider.press('Home');
  await expectFrame(page, canvas, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
