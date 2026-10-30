import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const asset = name => new URL(`../assets/portfolio/g27/${name}`, import.meta.url);
const originals = [
  { file: 'timing-original.png', slide: 6, member: 'ppt/media/image9.png', width: 1720, height: 980, sha256: '2bee7a6b7542d9d2cdb5624760525d33b72c8bea849e288ef0e25bc4c8625e35' },
  { file: 'montage-original.png', slide: 8, member: 'ppt/media/image6.png', width: 1352, height: 1031, sha256: '5d39a20a61549f2b5d6dda804cd33a177cc3c32aa13daff7a5a2182b97d3d97c' },
];

test('G27 figures retain the original embedded PPTX bytes and dimensions', async () => {
  const provenance = JSON.parse(await readFile(asset('source.json'), 'utf8'));
  assert.equal(provenance.sourcePresentation, 'https://docs.google.com/presentation/d/1nk-tRbrmjyU5FfJhQrmNkPdnxmlSUcTThhmaOk1nU8k/present');
  assert.ok(provenance.revision);
  assert.match(provenance.credit, /G27 team presentation/);
  assert.match(provenance.reuseScope, /Publication authorised by Jason on 30 October 2026/);
  assert.match(provenance.reuseScope, /no public licence asserted/);
  assert.equal(provenance.figures.length, originals.length);

  for (const original of originals) {
    const bytes = await readFile(asset(original.file));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', original.file);
    assert.equal(bytes.readUInt32BE(16), original.width, `${original.file} width`);
    assert.equal(bytes.readUInt32BE(20), original.height, `${original.file} height`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), original.sha256, `${original.file} original bytes`);
    const entry = provenance.figures.find(figure => figure.file === original.file);
    assert.ok(entry, `${original.file} provenance`);
    assert.equal(entry.slide, original.slide);
    assert.equal(entry.pptxMember, original.member);
    assert.equal(entry.sha256, original.sha256);
    assert.match(entry.processing, /Original embedded figure bytes unchanged/);
    assert.ok(entry.limits.length > 0, `${original.file} interpretation limits`);
  }
});
