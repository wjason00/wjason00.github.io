import { expect, test } from '@playwright/test';
import zlib from 'node:zlib';

const ready = async page => {
  await page.waitForFunction(() => ['ready', 'failed'].includes(document.documentElement.dataset.journey));
  expect(await page.evaluate(() => document.documentElement.dataset.journey), 'the journey layer started').toBe('ready');
};

// Share of a screenshot that differs from its most common tone. Zero means one flat tone.
function ink(png) {
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20), bpp = png[25] === 6 ? 4 : 3, stride = w * bpp;
  const parts = [];
  for (let off = 8; off < png.length;) {
    const len = png.readUInt32BE(off);
    if (png.toString('ascii', off + 4, off + 8) === 'IDAT') parts.push(png.subarray(off + 8, off + 8 + len));
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(parts)), out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  const tones = new Uint32Array(256), samples = [];
  for (let y = 2; y < h; y += 4) for (let x = 2; x < w; x += 4) {
    const p = (y * w + x) * bpp, tone = Math.round((out[p] * 3 + out[p + 1] * 6 + out[p + 2]) / 10);
    tones[tone]++; samples.push(tone);
  }
  let mode = 0; tones.forEach((n, tone) => { if (n > tones[mode]) mode = tone; });
  return samples.filter(tone => Math.abs(tone - mode) > 14).length / samples.length;
}

// The opening follows the Recently section. If its points start invisible, the visitor scrolls
// through a blank screen before anything happens. A blank screen measures at most 0.1% ink here
// and the opening's first frame about 1.5%, so 0.4% separates the two with room on both sides.
const BLANK = 0.004;

for (const device of [
  { name: 'a 1366 x 768 desktop', viewport: { width: 1366, height: 768 }, isMobile: false, hasTouch: false },
  { name: 'a 390 x 844 phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
]) {
  test.describe(`opening pacing on ${device.name}`, () => {
    test.use({ viewport: device.viewport, isMobile: device.isMobile, hasTouch: device.hasTouch });
    test('the opening never scrolls in as a blank screen', async ({ page }) => {
      test.setTimeout(60_000);
      const { height } = device.viewport;
      await page.goto('/');
      await ready(page);
      // The opening's points are drawn with WebGL. Without it there is nothing to measure.
      test.skip(!(await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl')))), 'WebGL is not available in this browser');
      const top = await page.locator('.portal-opening').evaluate(node => Math.round(node.getBoundingClientRect().top + scrollY));
      const step = Math.round(height / 16);
      let run = 0, longest = 0;
      for (let y = top - height; y <= top + height / 4; y += step) {
        await page.evaluate(v => window.scrollTo(0, v), y);
        await page.waitForTimeout(280);
        run = ink(await page.screenshot()) < BLANK ? run + step : 0;
        longest = Math.max(longest, run);
      }
      expect(longest / height, 'longest run of blank screens, in screen heights').toBeLessThan(0.15);
    });
  });
}
