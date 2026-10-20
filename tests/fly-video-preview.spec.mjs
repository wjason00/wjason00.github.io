import { expect, test } from '@playwright/test';

test('Fly preview plays on request, seeks and pauses when it leaves the screen', async ({ page }) => {
  await page.goto('/');
  const video = page.locator('#fly-preview');
  const player = page.locator('.video-demo').filter({ has: video });
  const play = player.locator('.video-play');
  const seek = player.locator('.video-range');

  await expect(player).toHaveClass(/is-enhanced/);
  expect(await video.evaluate(element => ({ paused: element.paused, time: element.currentTime, nativeControls: element.controls })))
    .toEqual({ paused: true, time: 0, nativeControls: false });
  await expect(play).toHaveAccessibleName('Play illustrative 3D fly replay');
  await expect(seek).toBeDisabled();

  await play.scrollIntoViewIfNeeded();
  await play.focus();
  await play.press('Enter');
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.1);
  await expect(play).toHaveAccessibleName('Pause illustrative 3D fly replay');
  await expect(seek).toBeEnabled();

  const box = await seek.boundingBox();
  expect(box).not.toBeNull();
  await seek.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(true);
  const position = await video.evaluate(element => element.currentTime / element.duration);
  expect(position).toBeGreaterThan(0.4);
  expect(position).toBeLessThan(0.6);
  await expect(seek).toHaveAttribute('aria-valuetext', /0:04 of 0:09/);

  await seek.press('ArrowRight');
  await expect.poll(() => video.evaluate(element => element.currentTime / element.duration)).toBeGreaterThan(position);
  expect(await video.evaluate(element => element.paused)).toBe(true);

  await play.focus();
  await play.press('Space');
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(false);
  await page.locator('.intro').scrollIntoViewIfNeeded();
  await expect.poll(() => video.evaluate(element => element.paused)).toBe(true);
  await expect(play).toHaveAccessibleName('Play illustrative 3D fly replay');
});

test.describe('native playback fallback', () => {
  test.use({ javaScriptEnabled: false });

  test('Fly preview keeps native controls when scripts are disabled', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('#fly-preview');
    const player = page.locator('.video-demo').filter({ has: video });
    await expect(video).toHaveAttribute('controls', '');
    await expect(video).toHaveAttribute('poster', /fly-preview-20261020\.webp$/);
    await expect(player.locator('.video-controls')).toBeHidden();
    expect(await video.evaluate(element => ({ paused: element.paused, time: element.currentTime })))
      .toEqual({ paused: true, time: 0 });
  });
});
