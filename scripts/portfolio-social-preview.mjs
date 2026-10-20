// Render the sharing card from current portfolio type, palette and the actual fly preview.
// Start a local preview, then set PORTFOLIO_CAPTURE_BASE and run this script.
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const root = resolve(import.meta.dirname, "..");
const base = process.env.PORTFOLIO_CAPTURE_BASE || "http://127.0.0.1:4180";
const output = resolve(root, process.env.PORTFOLIO_CAPTURE_OUTPUT || "output/portfolio-social-preview");
mkdirSync(output, { recursive: true });
// The existing replay preview is scaled proportionally; source pixels are not edited.
const markup = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Source;src:url('${base}/assets/fonts/source-sans-3-400.woff2')}
@font-face{font-family:Source;src:url('${base}/assets/fonts/source-sans-3-600.woff2');font-weight:600}
*{box-sizing:border-box}p,h1,figure{margin:0}body{margin:0;width:1200px;height:630px;background:#f4f6f7;color:#24333d;font-family:Source,Arial,sans-serif}
main{height:630px;padding:48px 52px;display:grid;grid-template-columns:460px 584px;gap:52px;align-items:center}
h1{font-size:70px;font-weight:600;line-height:1.05;letter-spacing:-2.1px}.meta{font-size:30px;line-height:1.3;color:#5e6d77;margin-top:14px}
.text{font-size:28px;line-height:1.4;margin-top:43px;max-width:28ch}.url{font-size:19px;color:#5e6d77;margin-top:48px}
.stage{overflow:hidden;background:#ecf1f5;border:1px solid #d2dbe0}.stage img{display:block;width:582px;height:327.375px;object-fit:contain}.caption{padding:19px 22px 21px;border-top:1px solid #d2dbe0;background:#fff;font-size:23px;line-height:1.2;font-weight:600}
</style></head><body><main><div><h1>Jason Wang</h1><p class="meta">Neuroscience at UCL</p><p class="text">I’m interested in how neurons interact and what we can learn from recordings.</p><p class="url">wjason00.github.io</p></div><figure class="stage"><img src="${base}/assets/portfolio/fly-preview-20261020.webp" alt="Whole fly and mouth detail from the illustrative 3D replay"><figcaption class="caption">Illustrative fly replay</figcaption></figure></main></body></html>`;
writeFileSync(resolve(output, "social-preview-source.html"), markup);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, bypassCSP: true });
  await page.goto(base);
  await page.setContent(markup);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode()));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const checks = await page.evaluate(() => {
    const inside = (el) => {
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.top >= 0 && r.right <= 1200 && r.bottom <= 630;
    };
    return {
      width: innerWidth, height: innerHeight,
      scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
      images: [...document.images].every((i) => i.complete && i.naturalWidth > 0),
      imageSizes: [...document.images].map((i) => ({ src: i.getAttribute("src").split("/").pop(), natural: [i.naturalWidth, i.naturalHeight] })),
      fonts: ["600 20px Source", "20px Source"].every((f) => document.fonts.check(f)),
      contained: [...document.querySelectorAll("main > *, .stage *")].every(inside),
    };
  });
  if (checks.scrollWidth !== 1200 || checks.scrollHeight !== 630 || !checks.images || !checks.fonts || !checks.contained)
    throw new Error("Social-card layout/image check failed: " + JSON.stringify(checks));
  await page.screenshot({ path: resolve(root, "assets/og-portfolio.png") });
  writeFileSync(resolve(output, "social-preview-checks.json"), JSON.stringify({ at: new Date().toISOString(), ...checks, passed: true }, null, 2) + "\n");
} finally {
  await browser.close();
}
console.log("Saved assets/og-portfolio.png (1200 x 630).");
