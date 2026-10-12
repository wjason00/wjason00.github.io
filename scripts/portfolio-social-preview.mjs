// Render the sharing card using the current portfolio type, palette and original MorphBrain canvases.
// Start the local preview on 4180, then: node scripts/portfolio-social-preview.mjs
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const root = resolve(import.meta.dirname, "..");
const base = process.env.PORTFOLIO_CAPTURE_BASE || "http://127.0.0.1:4180";
const output = resolve(
  root,
  process.env.PORTFOLIO_CAPTURE_OUTPUT || "output/portfolio-social-preview",
);
mkdirSync(output, { recursive: true });
// Canvases are only scaled for display (object-fit: contain, smooth scaling); pixels are not altered.
const markup = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Source;src:url('${base}/assets/fonts/source-sans-3-400.woff2')}
@font-face{font-family:Source;src:url('${base}/assets/fonts/source-sans-3-600.woff2');font-weight:600}
@font-face{font-family:Mono;src:url('${base}/assets/fonts/dm-mono-400.woff2')}
*{box-sizing:border-box}p,h1,ul{margin:0}body{margin:0;width:1200px;height:630px;background:#f6f5f1;color:#22251f;font-family:Source,Arial,sans-serif}
main{height:630px;padding:48px 52px;display:grid;grid-template-columns:1fr 510px;gap:48px;align-items:center}
.name{font-size:28px;font-weight:600;letter-spacing:-.6px}.meta{font-family:Mono,monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#62665d;margin-top:12px}
h1{font-size:89px;line-height:.96;letter-spacing:-5px;margin:44px 0 25px}h1 span{color:#62665d}.text{font-size:22px;line-height:1.45;max-width:30ch}.url{font-family:Mono,monospace;font-size:12px;margin-top:34px}
.stage{background:#121611;color:#f6f5f1;border-radius:12px;overflow:hidden}.bar{padding:18px 22px;font-size:13px;display:flex;justify-content:space-between;border-bottom:1px solid #38422e}.bar span{color:#d7f18b}
.panel{display:flex;gap:28px;padding:25px 27px 22px}.frame{width:214px}.canvas{width:214px;height:321px}.canvas img{display:block;width:100%;height:100%;object-fit:contain}.label{font-size:14px;margin-top:12px;color:#c7cbbb}.foot{background:#d7f18b;color:#22251f;padding:17px 22px;font-size:18px;font-weight:600}
</style></head><body><main><div><p class="name">Jason Wang</p><p class="meta">Neuroscience · UCL · Research interests</p><h1>Models to<br><span>think with.</span></h1><p class="text">Exploring computational neuroscience and machine learning through models and data.</p><p class="url">wjason00.github.io</p></div><div class="stage"><p class="bar">MorphBrain <span>Illustrative model</span></p><div class="panel"><div class="frame"><div class="canvas"><img src="${base}/assets/portfolio/morphbrain-field.png" alt=""></div><p class="label">Concentration field</p></div><div class="frame"><div class="canvas"><img src="${base}/assets/portfolio/morphbrain-regions.png" alt=""></div><p class="label">Positional readout</p></div></div><p class="foot">From signals to patterns. ↗</p></div></main></body></html>`;
writeFileSync(resolve(output, "social-preview-source.html"), markup);
const browser = await chromium.launch();
try {
  // Build-only inline CSS; published pages retain their strict CSP.
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    bypassCSP: true,
  });
  await page.goto(base);
  await page.setContent(markup);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  });
  const checks = await page.evaluate(() => {
    const inside = (el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= 1200 && r.bottom <= 630;
    };
    return {
      width: innerWidth,
      height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      images: [...document.images].every(
        (i) => i.complete && i.naturalWidth > 0,
      ),
      imageSizes: [...document.images].map((i) => ({
        src: i.getAttribute("src").split("/").pop(),
        natural: [i.naturalWidth, i.naturalHeight],
      })),
      fonts: ["600 20px Source", "20px Mono"].every((f) =>
        document.fonts.check(f),
      ),
      contained: [...document.querySelectorAll("main > *, .stage *")].every(
        inside,
      ),
    };
  });
  if (
    checks.scrollWidth !== 1200 ||
    checks.scrollHeight !== 630 ||
    !checks.images ||
    !checks.fonts ||
    !checks.contained
  )
    throw new Error(
      "Social-card layout/image check failed: " + JSON.stringify(checks),
    );
  await page.screenshot({ path: resolve(root, "assets/og-portfolio.png") });
  writeFileSync(
    resolve(output, "social-preview-checks.json"),
    JSON.stringify(
      { at: new Date().toISOString(), ...checks, passed: true },
      null,
      2,
    ) + "\n",
  );
} finally {
  await browser.close();
}
console.log("Saved assets/og-portfolio.png (1200 × 630).");
