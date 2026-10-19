import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelectionBridge } from '../demos/fly/explorer.js';

test('a pending anatomy load happens once and receives the latest exact string ID', async () => {
  let resolveLoad, loads = 0, selections = [];
  const bridge = createSelectionBridge(() => { loads++; return new Promise(resolve => { resolveLoad = resolve; }); });
  bridge.select('720575940623211725');
  const first = bridge.open();
  const second = bridge.open();
  bridge.select('720575940660219265');
  await Promise.resolve();
  resolveLoad({ selectNeuron: id => selections.push(id), resize() {} });
  await Promise.all([first, second]);
  assert.equal(loads, 1);
  assert.ok(selections.every(id => id === '720575940660219265'));
  bridge.select('720575940618028125');
  assert.equal(selections.at(-1), '720575940618028125');
});
test('failed anatomy loading can be retried', async () => {
  let loads = 0;
  const bridge = createSelectionBridge(async () => {
    if (++loads === 1) throw Error('offline');
    return { selectNeuron() {}, resize() {} };
  });
  await assert.rejects(bridge.open(), /offline/);
  await bridge.open();
  assert.equal(loads, 2);
});
