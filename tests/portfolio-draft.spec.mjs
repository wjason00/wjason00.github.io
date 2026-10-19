import { expect, test } from '@playwright/test';

test('project navigation follows ordinary scrolling and can jump back to a project', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/demos/portfolio-draft/');
  await expect(page.locator('#ghost-fly')).toHaveClass(/has-model/, { timeout: 20_000 });
  const nav = page.getByRole('navigation', { name: 'Selected projects' });
  await expect(nav.getByRole('link', { name: 'Fly circuits' })).toHaveAttribute('aria-current', 'location');
  await page.locator('#morphbrain').scrollIntoViewIfNeeded();
  await expect(nav.getByRole('link', { name: 'MorphBrain', exact: true })).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('[data-visual="morphbrain"]')).toHaveClass(/is-active/);
  await nav.getByRole('link', { name: 'Fly circuits' }).click();
  await expect(page).toHaveURL(/#fly$/);
  await expect(nav.getByRole('link', { name: 'Fly circuits' })).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('[data-visual="fly"]')).toHaveClass(/is-active/);
  expect(errors).toEqual([]);
});

test('phone layout keeps headings, project links and the index within the page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demos/portfolio-draft/');
  for (const id of ['fly', 'rare-errors', 'morphbrain', 'model-morpher', 'morphliner']) {
    const chapter = page.locator(`#${id}`);
    await chapter.scrollIntoViewIfNeeded();
    const box = await chapter.locator('.project-title').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(391);
    await expect(chapter.locator('.project-links a').first()).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('navigation', { name: 'Selected projects' }).getByRole('link', { name: 'Morphliner' }).click();
  await expect(page).toHaveURL(/#morphliner$/);
});

test('reduced motion has static imagery and appearance links select the requested draft', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/demos/portfolio-draft/?direction=night');
  await expect(page.locator('body')).toHaveAttribute('data-direction', 'night');
  const visual = page.locator('[data-visual="fly"]');
  expect(await visual.evaluate(element => getComputedStyle(element).transitionDuration)).toBe('0s');
  await page.getByRole('button', { name: 'Appearance: Night' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-direction', 'editorial');
  await expect(page).toHaveURL(/direction=editorial/);
  await page.getByRole('link', { name: 'Draft / Contact sheet' }).click();
  for (const direction of ['mist', 'night', 'editorial']) {
    await expect(page.locator(`a[href="./?direction=${direction}"]`).first()).toBeVisible();
  }
});

test('content and the source image fallback remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/demos/portfolio-draft/');
  await expect(page.getByRole('heading', { name: 'Fly circuits' })).toBeVisible();
  const fallback = page.locator('.fly-fallback');
  await expect(fallback).toBeVisible();
  expect(await fallback.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.getByRole('button', { name: /Appearance/ })).toBeHidden();
  await page.getByRole('navigation', { name: 'Selected projects' }).getByRole('link', { name: 'MorphBrain', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'MorphBrain', exact: true })).toBeInViewport();
  await context.close();
});
