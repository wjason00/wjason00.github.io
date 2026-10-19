import test from 'node:test';
import assert from 'node:assert/strict';
import { neuronExplanation } from '../demos/fly/neuron-roles.js';

test('motor and intervention roles retain distinct evidence limits', () => {
  const motor = neuronExplanation({ role: 'mn9' });
  const target = neuronExplanation({ role: 'roundup' });
  assert.match(motor.summary, /rostrum/i);
  assert.match(motor.limit, /firing.*movement|movement.*firing/i);
  assert.match(target.summary, /premotor/i);
  assert.match(target.limit, /incoming/i);
});
test('negative model sign does not invent a named neuron behavioural function', () => {
  for (const label of ['buddy', 'cradle', 'horntail']) {
    const role = neuronExplanation({ label, types: [label], role: 'other' });
    assert.match(role.limit, /not.*verified/i);
    assert.doesNotMatch(role.summary, /stops feeding|suppresses feeding/i);
  }
});
test('sensory and unavailable annotations remain explicit', () => {
  assert.match(neuronExplanation({ role: 'sensory' }).summary, /input/i);
  const missing = neuronExplanation({ label: 'Unannotated neuron', types: [], role: 'other' });
  assert.match(missing.summary, /not.*cell-type|no.*cell-type/i);
  assert.match(missing.limit, /not.*unimportant/i);
});
