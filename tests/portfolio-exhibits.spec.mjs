import { expect, test } from '@playwright/test';

async function openIndex(page, viewport = { width: 1280, height: 900 }) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/#projects');
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'ready');
  await expect(page.locator('.exhibit-index')).toBeVisible();
  await expect.poll(() => page.locator('.jr-dive .jr-copy').evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(.98);
}

async function expectSelected(page, id, name) {
  const row = page.locator('.exhibit-row').filter({ has: page.locator(`a[href="#${id}"]`) });
  const preview = page.locator('.exhibit-preview');
  await expect(preview).toHaveAttribute('data-project', id);
  await expect(preview.locator('.exhibit-preview-name')).toHaveText(name);
  await expect(preview.getByRole('link', { name: `Open ${name}`, exact: true })).toHaveAttribute('href', `#${id}`);
  await expect(page.locator('.exhibit-pick[aria-pressed="true"]')).toHaveCount(1);
  await expect(row.locator('.exhibit-pick')).toHaveAttribute('aria-pressed', 'true');
  await expect(preview.locator('img')).toHaveAttribute('src', await row.locator('.portal-index-media img').getAttribute('src'));
  await expect.poll(() => preview.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
}

function captureErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.stack || error.message));
  return errors;
}

test('project previews follow real hover, keyboard focus and View clicks, with a working Open target', async ({ page }) => {
  const errors = captureErrors(page);
  await openIndex(page);
  await expectSelected(page, 'work-model-morpher', 'Model Morpher');
  await page.locator('.portal-index a[href="#work-g27"]').hover();
  await expectSelected(page, 'work-g27', 'EEG decoding');
  await page.locator('.portal-index a[href="#work-fly"]').focus();
  await expectSelected(page, 'work-fly', 'Fly circuit');
  await expect(page.locator('.portal-index a[href="#work-fly"]')).toBeFocused();
  const before = page.url();
  await page.getByRole('button', { name: 'View MorphBrain preview', exact: true }).click();
  await expectSelected(page, 'work-morphbrain', 'MorphBrain');
  expect(page.url(), 'preview selection does not navigate').toBe(before);
  await page.getByRole('link', { name: 'Open MorphBrain', exact: true }).click();
  await expect(page).toHaveURL(/#work-morphbrain$/);
  await expect(page.locator('#work-morphbrain .jr-pin')).toBeInViewport();
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 360, height: 800 }, { width: 844, height: 390 }]) {
  test(`all five index anchors and preview actions fit at ${viewport.width} by ${viewport.height}`, async ({ page }) => {
    const errors = captureErrors(page);
    await openIndex(page, viewport);
    const anchors = page.locator('.portal-index > li > a');
    await expect(anchors).toHaveCount(5);
    const targets = [...await anchors.all(), ...await page.locator('.exhibit-pick').all(), page.locator('.exhibit-preview-open')];
    for (const target of targets) {
      await expect(target).toBeVisible();
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThan(35);
      expect(box.height).toBeGreaterThanOrEqual(30);
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.y).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    }
    await page.getByRole('button', { name: 'View Morphliner preview', exact: true }).click();
    await expectSelected(page, 'work-morphliner', 'Morphliner');
    await expect(page.getByRole('link', { name: 'Open Morphliner', exact: true })).toBeInViewport({ ratio: 1 });
    if (viewport.width === 360) {
      await page.getByRole('button', { name: 'View Fly circuit preview', exact: true }).click();
      await expectSelected(page, 'work-fly', 'Fly circuit');
      const imageBox = await page.locator('.exhibit-preview-frame').boundingBox();
      expect(imageBox.width / imageBox.height, 'the phone preview follows the wide image rather than a tall empty frame').toBeCloseTo(16 / 9, 1);
      const nameBox = await page.locator('.exhibit-preview-name').boundingBox();
      const openBox = await page.locator('.exhibit-preview-open').boundingBox();
      expect(Math.abs(nameBox.y + nameBox.height / 2 - openBox.y - openBox.height / 2)).toBeLessThan(3);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('Morpher inspection is substantial and the EEG source stays unchanged beside its decision controls', async ({ page }) => {
  const errors = captureErrors(page);
  for (const viewport of [{ width: 1280, height: 900 }, { width: 360, height: 800 }]) {
    await openIndex(page, viewport);
    const surface = page.locator('#sheet-morpher > .portal-surface');
    await surface.scrollIntoViewIfNeeded();
    await expect(surface).toBeVisible();
    const box = await surface.boundingBox();
    expect(box.width, 'the inspection surface spans most of the viewport').toBeGreaterThan(viewport.width * .75);
    expect(box.height, 'the surface is a main artifact rather than a thumbnail').toBeGreaterThan(viewport.height * .4);
    const poster = surface.locator('.portal-surface-poster');
    await expect(poster).toBeVisible();
    await expect.poll(() => poster.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(surface.locator('[data-inspect-surface]')).toBeVisible();

    const source = page.locator('#sheet-eeg .exhibit-eeg-source');
    const original = page.locator('.jr-eeg .jr-pin .portal-eeg-figure img');
    const duplicate = source.locator('img');
    await source.scrollIntoViewIfNeeded();
    await expect(duplicate).toBeVisible();
    await expect(duplicate).toHaveAttribute('src', '/assets/portfolio/g27/timing-original.png');
    await expect(duplicate).toHaveAttribute('src', await original.getAttribute('src'));
    await expect(duplicate).toHaveAttribute('alt', await original.getAttribute('alt'));
    await expect(duplicate).toHaveCSS('clip-path', 'none');
    await expect.poll(() => duplicate.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(source.getByRole('link', { name: 'Open full-size figure' })).toHaveAttribute('href', '/assets/portfolio/g27/timing-original.png');
    const controls = page.locator('#sheet-eeg .portal-window-pick');
    const sourceBox = await source.boundingBox(), controlBox = await controls.boundingBox();
    expect(sourceBox.width).toBeGreaterThan(viewport.width * .7);
    expect(controlBox.y).toBeGreaterThanOrEqual(sourceBox.y + sourceBox.height - 2);
    expect(controlBox.y - sourceBox.y - sourceBox.height, 'decision controls follow the source figure nearby').toBeLessThan(160);
    const later = controls.locator('button[data-window="425"]');
    await later.click();
    await expect(later).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#work-g27')).toHaveAttribute('data-window', '425');
    await expect(page.locator('#sheet-eeg [data-window-note="425"]')).toBeVisible();
    await expect(page.locator('#sheet-eeg .portal-eeg-body > .portal-limit')).toContainText('Not a held-out gain.');
    await expect(duplicate).toHaveAttribute('src', await original.getAttribute('src'));
  }
  expect(errors).toEqual([]);
});
