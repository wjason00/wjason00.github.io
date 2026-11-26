import { expect, test } from '@playwright/test';

const surfaceModule = /\/surface-(?:viewer|data)\.js(?:\?|$)/;
const viewerModule = '**/surface-viewer.js*';
const softwareGraphics = [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-webgl',
  '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
];

async function withSurfacePage(playwright, baseURL, check) {
  const browser = await playwright.chromium.launch({ args: softwareGraphics });
  try {
    const context = await browser.newContext({ baseURL, viewport: { width: 1280, height: 900 } });
    await check(await context.newPage());
  } finally {
    await browser.close();
  }
}

async function openPage(page) {
  await page.goto('/');
  await page.waitForFunction(() => ['ready', 'failed'].includes(document.documentElement.dataset.journey));
  await expect(page.locator('[data-inspect-surface]')).toHaveText('Inspect in 3D');
}

async function showSurface(page) {
  const host = page.locator('[data-surface]');
  await host.scrollIntoViewIfNeeded();
  await expect(host).toBeInViewport();
  return host;
}

async function expectReady(host) {
  await expect(host).toHaveAttribute('data-surface-state', 'ready');
  await expect(host.locator('canvas')).toHaveAttribute('data-surface-ready', 'true');
  await expect.poll(() => host.locator('canvas').evaluate(canvas => Number(canvas.dataset.surfaceRenderCount))).toBeGreaterThan(0);
  await expect(host.locator('.portal-surface-poster')).toBeHidden();
  await expect(host.locator('.portal-surface-tools')).toBeVisible();
}

test('surface imports require keyboard activation; real saved frames render and close safely', async ({ playwright, baseURL }) => {
  await withSurfacePage(playwright, baseURL, async page => {
    const requests = [];
    page.on('request', request => { if (surfaceModule.test(request.url())) requests.push(request.url()); });
    await openPage(page);
    expect(requests).toEqual([]);
    const host = await showSurface(page);
    const inspect = host.getByRole('button', { name: 'Inspect in 3D', exact: true });
    await inspect.hover();
    // Let intersection and hover handlers run before testing the absence of requests.
    await page.waitForTimeout(200);
    expect(requests).toEqual([]);
    await expect(host.locator('.portal-surface-poster')).toBeVisible();
    await expect(host.locator('.portal-surface-tools')).toBeHidden();
    expect(await inspect.evaluate(button => button.tagName)).toBe('BUTTON');
    await inspect.focus();
    await inspect.press('Enter');
    await expectReady(host);
    expect(requests.filter(url => /\/surface-viewer\.js/.test(url))).toHaveLength(1);
    expect(requests.filter(url => /\/surface-data\.js/.test(url))).toHaveLength(1);

    // Read the real WebGL framebuffer, rather than substituting a viewer or readiness flag.
    expect(await host.locator('canvas').evaluate(canvas => {
      const gl = canvas.getContext('webgl');
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      return pixels.some((value, index) => index % 4 === 3 && value > 0);
    })).toBe(true);
    expect(await host.locator('[data-frame]').evaluateAll(buttons => buttons.map(button => button.dataset.frame))).toEqual(['0', '15', '29']);
    await expect(host.locator('input[type="range"]')).toHaveCount(0);
    for (const frame of ['0', '15', '29']) {
      const button = host.locator(`[data-frame="${frame}"]`);
      await button.click();
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect(host.locator('canvas')).toHaveAttribute('data-surface-frame', frame);
      await expect(page.locator('[data-surface-cap]')).toContainText(`exact saved surface ${frame} of 0–29`);
    }
    await host.locator('[data-wire]').click();
    await expect(host.locator('[data-wire]')).toHaveAttribute('aria-pressed', 'true');
    const mountedCanvas = await host.locator('canvas').elementHandle();
    await host.getByRole('button', { name: 'Close 3D', exact: true }).click();
    await expect(host).toHaveAttribute('data-surface-state', 'idle');
    expect(await mountedCanvas.evaluate(canvas => canvas.isConnected)).toBe(false);
    expect(await mountedCanvas.evaluate(canvas => canvas.dataset.surfaceReady)).toBe('false');
    await expect(host.locator('canvas')).toHaveAttribute('tabindex', '-1');
    await expect(host.locator('.portal-surface-poster')).toBeVisible();
    await expect(host.locator('.portal-surface-tools')).toBeHidden();
    await expect(inspect).toBeFocused();
    await inspect.press('Enter');
    await expectReady(host);
    await expect(host.locator('canvas')).toHaveAttribute('data-surface-frame', '29');
    await expect(host.locator('[data-wire]')).toHaveAttribute('aria-pressed', 'true');
    expect(requests).toHaveLength(2);
    expect(await page.locator('video').evaluateAll(videos => videos.every(video => video.paused && !video.autoplay))).toBe(true);
  });
});

test('cancelling a pending surface import preserves the poster and prevents a late mount', async ({ playwright, baseURL }) => {
  await withSurfacePage(playwright, baseURL, async page => {
    let releaseDownload;
    const gate = new Promise(resolve => { releaseDownload = resolve; });
    await page.route(viewerModule, async route => { await gate; await route.continue(); });
    try {
      await openPage(page);
      const host = await showSurface(page);
      const moduleRequested = page.waitForRequest(surfaceModule);
      await host.getByRole('button', { name: 'Inspect in 3D', exact: true }).click();
      await moduleRequested;
      await expect(host).toHaveAttribute('data-surface-state', 'loading');
      const loading = host.getByRole('button', { name: 'Loading 3D…', exact: true });
      await expect(loading).toBeDisabled();
      await expect(loading).toHaveAttribute('aria-busy', 'true');
      await expect(host.locator('.portal-inspect-status')).toContainText('Loading the saved surfaces');
      await expect(page.locator('[data-surface-cap]')).toContainText('Loading 3D inspection');
      await expect(host.locator('.portal-surface-poster')).toBeVisible();
      await expect(host.locator('.portal-surface-tools')).toBeHidden();
      await host.getByRole('button', { name: 'Cancel loading', exact: true }).click();
      const dataResponse = page.waitForResponse(/\/surface-data\.js(?:\?|$)/);
      releaseDownload();
      await (await dataResponse).finished();
      // Allow the real dependency module to evaluate and the stale import callback to run.
      await page.waitForTimeout(250);
      await expect(host).toHaveAttribute('data-surface-state', 'idle');
      await expect(host).not.toHaveClass(/is-mounted|is-ready/);
      await expect(host.locator('canvas')).not.toHaveAttribute('data-surface-ready', 'true');
      await expect(host.locator('.portal-surface-poster')).toBeVisible();
      await expect(host.getByRole('button', { name: 'Inspect in 3D', exact: true })).toBeEnabled();
      await expect(host.locator('.portal-surface-tools')).toBeHidden();
    } finally {
      releaseDownload();
    }
  });
});

test('a failed surface download leaves a useful poster and deliberate retry', async ({ playwright, baseURL }) => {
  await withSurfacePage(playwright, baseURL, async page => {
    await page.route(viewerModule, route => route.abort('failed'));
    await openPage(page);
    const host = await showSurface(page);
    await host.getByRole('button', { name: 'Inspect in 3D', exact: true }).click();
    await expect(host).toHaveAttribute('data-surface-state', 'error');
    await expect(host.locator('.portal-surface-poster')).toBeVisible();
    await expect(host.locator('.portal-surface-tools')).toBeHidden();
    await expect(page.locator('[data-surface-cap]')).toContainText('the recording still plays');
    await expect(host.locator('.portal-inspect-status')).toContainText('reload this page');
    const retry = host.getByRole('button', { name: 'Retry 3D', exact: true });
    await expect(retry).toBeEnabled();
    await retry.focus();
    await retry.press('Enter');
    // A browser may cache the failed ESM import; retry must still settle usefully.
    await expect(host).toHaveAttribute('data-surface-state', 'error');
    await expect(retry).toBeEnabled();
    await expect(host.locator('.portal-surface-poster')).toBeVisible();
  });
});
