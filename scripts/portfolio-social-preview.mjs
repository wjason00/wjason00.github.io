import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Serve the checkout on port 4187, then run: node scripts/portfolio-social-preview.mjs
const root = resolve(import.meta.dirname, '..');
const base = process.env.PORTFOLIO_CAPTURE_BASE || 'http://127.0.0.1:4187';
const captureUrl = new URL('/__portfolio-share-card', base).href;
const viewport = { width: 1200, height: 630 };
const maxBytes = 150_282;
const home = readFileSync(resolve(root, 'index.html'), 'utf8');
const lede = home.match(/<p class="atlas__lede">([\s\S]*?)<\/p>/)?.[1].trim().replace(/\s+/g, ' ');
if (!lede) throw new Error('Could not read the home hero lede');

const markup = `<!doctype html>
<html lang="en-GB" data-theme="dark">
<head>
  <meta charset="utf-8">
  <title>Jason Wang</title>
  <link rel="stylesheet" href="/assets/portfolio/experience-home.css">
  <style>
    main { display: grid; grid-template-columns: minmax(0, 1fr) 600px; align-items: center;
      height: 630px; padding: 0 30px 0 72px; }
    h1 { font-size: 86px; font-weight: 600; line-height: .88; letter-spacing: -.045em; }
    .lede { margin-top: 30px; max-width: 34ch; font-size: 27px; line-height: 1.38; }
    .url { margin-top: 39px; color: var(--ink-muted); font: 18px/1.4 var(--mono); }
    canvas { width: 600px; height: 470px; }
  </style>
</head>
<body>
  <main>
    <div>
      <h1>Jason Wang</h1>
      <p class="lede">${lede}</p>
      <p class="url">wjason00.github.io</p>
    </div>
    <canvas role="img" aria-label="Point-cloud rendering of a fetal brain atlas surface"></canvas>
  </main>
  <script type="module">
    import { mountScene } from '/assets/portfolio/brain-scene.js';
    await mountScene(document.querySelector('canvas')).ready;
  </script>
</body>
</html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await page.route(captureUrl, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: markup }));
  await page.goto(captureUrl);
  await page.waitForFunction(() => {
    const { pointCount, renderCount } = document.querySelector('canvas').dataset;
    return pointCount === '4096' && Number(renderCount) > 0;
  });
  const fits = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.querySelectorAll('main h1, main p, canvas')].every(element => {
      const box = element.getBoundingClientRect();
      return box.top >= 0 && box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
    }) && ['600 86px "Source Sans 3"', '27px "Source Sans 3"', '18px "DM Mono"'].every(font => document.fonts.check(font));
  });
  if (!fits) throw new Error('Card content overflows or a hero font is unavailable');
  const png = await page.screenshot();
  if (png.length > maxBytes) throw new Error(`Card is ${png.length} bytes, above the ${maxBytes}-byte limit`);
  writeFileSync(resolve(root, 'assets/og-portfolio.png'), png);
  console.log(`Saved assets/og-portfolio.png (${viewport.width} × ${viewport.height}, ${png.length} bytes).`);
} finally {
  await browser.close();
}
