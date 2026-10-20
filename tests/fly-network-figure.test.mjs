import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { renderNetwork, canonicalNetworkSource } from '../scripts/render-fly-network.mjs';

const root = new URL('../', import.meta.url);
const sourceBytes = await readFile(new URL('demos/fly/network-data.json', root));
const source = JSON.parse(sourceBytes);
const svg = await readFile(new URL('assets/portfolio/fly-network-focus.svg', root), 'utf8');
const provenance = JSON.parse(await readFile(new URL('assets/portfolio/fly-network-focus.json', root)));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('focused figure is reproducible from the unchanged frozen export', () => {
  assert.equal(provenance.source.sha256, hash(canonicalNetworkSource(sourceBytes)));
  assert.equal(provenance.output.sha256, hash(svg));
  assert.equal(renderNetwork(source).svg, svg);
  assert.equal(provenance.nodes.length, 7);
  assert.equal(provenance.edges.length, 6);
});

test('every drawn neuron and directed edge has an exact source identity', () => {
  assert.deepEqual([...svg.matchAll(/data-node-id="(\d+)"/g)].map(match => match[1]).sort(), provenance.nodes.map(node => node.id).sort());
  const drawn = [...svg.matchAll(/data-edge-row="(\d+)" data-source="(\d+)" data-target="(\d+)" data-intervention="([a-z]+)"/g)];
  assert.equal(drawn.length, provenance.edges.length);
  for (const [, row, start, end, intervention] of drawn) {
    const original = source.edges.find(edge => edge.row === Number(row));
    const recorded = provenance.edges.find(edge => edge.row === Number(row));
    assert.ok(original);
    assert.equal(original.source, start);
    assert.equal(original.target, end);
    assert.deepEqual(recorded, { ...original, intervention });
    assert.equal(intervention, start === source.roundup ? 'zeroed' : 'unchanged');
  }
});

test('selection and caption preserve the scope of the intervention', () => {
  const descending = (a, b) => b.synapses - a.synapses || a.row - b.row;
  const incoming = source.edges.filter(edge => edge.target === source.roundup).sort(descending).slice(0, 2);
  const outgoing = source.edges.filter(edge => edge.source === source.roundup).sort(descending).slice(0, 3);
  const otherInput = source.edges.filter(edge => edge.target === source.mn9 && edge.source !== source.roundup).sort(descending).slice(0, 1);
  assert.deepEqual(provenance.edges.map(edge => edge.row), [...incoming, ...outgoing, ...otherInput].map(edge => edge.row));
  assert.ok(incoming.every(edge => provenance.edges.find(item => item.row === edge.row).intervention === 'unchanged'));
  assert.ok(outgoing.some(edge => edge.target === source.mn9));
  assert.match(svg, /Other model connections are omitted/);
  assert.match(svg, /all Roundup outgoing connections were zeroed/);
  assert.match(svg, /not neural activity, anatomy, or proof of a causal signal route/);
  assert.match(svg, /Line widths do not encode strength or sign/);
  assert.match(svg, /aria-labelledby="network-title network-desc"/);
});

test('source fingerprint is stable across Windows and Linux line endings', () => {
  const unix = String(sourceBytes).replaceAll('\r\n', '\n');
  const windows = unix.replaceAll('\n', '\r\n');
  assert.equal(canonicalNetworkSource(windows), unix);
  assert.equal(hash(canonicalNetworkSource(windows)), provenance.source.sha256);
  assert.deepEqual(JSON.parse(canonicalNetworkSource(windows)), source);
  assert.match(provenance.source.fingerprint, /LF line endings/);
});
