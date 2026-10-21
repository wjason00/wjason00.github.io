// Replot the frozen one-error results. No fitting, resampling or simulation.
// node scripts/render-rare-errors-preview.mjs
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const stem = 'assets/portfolio/rare-errors-results-preview';
const hash = value => createHash('sha256').update(value).digest('hex');
const canonical = value => String(value).replaceAll('\r\n', '\n');
const sourcePath = 'assets/portfolio/rare-errors/metrics.csv';
const dataPath = 'assets/portfolio/rare-errors/data.js';
const colours = ['#376b91', '#a05e22', '#7461a6', '#287c75', '#a04d68'];
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');

export function frozenResults() {
  const bytes = readFileSync(resolve(root, sourcePath));
  const provenance = JSON.parse(readFileSync(resolve(root, 'assets/portfolio/rare-errors/provenance.json')));
  assert.equal(hash(bytes), provenance.sha256['metrics.csv'], 'Frozen metric source hash changed');
  const [heading, ...lines] = canonical(bytes).trim().split('\n');
  const fields = heading.split(',');
  // The frozen public export has no quoted fields; refuse silent CSV changes.
  assert.ok(!lines.some(line => line.includes('"')));
  const rows = lines.map(line => Object.fromEntries(line.split(',').map((value, i) => [fields[i], value])));
  const selected = rows.filter(row => row.condition === 'choice_present' && row.model === 'dPCA' && row.status === 'fit' && Number(row.errors_per_stimulus) === 1).sort((a, b) => a.noise_seed - b.noise_seed);
  assert.deepEqual(selected.map(row => Number(row.noise_seed)), [0, 1, 2, 3, 4]);
  const saved = JSON.parse(readFileSync(resolve(root, dataPath), 'utf8').match(/window\.rareErrorResults = ([\s\S]*);\s*$/)[1])['1'];
  const metrics = [
    { key: 'choice_intended_purity', title: 'Choice attribution', direction: 'Higher = more choice-driven', max: 1, percent: true, firstY: 178 },
    { key: 'choice_branch_target_nmse', title: 'Choice reconstruction error', direction: 'Lower = closer to target', max: .12, percent: false, firstY: 471 },
  ].map(metric => {
    const values = selected.map(row => Number(row[metric.key]));
    assert.deepEqual(values, saved[metric.key].values, `Source values disagree with existing presentation: ${metric.key}`);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    assert.ok(Math.abs(mean - saved[metric.key].mean) < 1e-15);
    return { ...metric, values, mean: saved[metric.key].mean, min: Math.min(...values), maxValue: Math.max(...values) };
  });
  return { metrics, sourceHash: hash(bytes), selectedSeeds: selected.map(row => Number(row.noise_seed)) };
}

export function renderRareErrors({ metrics }) {
  const format = (value, metric) => metric.percent ? `${(100 * value).toFixed(2)}%` : value.toFixed(4);
  const panels = metrics.map(metric => {
    const first = metric.firstY;
    const axis = first + 116;
    const points = metric.values.map((value, seed) => `<text x="62" y="${first + seed * 24 + 7}" text-anchor="end" class="seed-label">${seed}</text><circle data-metric="${metric.key}" data-seed="${seed}" data-value="${value}" cx="${80 + 470 * value / metric.max}" cy="${first + seed * 24}" r="6.5" fill="${colours[seed]}"><title>Seed ${seed}: ${format(value, metric)}</title></circle>`).join('\n');
    const ticks = Array.from({ length: 5 }, (_, i) => {
      const x = 80 + 470 * i / 4;
      const label = metric.percent ? `${25 * i}%` : (metric.max * i / 4).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      return `<line x1="${x}" x2="${x}" y1="${first - 13}" y2="${axis}" stroke="#e1e6e8"/><text x="${x}" y="${axis + 28}" text-anchor="middle" class="tick">${label}</text>`;
    }).join('\n');
    return `<g data-panel="${metric.key}">
      <text class="panel-title" x="28" y="${first - 62}">${escape(metric.title)}</text>
      <text class="direction" x="28" y="${first - 33}">${escape(metric.direction)}</text>
      <text class="mean" x="558" y="${first - 62}" text-anchor="end">${format(metric.mean, metric)}</text>
      <text class="direction" x="558" y="${first - 33}" text-anchor="end">mean</text>
      ${ticks}<line x1="80" x2="550" y1="${axis}" y2="${axis}" stroke="#8c9ca7"/>
      <text class="foot" x="24" y="${first + 48}" text-anchor="middle" transform="rotate(-90 24 ${first + 48})">Seed</text>${points}
      <text class="range" x="28" y="${axis + 67}">Full seed range: ${format(metric.min, metric)}–${format(metric.maxValue, metric)}</text>
    </g>`;
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720" viewBox="0 0 600 720" role="img" aria-labelledby="rare-title rare-desc">
    <title id="rare-title">Choice attribution and reconstruction at one error per stimulus</title>
    <desc id="rare-desc">Saved synthetic results in a fixed population. All five noise seeds are shown and labelled by row. Upper plot: choice attribution, zero to 100 percent. Lower plot: choice reconstruction error, zero to 0.12. These are different measures with separate scales. Means appear beside each title; full seed ranges are not confidence intervals. No biological data.</desc>
    <metadata>Source: assets/portfolio/rare-errors/metrics.csv. Exact values and hashes: rare-errors-results-preview.json. Rebuild: node scripts/render-rare-errors-preview.mjs.</metadata>
    <style>text{font-family:Arial,sans-serif;fill:#243446}.heading{font-size:28px;font-weight:600}.subtitle{font-size:22px;fill:#526574}.panel-title{font-size:23px;font-weight:600}.mean{font-size:30px;font-weight:600}.direction,.tick,.range,.seed-label{font-size:21px;fill:#526574}.foot{font-size:20px;fill:#526574}</style>
    <rect width="600" height="720" fill="#fff"/>
    <text class="heading" x="28" y="36">One error per stimulus</text>
    <text class="subtitle" x="28" y="66">dPCA · choice-present · 5 noise seeds</text>
    <text class="foot" x="28" y="92">Fixed synthetic population · one of six trial mixes</text>
    ${panels}
    <text class="foot" x="28" y="687">Separate scales · each point is one noise seed</text>
    <text class="foot" x="28" y="713">Full ranges across seeds; no confidence intervals</text>
  </svg>\n`;
}

export async function buildRareErrors() {
  const results = frozenResults();
  const svg = renderRareErrors(results);
  writeFileSync(resolve(root, `${stem}.svg`), svg);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 600, height: 720 }, deviceScaleFactor: 2 });
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await page.screenshot({ path: resolve(root, `${stem}.png`), animations: 'disabled' });
  } finally { await browser.close(); }
  const fingerprint = name => ({ path: name, sha256: hash(readFileSync(resolve(root, name))), sha256_utf8_lf: hash(canonical(readFileSync(resolve(root, name)))) });
  const receipt = {
    format: 'rare-errors-portfolio-figure-2', description: 'Replot of unchanged saved one-error synthetic results; all five original noise seeds, fixed population, dPCA choice-present condition.',
    selected_errors_per_stimulus: 1, selected_noise_seeds: results.selectedSeeds,
    selection: 'condition=choice_present; model=dPCA; status=fit; errors_per_stimulus=1; noise_seed ascending. Same condition as the previous screenshot preview.',
    sources: [sourcePath, dataPath, 'assets/portfolio/rare-errors/provenance.json', 'assets/portfolio/study.css'].map(fingerprint),
    metrics: results.metrics.map(({ key, values, mean, min, maxValue, max, percent }) => ({ key, values, mean, min, max: maxValue, axis_domain: [0, max], percent })),
    uncertainty: 'All five seed observations and full min–max range. Not independent biological replicates or confidence intervals.',
    palette: Object.fromEntries(colours.map((colour, seed) => [seed, colour])), palette_source: 'Original light-mode seed palette in assets/portfolio/study.css; unchanged.',
    image_pixels: { width: 1200, height: 1440 }, dimensions_css_pixels: { width: 600, height: 720 },
    outputs: [`${stem}.svg`, `${stem}.png`].map(fingerprint),
    checks: { frozen_source_hash: true, all_10_values_equal_existing_presentation: true, all_5_seeds_included: true, previous_axes_preserved: true, palette_preserved: true },
    generator: 'node scripts/render-rare-errors-preview.mjs', claim_boundary: 'Presentation only; no new fit, simulation, inference or biological result.'
  };
  writeFileSync(resolve(root, `${stem}.json`), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`Saved ${stem}.svg and .png; all 10 values / 5 seeds verified, original domains preserved.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await buildRareErrors();
