const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../demos/fly/body');
const sourceRoot = process.env.FLY_BODY_SOURCE_ROOT || path.resolve(__dirname, '../../fly-perturbation-pilot/feeding-demo-2026-10-15');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

test('body replay is a closed local asset package with intact evidence boundaries', () => {
  assert.ok(fs.existsSync(path.join(root, 'index.html')), 'missing embeddable body replay');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /separate.*archive/i);
  assert.match(html, /assumed.*uncalibrated/i);
  for (const [, ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (/^https:\/\//.test(ref)) continue;
    assert.ok(!ref.includes('127.0.0.1') && !ref.includes('review-2026'), ref);
    assert.ok(fs.existsSync(path.resolve(root, ref)), 'missing dependency: ' + ref);
  }
  assert.doesNotMatch(html, /(?:start|sensitivity)\.html|publication-plan\.md/);
});

test('gzip package decodes to the exact audited source mesh binary', () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'provenance.json')));
  const bytes = zlib.gunzipSync(fs.readFileSync(path.join(root, 'meshes.bin.gz')));
  assert.equal(bytes.length, 29435400);
  assert.equal(sha(bytes), '7082f88db83d93799aff4fc932366c0d4eebe3d7288f883ac743aeadaac094cb');
  assert.equal(provenance.geometry_decoded_sha256, sha(bytes));
  assert.equal(provenance.geometry_transform, 'Lossless gzip only; no changed mesh values or source transforms.');
});

test('saved archive and motor/contact policies are byte-preserved and locally licensed', () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'provenance.json')));
  for (const item of provenance.files) {
    const bytes = fs.readFileSync(path.resolve(root, item.file));
    assert.equal(sha(bytes), item.sha256, item.file);
    assert.equal(bytes.length, item.bytes, item.file);
  }
  for (const name of ['licenses/FlyBody-APACHE-2.0.txt', 'licenses/fly-model-MIT.txt', '../vendor/THREE-LICENSE.txt']) {
    assert.ok(fs.statSync(path.resolve(root, name)).size > 500);
  }
  const context = { window: {} };
  context.globalThis = context.window;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'native-feeding-events.js'), 'utf8'), context);
  const data = context.window.NATIVE_FEEDING_EVENTS;
  assert.equal(data.cases.length, 6);
  assert.ok(data.cases.every(c => c.trials.length === 30));
  assert.match(data.between_condition_pairing, /not[ _]established/i);
});

test('retained files match the original local archive when supplied', { skip: !fs.existsSync(sourceRoot) }, () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'provenance.json')));
  for (const item of provenance.files.filter(item => item.preserved)) {
    assert.equal(sha(fs.readFileSync(path.resolve(sourceRoot, item.source))), item.sha256, item.file);
  }
});

test('decoded-buffer transport builds the original hierarchy and preserves independent poses', () => {
  function load(name, dependencies = {}) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.resolve(root, name), 'utf8'), {
      module, exports: module.exports, require: name => dependencies[name],
      console: { warn() {} }, ArrayBuffer, Float32Array, Uint32Array, Uint8Array,
      Buffer, atob
    }, { filename: name });
    return module.exports;
  }
  const THREE = load('../vendor/three.min.js');
  const rig = load('native-body-rig.js');
  const loader = load('packed-mesh-loader.js');
  const shared = load('shared-packed-body-rig.js', {
    './native-body-rig.js': rig, './packed-mesh-loader.js': loader
  });
  const metadata = JSON.parse(fs.readFileSync(path.join(root, 'asset-metadata.json')));
  const packed = zlib.gunzipSync(fs.readFileSync(path.join(root, 'meshes.bin.gz')));
  const buffer = packed.buffer.slice(packed.byteOffset, packed.byteOffset + packed.byteLength);
  const pool = shared.createPool(THREE, { ...metadata, buffer });
  const first = pool.create(), second = pool.create();
  assert.equal(Object.keys(first.geoms).length, Object.keys(metadata.manifest.meshes).length);
  assert.equal(first.geometries, second.geometries, 'source geometry shared without decoding twice');
  assert.notEqual(first.root, second.root, 'comparison poses require independent hierarchies');
  first.pose({ rostrum: -0.7, labrum_left: 0.2, labrum_right: 0.5 });
  second.pose({ rostrum: 0 });
  assert.notDeepEqual(first.bodies.rostrum.matrix.toArray(), second.bodies.rostrum.matrix.toArray());
  pool.dispose();
  assert.throws(() => pool.create(), /closed/);
  first.dispose();
  assert.ok(Object.keys(second.geometries).length > 0, 'last live rig still owns geometry');
  second.dispose();
  assert.equal(Object.keys(second.geometries).length, 0);
});

test('bootstrap accepts gzip transport and transparent HTTP decompression, checking source integrity', async () => {
  const compressed = fs.readFileSync(path.join(root, 'meshes.bin.gz'));
  for (const wire of [compressed, zlib.gunzipSync(compressed)]) {
    const status = {}, error = {}, html = { dataset: {} };
    const window = { DecompressionStream, dispatchEvent() {} };
    const context = {
      window, Response, DecompressionStream, Uint8Array, Event,
      crypto: crypto.webcrypto,
      fetch: async url => new Response(url.endsWith('.json') ? fs.readFileSync(path.join(root, url)) : wire),
      document: {
        documentElement: html,
        getElementById: id => id === 'load-status' ? status : error,
        createElement: () => ({}),
        body: { append(script) { window.FLY_DEMO = { getState: () => ({ webgl: true }) }; queueMicrotask(() => script.onload()); } }
      }
    };
    await vm.runInNewContext(fs.readFileSync(path.join(root, 'boot.js'), 'utf8'), context);
    assert.equal(html.dataset.loading, 'false', error.textContent);
    assert.equal(status.hidden, true);
    assert.equal(window.NATIVE_FLYBODY_ASSET.buffer, null, 'release transport bytes after initialization');
  }
});
