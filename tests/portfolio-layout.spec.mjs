import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'reported wide desktop', width: 1618, height: 901, minimumPosterWidth: 500 },
  { name: 'common laptop', width: 1366, height: 768, minimumPosterWidth: 400 },
  { name: 'desktop breakpoint edge', width: 1024, height: 768, minimumPosterWidth: 360 },
  { name: 'narrow mobile', width: 390, height: 844, minimumPosterWidth: 320 },
];

for (const viewport of viewports) {
  test(`software preview follows research and keeps its usable width at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');

    const figure = page.locator('.project-gallery');
    const poster = page.locator('.hero__spotlight');
    await expect(figure).toBeVisible();
    await expect(poster).toBeVisible();
    expect(await page.locator('#projects .project-gallery').count()).toBe(1);
    expect(await page.locator('#experience').evaluate(section =>
      Boolean(section.compareDocumentPosition(document.querySelector('.project-gallery')) & Node.DOCUMENT_POSITION_FOLLOWING),
    )).toBe(true);
    expect(await page.locator('video[poster$="model-morpher.webp"]').count()).toBe(1);
    expect(await page.locator('[data-morphliner-showcase]').count()).toBe(1);

    const figureBox = await figure.boundingBox();
    const posterBox = await poster.boundingBox();
    expect(figureBox).not.toBeNull();
    expect(posterBox).not.toBeNull();
    expect(posterBox.width).toBeGreaterThanOrEqual(viewport.minimumPosterWidth);
    expect(posterBox.width / figureBox.width).toBeGreaterThanOrEqual(0.98);
    expect(posterBox.height).toBeGreaterThanOrEqual(300);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
}
