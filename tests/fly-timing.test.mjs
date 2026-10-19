import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boot, createEvidenceState, pairedEffects, safeEvidenceUrl, selectCells, validateData } from '../demos/fly/timing/timing.js';
import { toyTimingEvidence } from './fly-timing-fixture.mjs';

test('complete 30-cell grid selects the exact three conditions for every template and pattern', () => {
  const data = toyTimingEvidence(); assert.equal(validateData(data).pending, false);
  const selected = data.templates.flatMap(template => ['aligned', 'staggered'].flatMap(pattern => selectCells(data, template.id, pattern)));
  assert.equal(selected.length, 30); assert.equal(new Set(selected).size, 30);
  assert.deepEqual(selectCells(data, '1003', 'staggered').map(cell => cell.mn9_count), [42, 32, 22]);
});
test('positive E and positive interaction use direct minus all, then shifted minus aligned', () => {
  const data = toyTimingEvidence(); assert.deepEqual(pairedEffects(data, '1001'), { template_id: '1001', e_aligned: 5, e_staggered: 10, interaction: 5 });
  data.paired_contrasts[0].interaction = -5; assert.throws(() => validateData(data), /reconcile/);
});
test('invalid or unaudited data clears rendered evidence while preserving controls through reload', () => {
  const model = createEvidenceState(); model.accept(toyTimingEvidence()); model.select('1004', 'staggered');
  const broken = toyTimingEvidence(); broken.cells.pop(); model.accept(broken);
  assert.equal(model.state.data, null); assert.match(model.state.error, /30-cell/);
  assert.equal(model.state.templateId, '1004'); assert.equal(model.state.pattern, 'staggered');
  model.accept(toyTimingEvidence()); assert.equal(model.state.templateId, '1004');
  model.reject(new Error('offline')); assert.equal(model.state.pattern, 'staggered');
  model.accept({ schema_version: 1, metadata: { stage: 'pending', audited: false } }); assert.equal(model.state.pending, true); assert.equal(model.state.data, null);
  const unverified = toyTimingEvidence(); unverified.metadata.audited = false; assert.throws(() => validateData(unverified), /audit/);
});
test('raster IDs stay strings and pulses must be inside the absolute middle window', () => {
  const data = toyTimingEvidence(); data.input_events[0].neuron_id = 720575940623211725; assert.throws(() => validateData(data), /input event/);
  const late = toyTimingEvidence(); late.input_events[0].time_ms = 1000; assert.throws(() => validateData(late), /input event/);
  const duplicate = toyTimingEvidence(); duplicate.cells[1] = { ...duplicate.cells[0] }; assert.throws(() => validateData(duplicate), /Duplicate/);
});
test('actual error renderer hides stale results, explains the failure, and leaves control values intact', async () => {
  const originalFetch = globalThis.fetch;
  const heading = {}, description = {};
  const element = () => ({ hidden: false, value: '', disabled: false, textContent: '', parentElement: { dataset: {} }, addEventListener() {} });
  const nodes = Object.fromEntries(['template', 'pattern', 'status', 'results', 'empty-state', 'reload', 'finding'].map(id => [id, element()]));
  nodes.template.value = '1004'; nodes.pattern.value = 'staggered';
  nodes.finding.textContent = 'Stale toy summary';
  nodes['empty-state'].querySelector = tag => tag === 'h3' ? heading : description;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ schema_version: 1, metadata: { stage: 'verified', audited: false, summary: 'Unaudited toy summary' } }) });
  try {
    const app = boot({ getElementById: id => nodes[id] }); app.model.select('1004', 'staggered'); await app.reload();
    assert.equal(nodes.results.hidden, true); assert.equal(nodes['empty-state'].hidden, false);
    assert.match(nodes.status.textContent, /independent audit/); assert.equal(heading.textContent, 'Evidence unavailable');
    assert.equal(nodes.template.value, '1004'); assert.equal(nodes.pattern.value, 'staggered');
    assert.equal(app.model.state.templateId, '1004');
    assert.equal(nodes.finding.hidden, true); assert.equal(nodes.finding.textContent, '');
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ schema_version: 1, metadata: { stage: 'pending', audited: false, summary: 'Pending toy summary' } }) });
    await app.reload(); assert.equal(nodes.finding.hidden, true); assert.equal(nodes.finding.textContent, '');
  } finally { globalThis.fetch = originalFetch; }
});
test('optional audited summary must be nonempty plain text', () => {
  const data = toyTimingEvidence(); data.metadata.summary = 'Toy fixture summary'; assert.equal(validateData(data).pending, false);
  for (const value of ['', '   ', null, 42, {}]) { data.metadata.summary = value; assert.throws(() => validateData(data), /nonempty string/); }
});
test('links reject executable URLs and local paths; production file contains no toy values', () => {
  assert.equal(safeEvidenceUrl('javascript:alert(1)'), false); assert.equal(safeEvidenceUrl('C:/private/evidence'), false); assert.equal(safeEvidenceUrl('//example.org'), false); assert.equal(safeEvidenceUrl('cells.csv'), true);
  const production = readFileSync(new URL('../demos/fly/timing/data.json', import.meta.url), 'utf8'); assert.doesNotMatch(production, /Toy/);
});
test('URL normalization rejects whitespace-prefixed schemes and permits trimmed web/public links', () => {
  for (const value of [' javascript:alert(1)', '\tjavascript:alert(1)', '\nJaVaScRiPt:alert(1)', ' data:text/html,hi', ' file:///private', 'java\tscript:alert(1)', ' //example.org', ' https://']) assert.equal(safeEvidenceUrl(value), false, value);
  for (const value of [' https://example.org/a ', '\thttp://example.org/a\n', ' ../cells.csv ', 'cells.csv#data']) assert.equal(safeEvidenceUrl(value), true, value);
});
test('input audit rejects extra pulses, a false total, and redistributed per-GRN counts', () => {
  const extra = toyTimingEvidence(); extra.input_events.push({ ...extra.input_events[0], time_ms: 999 }); assert.throws(() => validateData(extra), /50 events per GRN/);
  const wrongTotal = toyTimingEvidence(); wrongTotal.cells[0].scheduled_count = 999; assert.throws(() => validateData(wrongTotal), /reconcile with the shared raster/);
  const redistributed = toyTimingEvidence(); redistributed.input_events[0].neuron_id = redistributed.input_events[50].neuron_id; assert.throws(() => validateData(redistributed), /50 events per GRN/);
  const missingProtocol = toyTimingEvidence(); delete missingProtocol.metadata.scheduled_events_per_grn_period; assert.throws(() => validateData(missingProtocol), /scheduled_events_per_grn_period/);
  const allCells = toyTimingEvidence(); for (const cell of allCells.cells) { const copy = toyTimingEvidence(); copy.cells.find(row => row.template_id === cell.template_id && row.pattern === cell.pattern && row.condition === cell.condition).scheduled_count = 1049; assert.throws(() => validateData(copy), /reconcile with the shared raster/); }
});
