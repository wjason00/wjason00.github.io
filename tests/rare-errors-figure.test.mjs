import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { frozenResults, renderRareErrors } from '../scripts/render-rare-errors-preview.mjs';

const root = new URL('../', import.meta.url);
const read = name => readFileSync(new URL(name, root), 'utf8');
const svg = read('assets/portfolio/rare-errors-results-preview.svg');
const receipt = JSON.parse(read('assets/portfolio/rare-errors-results-preview.json'));
const saved = JSON.parse(read('assets/portfolio/rare-errors/data.js').match(/window\.rareErrorResults = ([\s\S]*);\s*$/)[1])['1'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonicalText = bytes => String(bytes).replaceAll('\r\n', '\n');

test('all ten plotted points preserve original seed identity, exact value, colour and full axis domain', () => {
  const points = [...svg.matchAll(/<circle data-metric="([^"]+)" data-seed="(\d)" data-value="([^"]+)" cx="([^"]+)" cy="([^"]+)" r="6\.5" fill="([^"]+)"/g)];
  assert.equal(points.length, 10);
  const styles = read('assets/portfolio/study.css');
  for (const metric of receipt.metrics) {
    const selected = points.filter(point => point[1] === metric.key);
    assert.deepEqual(selected.map(point => Number(point[2])), [0, 1, 2, 3, 4]);
    assert.deepEqual(selected.map(point => Number(point[3])), saved[metric.key].values);
    assert.equal(metric.mean, saved[metric.key].mean);
    assert.equal(metric.min, saved[metric.key].min);
    assert.equal(metric.max, saved[metric.key].max);
    assert.deepEqual(metric.axis_domain, metric.key === 'choice_intended_purity' ? [0, 1] : [0, .12]);
    for (const point of selected) {
      const [, , seed, value, x, , colour] = point;
      assert.equal(Number(x), 80 + 470 * Number(value) / metric.axis_domain[1]);
      assert.match(styles, new RegExp(`--seed-${seed}: ${colour};`));
    }
  }
  assert.match(svg, /Separate scales/);
  assert.match(svg, /no confidence intervals/);
  assert.match(svg, /Fixed synthetic population/);
});

test('generated vector and output receipt reproduce the frozen source without a browser-side fit', () => {
  assert.equal(renderRareErrors(frozenResults()), svg);
  for (const source of receipt.sources) {
    const bytes = readFileSync(new URL(source.path, root));
    if (source.path.endsWith('.csv')) {
      // Frozen study downloads preserve exact bytes via .gitattributes.
      assert.equal(hash(bytes), source.sha256);
    } else {
      // Presentation text can have CRLF on Windows and LF in Git/Linux.
      const unix = canonicalText(bytes);
      assert.equal(hash(unix), source.sha256_utf8_lf);
      assert.equal(hash(canonicalText(unix.replaceAll('\n', '\r\n'))), source.sha256_utf8_lf);
    }
  }
  // Generated SVG is explicitly -text; binary PNG remains byte-exact.
  for (const output of receipt.outputs) assert.equal(hash(readFileSync(new URL(output.path, root))), output.sha256);
  assert.deepEqual(receipt.selected_noise_seeds, [0, 1, 2, 3, 4]);
  assert.equal(receipt.selected_errors_per_stimulus, 1);
  assert.match(receipt.claim_boundary, /no new fit, simulation, inference or biological result/);
});
