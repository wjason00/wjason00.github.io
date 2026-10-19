import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveSourceWeight } from '../network.js';

const roundup = '720575940623211725';
test('global gain scales positive and negative connections throughout the graph', () => {
  assert.equal(effectiveSourceWeight({source:'other',signedCount:100},1.2,false,roundup),120);
  assert.equal(effectiveSourceWeight({source:'other',signedCount:-100},1.2,false,roundup),-120);
});
test('cutting Roundup outputs leaves incoming and other weights active', () => {
  assert.equal(effectiveSourceWeight({source:roundup,signedCount:424},1.2,true,roundup),0);
  assert.equal(effectiveSourceWeight({source:'upstream',target:roundup,signedCount:100},1.2,true,roundup),120);
  assert.equal(effectiveSourceWeight({source:roundup,signedCount:424},1,false,roundup),424);
});
test('long neuron IDs remain distinct rather than being rounded as JavaScript numbers', () => {
  assert.equal(effectiveSourceWeight({source:'720575940623211726',signedCount:100},1,true,roundup),100);
});
