import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const record = JSON.parse(read('assets/portfolio/morphbrain-reference.json'));
const {state} = record;
const regions = read('assets/portfolio/morphbrain-regions.svg');
const hash = text => createHash('sha256').update(text).digest('hex');

test('new figure input is the unchanged shipped default state, with fixed field units', () => {
  assert.equal(hash(JSON.stringify(state)), record.stateSha256);
  // Recorded hashes use the Windows CRLF checkout; normalise so Linux CI agrees.
  assert.equal(hash(read(record.bundle).replace(/\r?\n/g, '\r\n')), record.bundleSha256);
  assert.equal(state.convergence.converged, true);
  assert.deepEqual([state.width,state.height], [96,144]);
  for (const field of ['shh','bmp']) {
    assert.equal(state[field].length, state.width*state.height);
    assert.ok(state[field].every(value => Number.isFinite(value) && value >= 0 && value <= 25));
  }
});

test('the actual SVG classification preserves every source cell and its vertical orientation', () => {
  assert.match(regions, /viewBox="0 0 96 144"/);
  const actual = new Uint8Array(state.width*state.height);
  const assigned = new Uint8Array(actual.length);
  for (const [colour,identity] of [['#4c6fb3',1],['#6f977e',2],['#c45a35',3]]) {
    const path = [...regions.matchAll(/<path\b[^>]*\bd="([^"]+)"[^>]*\bfill="([^"]+)"[^>]*\/>/g)].find(match => match[2] === colour)?.[1];
    assert.ok(path, `Missing category ${colour}`);
    const segments = [...path.matchAll(/M(\d+) (\d+)h(\d+)v1H\d+Z/g)];
    assert.equal(segments.map(match => match[0]).join(''), path, 'Uninspected drawing commands');
    for (const [,x,y,width] of segments) {
      for (let offset=0;offset<Number(width);offset++) {
        const index=Number(y)*state.width+Number(x)+offset;
        assert.ok(Number(x)+offset < state.width && Number(y) < state.height);
        assert.equal(assigned[index],0,'Overlapping categorical cells');
        assigned[index]=1;
        actual[index]=identity;
      }
    }
  }
  const expected = Uint8Array.from(state.fates, (fate,index) => !state.tissueMask[index] ? 0 : fate === 1 || fate === 2 ? 1 : fate === 3 ? 2 : fate === 4 || fate === 5 ? 3 : 0);
  assert.deepEqual(actual,expected,'Figure changed a region, omitted tissue or changed orientation');
  assert.deepEqual(assigned,Uint8Array.from(state.tissueMask));
});
