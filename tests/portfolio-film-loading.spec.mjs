import { expect, test } from '@playwright/test';

const frameRoute = /\/assets\/portfolio\/journey\/(morpher|morphliner)\/f\d{3}\.webp(?:\?.*)?$/;
const projects = [
  { key: 'morpher', poster: '/assets/portfolio/spatial/portal-media/morpher-middle.jpg', recording: '/assets/model-morpher/dentate-to-brain.mp4' },
  { key: 'morphliner', poster: '/assets/portfolio/spatial/studio-media/morphliner-export.jpg', recording: '/assets/portfolio/morphliner-demo.mp4' },
];

function film(page, project) { return page.locator(`.jr-${project.key} .jr-film-wrap`); }

async function openJourney(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Held image requests must not make navigation wait for the window load event.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-journey', 'ready');
}

async function positionFilm(page, project, progress = .3) {
  await page.evaluate(({ key, progress }) => {
    const trigger = window.ScrollTrigger.getAll().find(item => item.trigger?.classList.contains(`jr-${key}`));
    if (!trigger) throw new Error(`Missing ${key} scroll stage`);
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo({ top: trigger.start + (trigger.end - trigger.start) * progress, behavior: 'instant' });
  }, { key: project.key, progress });
  await expect(film(page, project)).toBeInViewport();
}

async function expectPoster(page, project) {
  const wrap = film(page, project), poster = wrap.locator('.jr-film-poster');
  await expect(poster).toBeVisible();
  await expect(poster).toHaveAttribute('src', project.poster);
  await expect.poll(() => poster.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(wrap.locator('canvas')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator(`.jr-${project.key} .jr-clock`)).toContainText('Poster preview');
}

async function expectRealFrame(page, project) {
  const wrap = film(page, project), canvas = wrap.locator('canvas');
  await expect(wrap).toHaveAttribute('data-state', 'ready');
  await expect(wrap.locator('.jr-film-poster')).toBeHidden();
  await expect(wrap.locator('.jr-film-status')).toBeHidden();
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveCSS('visibility', 'visible');
  // A nonuniform native canvas establishes that a real decoded image was drawn.
  await expect.poll(() => canvas.evaluate(node => {
    const pixels = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 1024) {
      colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
      if (colors.size > 8) return colors.size;
    }
    return colors.size;
  })).toBeGreaterThan(3);
  await expect(page.locator(`.jr-${project.key} .jr-clock`)).not.toContainText('Poster preview');
}

function captureErrors(page) {
  const errors = [];
  // Network aborts below are intentional; uncaught native page errors are not.
  page.on('pageerror', error => errors.push(error.stack || error.message));
  return errors;
}

test('failed film sequences retain real posters, recording links and a working Retry', async ({ page }) => {
  const errors = captureErrors(page), blocked = new Set(projects.map(project => project.key));
  await page.route(frameRoute, route => blocked.has(route.request().url().match(frameRoute)[1]) ? route.abort() : route.continue());
  await openJourney(page);
  for (const project of projects) {
    await positionFilm(page, project);
    const wrap = film(page, project);
    await expect(wrap).toHaveAttribute('data-state', 'failed', { timeout: 15000 });
    await expectPoster(page, project);
    await expect(wrap.locator('.jr-film-status')).toContainText('Preview unavailable');
    const details = wrap.getByRole('link', { name: 'Recording and details' });
    await expect(details).toHaveAttribute('href', `#sheet-${project.key}`);
    await details.click();
    await expect(page).toHaveURL(new RegExp(`#sheet-${project.key}$`));
    const recording = page.locator(`#sheet-${project.key} video`).first();
    await expect(recording.locator('source')).toHaveAttribute('src', project.recording);
    expect(await recording.evaluate(video => video.controls && video.paused && !video.autoplay)).toBe(true);
    await positionFilm(page, project);
    blocked.delete(project.key);
    const retry = wrap.getByRole('button', { name: 'Retry', exact: true });
    await retry.focus();
    await retry.press('Enter');
    await expectRealFrame(page, project);
  }
  expect(errors).toEqual([]);
});

test('delayed first frames keep the poster and later pending batches keep the first real frame', async ({ page }) => {
  const errors = captureErrors(page), gates = new Map();
  for (const project of projects) {
    const gate = {};
    gate.first = new Promise(resolve => { gate.releaseFirst = resolve; });
    gate.batch = new Promise(resolve => { gate.releaseBatch = resolve; });
    gates.set(project.key, gate);
  }
  await page.route(frameRoute, async route => {
    const url = route.request().url(), gate = gates.get(url.match(frameRoute)[1]);
    await (/\/f001\.webp(?:\?|$)/.test(url) ? gate.first : gate.batch);
    await route.continue();
  });
  try {
    await openJourney(page);
    for (const project of projects) {
      await positionFilm(page, project);
      const wrap = film(page, project), gate = gates.get(project.key);
      await expect(wrap).toHaveAttribute('data-state', 'loading');
      await expectPoster(page, project);
      await expect(wrap.locator('.jr-film-status')).toContainText('Loading recording preview');
      await expect(wrap.getByRole('button', { name: 'Retry', exact: true })).toBeHidden();
      gate.releaseFirst();
      await expectRealFrame(page, project);
      // All later frame requests are still held: scrubbing must retain the frame
      // already drawn rather than revealing an empty canvas or returning to a poster.
      await positionFilm(page, project, .6);
      await expectRealFrame(page, project);
      gate.releaseBatch();
    }
    expect(errors).toEqual([]);
  } finally {
    for (const gate of gates.values()) { gate.releaseFirst(); gate.releaseBatch(); }
  }
});

test('missing frames use the nearest actual image and do not advance its displayed time', async ({ page }) => {
  const errors = captureErrors(page);
  // Permit the authentic first frame only. Every later requested frame is missing.
  await page.route(frameRoute, route => /\/f001\.webp(?:\?|$)/.test(route.request().url()) ? route.continue() : route.abort());
  await openJourney(page);
  for (const project of projects) {
    await positionFilm(page, project, .2);
    await expectRealFrame(page, project);
    const wrap = film(page, project), clock = page.locator(`.jr-${project.key} .jr-clock`);
    const firstTime = await clock.textContent();
    const firstImage = await wrap.locator('canvas').evaluate(canvas => canvas.toDataURL());
    const firstScroll = await page.evaluate(() => scrollY);
    await positionFilm(page, project, .65);
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(firstScroll);
    await expectRealFrame(page, project);
    await expect(clock).toHaveText(firstTime);
    expect(await wrap.locator('canvas').evaluate(canvas => canvas.toDataURL())).toBe(firstImage);
  }
  expect(errors).toEqual([]);
});
