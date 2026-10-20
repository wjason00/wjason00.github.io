// Crop the existing one-error, five-seed diagnostic plots at a native mobile width.
// No fitting, resampling, numerical calculation or figure modification occurs here.
// Start the source server first: node scripts/serve-static.mjs . 4189
// Then: node scripts/render-rare-errors-preview.mjs [http://127.0.0.1:4189]
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const base = process.argv[2] || 'http://127.0.0.1:4189';
const output = resolve(root, 'assets/portfolio/rare-errors-results-preview.png');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 1600 }, deviceScaleFactor: 2, colorScheme: 'light' });
  await page.goto(`${base}/rare-errors.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const result = page.locator('.diagnostics-heading');
  await page.locator('[data-overview="purity"]').getByText('97.63%', { exact: true }).waitFor();
  await page.locator('[data-overview="ratio"]').getByText('4.14\u00d7', { exact: true }).waitFor();
  await page.locator('#seed-diagnostics').evaluate((element) => { element.open = true; });
  // Keep the crop below the sticky controls without hiding or altering the plots.
  await result.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 380));
  const first = await result.boundingBox();
  const last = await page.locator('#seed-diagnostics .result-note').boundingBox();
  if (!first || !last) throw new Error('Result summary is not visible');
  if (Math.ceil(first.width) !== 350) throw new Error(`Expected a native 350px reading width, got ${first.width}`);
  const clip = { x: Math.floor(first.x) - 12, y: Math.floor(first.y) - 12, width: Math.ceil(first.width) + 24, height: Math.ceil(last.y + last.height - first.y) + 24 };
  await page.screenshot({ path: output, clip, animations: 'disabled' });
  const canonicalHash = (name) => createHash('sha256').update(readFileSync(resolve(root, name), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
  writeFileSync(resolve(root, 'assets/portfolio/rare-errors-results-preview.json'), JSON.stringify({
    description: 'Unmodified screenshot crop of the existing one-error attribution and reconstruction-error plots; synthetic data, one population, five noise seeds.',
    selected_errors_per_stimulus: 1,
    crop_css_pixels: clip,
    image_pixels: { width: clip.width * 2, height: clip.height * 2 },
    source_sections: ['rare-errors.html: #seed-diagnostics .diagnostics-heading through .result-note (two existing SVG plots)', 'assets/portfolio/study.js: select(1) and metric()', 'assets/portfolio/rare-errors/data.js'],
    source_study_provenance: 'assets/portfolio/rare-errors/provenance.json',
    source_sha256_utf8_lf: Object.fromEntries(['rare-errors.html', 'assets/portfolio/study.js', 'assets/portfolio/rare-errors/data.js'].map((name) => [name, canonicalHash(name)])),
    generator: 'scripts/render-rare-errors-preview.mjs',
  }, null, 2) + '\n');
  console.log(`Saved ${output}: ${clip.width * 2} x ${clip.height * 2} px`);
} finally {
  await browser.close();
}
