// Capture the unchanged shipped MorphBrain canvases and extract an existing
// Model Morpher recording frame. No scientific output is generated or retouched.
// Run the static preview on 4187, then: node scripts/portfolio-thumbnails.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const out = resolve(root, 'output/redesign-20260926');
const assets = resolve(root, 'assets/portfolio');
const base = process.env.PORTFOLIO_CAPTURE_BASE || 'http://127.0.0.1:4187';
const mobileOnly = process.argv.includes('--mobile-only');
mkdirSync(out, { recursive: true });
mkdirSync(assets, { recursive: true });
const browser = await chromium.launch();
let capture;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  if (mobileOnly) {
    const saved = JSON.parse(readFileSync(resolve(out, 'thumbnail-provenance.json'), 'utf8'));
    capture = saved.morphbrain.canvases.map((metadata, index) => ({
      ...metadata,
      data: `data:image/png;base64,${readFileSync(resolve(out, `thumbnail-brain-canvas-${index}.png`)).toString('base64')}`,
    }));
  } else {
  await page.goto(`${base}/demos/morphbrain/`);
  await page.getByText('Run converged', { exact: true }).first().waitFor();
  capture = await page.locator('canvas').evaluateAll(canvases => canvases.map(canvas => ({
    data: canvas.toDataURL(),
    width: canvas.width,
    height: canvas.height,
    frameRadius: getComputedStyle(canvas.parentElement).borderRadius,
    ariaLabel: canvas.getAttribute('aria-label'),
  })));
  const outputText = await page.locator('body').innerText();
  writeFileSync(resolve(out, 'thumbnail-morphbrain-source-state.txt'), outputText);
  capture.forEach((canvas, index) => writeFileSync(
    resolve(out, `thumbnail-brain-canvas-${index}.png`),
    Buffer.from(canvas.data.split(',')[1], 'base64'),
  ));
  }
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face { font-family: Source; src: url('data:font/woff2;base64,${readFileSync(resolve(root, 'assets/fonts/source-sans-3-400.woff2')).toString('base64')}'); }
    * { box-sizing: border-box; }
    body { margin: 0; width:1200px; height:800px; background:#132622; color:#f1eee5; font:26px Source, sans-serif; }
    main { height:100%; display:grid; grid-template-columns:1fr 1fr; padding:58px 80px 38px; column-gap:100px; }
    figure { margin:0; text-align:center; display:flex; flex-direction:column; align-items:center; }
    h2 { font-size:28px; font-weight:400; margin:0 0 32px; letter-spacing:-.4px; }
    img { width:340px; height:510px; image-rendering:pixelated; overflow:hidden; }
    .field { border-radius:${capture[0].frameRadius}; }
    .readout { border-radius:${capture[1].frameRadius}; }
    figcaption { font-size:20px; margin-top:30px; color:#c3cdc5; }
    .key { display:inline-block; height:10px; width:10px; border-radius:50%; margin:0 7px 1px 14px; }
  </style></head><body><main>
    <figure><h2>Concentration fields</h2><img class="field" src="${capture[0].data}" alt="" />
      <figcaption><span class="key" style="background:#17a9df"></span>BMP <span class="key" style="background:#db9d0d"></span>SHH</figcaption></figure>
    <figure><h2>Positional readout</h2><img class="readout" src="${capture[1].data}" alt="" />
      <figcaption>Same computed state</figcaption></figure>
  </main></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  if (!mobileOnly) await page.screenshot({ path: resolve(out, 'thumbnail-morphbrain-plate.png') });
  await page.setViewportSize({ width: 900, height: 800 });
  await page.addStyleTag({ content: `body {width:900px} main {padding:70px 45px 30px;column-gap:70px} h2 {font-size:32px;line-height:1.2;margin-bottom:28px} figcaption {font-size:27px;line-height:1.2;margin-top:26px}` });
  await page.screenshot({ path: resolve(out, 'thumbnail-morphbrain-mobile-plate.png') });
} finally {
  await browser.close();
}
if (!mobileOnly) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', resolve(out, 'thumbnail-morphbrain-plate.png'), '-c:v', 'libwebp', '-lossless', '1', '-y', resolve(assets, 'morphbrain.webp')]);
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', resolve(out, 'thumbnail-morphbrain-mobile-plate.png'), '-c:v', 'libwebp', '-lossless', '1', '-y', resolve(assets, 'morphbrain-mobile.webp')]);
execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-ss', '4', '-i', resolve(root, 'assets/model-morpher/dentate-to-brain.mp4'), '-vf', 'crop=840:620:30:60,setsar=1', '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '1', '-y', resolve(assets, 'model-morpher.webp')]);
const morphlinerSource = resolve(root, '../Morphliner/frontend/public/marketing/renders/beauty-shade-sweep__poster.webp');
copyFileSync(morphlinerSource, resolve(assets, 'morphliner.webp'));
const sha256 = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const manifest = {
  generatedAt: new Date().toISOString(),
  morphbrain: { width:1200, height:800, source:'demos/morphbrain, default converged reference run', canvases:capture.map(({ data, ...metadata }) => metadata), processing:'Unchanged canvas pixels, same 2:3 physical aspect and equal display size; original app frame radii retained; labels and dark surrounding layout added. No colour or scientific output changes.' },
  morphbrainMobile: { width:900, height:800, source:'Same saved source canvases as desktop MorphBrain plate', processing:'Same 340 by 510 display canvases, unchanged colours and original app frame radii. Narrower margins and gap; labels 32 px and captions 27 px. Desktop plate unchanged.' },
  modelMorpher: { width:840, height:620, source:'assets/model-morpher/dentate-to-brain.mp4', timeSeconds:4, crop:{x:30,y:60,width:840,height:620}, processing:'Lossless decoded-frame crop; no resizing or colour adjustment. Mouse pointer remains in original evidence.' },
  morphliner: { width:1920, height:1080, source:morphlinerSource, sourceSha256:sha256(morphlinerSource), processing:'Original genuine product render copied byte for byte. It is not a frame from the older editor recording.', provenance:'Morphliner frontend/src/content/galleryCopy.ts identifies this featured look poster as a farm render.', videoCaveat:'The similarly named beauty-shade-sweep__loop-16x9.mp4 was inspected and depicts a white capsule/sphere rather than the lipstick poster. It is not copied or used; do not present this poster as a frame from that loop.' },
  assets: ['morphbrain.webp','morphbrain-mobile.webp','model-morpher.webp','morphliner.webp'].map(file => ({ file:`assets/portfolio/${file}`, bytes:statSync(resolve(assets,file)).size, sha256:sha256(resolve(assets,file)) })),
};
writeFileSync(resolve(out, 'thumbnail-provenance.json'), `${JSON.stringify(manifest,null,2)}\n`);
console.log(JSON.stringify(manifest.assets));
