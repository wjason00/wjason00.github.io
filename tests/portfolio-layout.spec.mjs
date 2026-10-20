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

    if (process.env.PORTFOLIO_REVIEW_CAPTURE && [1366, 390].includes(viewport.width)) {
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => {
          localStorage.setItem('portfolio-theme', value);
          document.documentElement.dataset.theme = value;
        }, theme);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({ path: `output/portfolio-ux-20261020/intro-${viewport.width}-${theme}.png` });
        await page.locator('#fly-circuit').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `output/portfolio-ux-20261020/research-${viewport.width}-${theme}.png` });
        await page.locator('#morphbrain').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `output/portfolio-ux-20261020/software-${viewport.width}-${theme}.png` });
      }
    }
  });
}

test('project selection keeps contributions, results and critical limits outside optional methods', async ({ page }) => {
  await page.goto('/');

  const fly = page.locator('#fly-circuit');
  await expect(fly.locator('.research-feature__copy > p').filter({ hasText: /I (?:proposed|directed)/ })).toBeVisible();
  await expect(fly.getByText('127,400-neuron implementation of a published fly model', { exact: true })).toBeVisible();
  await expect(fly.getByText('all 15 paired comparisons', { exact: true })).toBeVisible();
  await expect(fly.locator('.research-feature__copy > .research-result-limit')).toBeVisible();
  await expect(fly.locator('.research-feature__copy > .research-result-limit')).toContainText(/do not establish a change in real feeding behaviour/);
  await expect(fly.locator('.research-result-figure img')).toBeVisible();
  await expect(fly.locator('details')).not.toHaveAttribute('open');

  const timing = fly.locator('.research-followup');
  await expect(timing.getByRole('heading', { name: /Does timing change/ })).toBeVisible();
  await expect(timing.locator('.research-result-limit')).toContainText(/no consistent directional or biological effect/);
  await expect(timing.getByRole('link', { name: /Explore the timing experiment/ })).toHaveAttribute('href', './demos/fly/timing/');
  const rareErrors = page.locator('#dpca');
  await expect(rareErrors.getByRole('heading', { name: /Can stimulus and choice be separated/ })).toBeVisible();
  await expect(rareErrors.locator('.research-feature__copy > p').filter({ hasText: /With no errors/ })).toBeVisible();
  await expect(rareErrors.getByRole('link', { name: /Explore the rare-error experiment/ })).toHaveAttribute('href', './rare-errors.html');

  const projects = [
    { id: 'morphbrain', purpose: /Move or remove SHH and BMP sources/, limit: /not calibrated to biological/ },
    { id: 'model-morpher', purpose: /distance fields/, limit: /does not track corresponding\s+anatomy or model biological development/ },
    { id: 'morphliner', purpose: /camera keyframes/, limit: /Full\s+release remains in development/ },
  ];
  for (const { id, purpose, limit } of projects) {
    const project = page.locator(`#${id}`);
    await expect(project.locator('.project__lede')).toBeVisible();
    await expect(project.locator('.project__lede')).toContainText(purpose);
    await expect(project.locator('.project-limit')).toBeVisible();
    await expect(project.locator('.project-limit')).toContainText(limit);
    const methods = project.locator('.project__body > details.project-notes');
    await expect(methods).toHaveCount(1);
    await expect(methods).not.toHaveAttribute('open');
    await expect(methods.locator(':scope > summary')).toHaveText('Methods & sources');
    await expect(project.locator('.project__preview-link a')).toHaveAttribute('href', `#preview-${id}`);
  }

  for (const id of ['experience', 'fly-circuit', 'fly-timing-title', 'dpca', 'projects',
    'preview-morphbrain', 'preview-model-morpher', 'preview-morphliner',
    'morphbrain', 'morphbrain-notes', 'morphbrain-synthetic-study', 'model-morpher', 'morphliner', 'about']) {
    await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
  }
});

for (const width of [1366, 820, 390]) {
  test(`fly presentation pairs a playable source replay with saved evidence at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const video = page.locator('#fly-preview');
    const chart = page.locator('.fly-comparison img');
    await expect(video).toHaveAttribute('controls', '');
    await expect(video).toHaveAttribute('preload', 'none');
    await expect(video).not.toHaveAttribute('autoplay');
    await expect(video).toHaveAttribute('aria-describedby', 'fly-replay-caption');
    await expect(page.locator('#fly-replay-caption')).toContainText(/Separate archive; uncalibrated movement/);
    await expect(page.locator('#fly-replay-caption')).toContainText('assumed relaxation after 1 s');
    await expect(page.locator('#fly-replay-caption')).toContainText('does not show the paired experiment');
    await expect(chart).toHaveAttribute('src', './assets/portfolio/fly-paired-comparison.svg');
    const videoBox = await video.boundingBox();
    const chartBox = await chart.boundingBox();
    if (width > 1000) {
      expect(Math.abs(videoBox.y - chartBox.y)).toBeLessThan(3);
      expect(chartBox.x).toBeGreaterThan(videoBox.x + videoBox.width);
      expect(videoBox.width).toBeGreaterThan(650);
      expect(chartBox.width).toBeGreaterThanOrEqual(400);
    } else {
      expect(chartBox.y).toBeGreaterThan(videoBox.y + videoBox.height);
      expect(chartBox.width).toBeGreaterThanOrEqual(340);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await video.scrollIntoViewIfNeeded();
    await video.evaluate(element => element.play());
    await expect.poll(() => video.evaluate(element => element.duration)).toBeCloseTo(9.6, 1);
    await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0.1);
    await page.locator('#about').scrollIntoViewIfNeeded();
    await expect.poll(() => video.evaluate(element => element.paused)).toBe(true);

    if (process.env.FLY_PORTFOLIO_CAPTURE) {
      await video.evaluate(element => { element.currentTime = 0; });
      await page.setViewportSize({ width, height: 1200 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      for (const theme of ['light', 'dark']) {
        await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
        await page.evaluate(() => {
          const media = document.querySelector('#fly-visuals');
          const header = document.querySelector('.site-header');
          window.scrollTo({ top: media.getBoundingClientRect().top + scrollY - header.offsetHeight - 20, behavior: 'instant' });
        });
        await expect(page.locator('.fly-replay h4')).toBeInViewport();
        await page.locator('#fly-visuals').screenshot({ path: `output/fly-figure-20261020/presentation-${width}-${theme}.png` });
      }
    }
  });
}

test.describe('homepage methods without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('native disclosures support keyboard use and the synthetic-study deep link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#fly-preview')).toHaveAttribute('controls', '');
    await expect(page.locator('#fly-preview source')).toHaveAttribute('src', './assets/portfolio/fly-preview-20261020.mp4');
    await expect(page.locator('.fly-comparison img')).toBeVisible();
    for (const id of ['morphbrain', 'model-morpher', 'morphliner']) {
      const details = page.locator(`#${id} .project__body > details`);
      const summary = details.locator(':scope > summary');
      await expect(details).not.toHaveAttribute('open');
      await summary.focus();
      await expect(summary).toBeFocused();
      await summary.press('Enter');
      await expect(details).toHaveAttribute('open', '');
      await expect(details.locator('p').first()).toBeVisible();
      await summary.press('Space');
      await expect(details).not.toHaveAttribute('open');
    }

    await page.goto('/#morphbrain-synthetic-study');
    await expect(page.locator('#morphbrain-notes')).toHaveAttribute('open', '');
    await expect(page.locator('#morphbrain-synthetic-study')).toBeVisible();
  });
});
