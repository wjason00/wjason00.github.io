import { expect, test } from '@playwright/test';

async function openMorphliner(page) {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Selected projects', exact: true })
    .getByRole('link', { name: 'Morphliner', exact: true }).click();
  await expect(page).toHaveURL(/\/#work-morphliner$/);
  const scene = page.locator('#work-morphliner');
  await expect(scene.locator('[data-morphliner-inspect]')).toBeVisible();
  return scene;
}

const videoState = element => ({
  ready: element.readyState >= HTMLMediaElement.HAVE_METADATA,
  paused: element.paused,
  seeking: element.seeking,
  time: element.currentTime,
  error: element.error ? { code: element.error.code, message: element.error.message } : null,
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  await testInfo.attach('native-video-state', {
    body: JSON.stringify(await page.locator('video').evaluateAll(videos => videos.map(video => ({
      src: video.currentSrc,
      readyState: video.readyState,
      networkState: video.networkState,
      paused: video.paused,
      currentTime: video.currentTime,
      error: video.error ? { code: video.error.code, message: video.error.message } : null,
    }))), null, 2),
    contentType: 'application/json',
  });
});

for (const viewport of [{ width: 360, height: 800 }, { width: 1280, height: 900 }]) {
  test(`Morphliner film and all three stills fit at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const scene = await openMorphliner(page);
    await expect(page.locator('.portal-scene')).toHaveCount(5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    const video = scene.locator('[data-morphliner-video]');
    await expect(video).toBeVisible();
    expect(await video.evaluate(element => element.controls)).toBe(true);
    const stills = scene.locator('[data-morphliner-time]');
    await expect(stills).toHaveCount(3);
    await scene.locator('.morphliner-filmstrip').scrollIntoViewIfNeeded();
    for (const still of await stills.all()) {
      await expect(still).toBeInViewport({ ratio: 1 });
      expect(await still.evaluate(element => {
        const bounds = element.getBoundingClientRect();
        const strip = element.parentElement.getBoundingClientRect();
        return bounds.left >= 0 && bounds.right <= innerWidth
          && bounds.left >= strip.left && bounds.right <= strip.right;
      })).toBe(true);
      await expect.poll(() => still.locator('img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    }

    const videos = page.locator('video');
    await expect(videos).toHaveCount(3);
    for (const film of await videos.all()) {
      await expect(film).not.toHaveAttribute('autoplay');
      expect(await film.evaluate(element => element.autoplay || !element.paused)).toBe(false);
    }
    await page.screenshot({ path: testInfo.outputPath(`morphliner-${viewport.width}.png`) });
  });
}

test('Morphliner stills seek the native film while keeping playback paused', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const scene = await openMorphliner(page);
  const video = scene.locator('[data-morphliner-video]');
  const middle = scene.locator('[data-morphliner-time="3.25"]');
  const first = scene.locator('[data-morphliner-time="0.5"]');
  await expect(video).not.toHaveAttribute('autoplay');
  expect((await video.evaluate(videoState)).paused).toBe(true);
  await video.evaluate(element => {
    window.__morphlinerPlayEvents = 0;
    element.addEventListener('play', () => { window.__morphlinerPlayEvents += 1; });
  });

  await middle.click();
  await expect.poll(() => video.evaluate(videoState)).toMatchObject({ ready: true, paused: true, seeking: false, error: null });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeCloseTo(3.25, 1);
  await expect(middle).toHaveAttribute('aria-pressed', 'true');
  await expect(first).toHaveAttribute('aria-pressed', 'false');
  await expect(scene.locator('[data-morphliner-status]')).toHaveText('Film paused at 3.25 s.');
  const selectedTime = await video.evaluate(element => element.currentTime);
  await page.waitForTimeout(300);
  expect(await video.evaluate(element => element.currentTime)).toBeCloseTo(selectedTime, 3);
  expect((await video.evaluate(videoState)).paused).toBe(true);

  await first.focus();
  await expect(first).toBeFocused();
  await first.press('Enter');
  await expect.poll(() => video.evaluate(videoState)).toMatchObject({ ready: true, paused: true, seeking: false, error: null });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeCloseTo(0.5, 1);
  await expect(first).toHaveAttribute('aria-pressed', 'true');
  await expect(middle).toHaveAttribute('aria-pressed', 'false');
  await expect(scene.locator('[data-morphliner-status]')).toHaveText('Film paused at 0.5 s.');
  expect(await page.evaluate(() => window.__morphlinerPlayEvents)).toBe(0);
});
