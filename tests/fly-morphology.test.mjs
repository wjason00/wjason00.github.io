import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createSelectionBridge } from '../demos/fly/explorer.js';

let module;
try { module = await import('../demos/fly/morphology.js'); } catch {}

test('source skeleton coordinates use one common origin and nanometres to micrometres conversion', () => {
  assert.equal(typeof module?.positionsInMicrometres, 'function', 'Morphology coordinates are not implemented');
  const first = module.positionsInMicrometres({positions:[101000,202000,303000]},[100000,200000,300000]);
  const second = module.positionsInMicrometres({positions:[104000,205000,306000]},[100000,200000,300000]);
  assert.deepEqual([...first],[1,2,3]);
  assert.deepEqual([...second],[4,5,6]);
});

test('materialization-630 skeletons exactly cover graph string IDs with valid geometry', async () => {
  const source = JSON.parse(await readFile(new URL('../demos/fly/morphology-data.json', import.meta.url)));
  const graph = JSON.parse(await readFile(new URL('../demos/fly/network-data.json', import.meta.url)));
  assert.equal(source.materialization,630);
  assert.equal(source.units,'nm');
  assert.deepEqual(source.missingIds,[]);
  assert.deepEqual(new Set(source.neurons.map(n => n.id)),new Set(graph.nodes.map(n => n.id)));
  for (const neuron of source.neurons) {
    assert.equal(typeof neuron.id,'string');
    assert.ok(neuron.positions.length >= 6);
    assert.equal(neuron.positions.length % 3,0);
    assert.ok(neuron.positions.every(Number.isFinite));
    assert.equal(neuron.edges.length % 2,0);
    assert.ok(neuron.edges.every(i => Number.isInteger(i) && i >= 0 && i < neuron.positions.length / 3));
  }
});

const threeContext = {console: {warn() {}}};
vm.runInNewContext(await readFile(new URL('../demos/fly/vendor/three.min.js', import.meta.url), 'utf8'), threeContext);
const sampleData = {materialization: 630, units: 'nm', neurons: [
  {id: '720575940623211725', label: 'Roundup', positions: [0,0,0,100000,200000,300000], edges: [0,1]},
  {id: 'other', label: 'Other', positions: [300000,200000,100000,310000,220000,130000], edges: [0,1]}
]};

// Exercise the mounted viewer and real Three.js geometry; only browser I/O is stubbed.
function mountEnvironment(t, {width = 800, height = 400, webgl = true} = {}) {
  const names = ['THREE','fetch','document','ResizeObserver'];
  const previous = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  t.after(() => names.forEach((name, i) => previous[i] ? Object.defineProperty(globalThis, name, previous[i]) : delete globalThis[name]));
  const element = () => ({innerHTML: '', textContent: '', checked: false, events: {},
    addEventListener(type, handler) { this.events[type] = handler; },
    setAttribute() {}, replaceChildren() {}, getContext() { return {fillText() {}}; }});
  const elements = new Map(['.morphology-stage','.morphology-picker','.morphology-isolate','.morphology-selection','.morphology-scale',
    '[data-action="reset"]','[data-action="focus"]','[data-action="zoom-in"]','[data-action="zoom-out"]'].map(key => [key, element()]));
  const stage = elements.get('.morphology-stage');
  stage.clientWidth = width; stage.clientHeight = height;
  const container = {...element(), querySelector: selector => elements.get(selector)};
  const renderers = [], observers = [];
  class Renderer {
    constructor() { if (!webgl) throw Error('WebGL unavailable'); this.domElement = element(); this.sizes = []; this.frames = []; renderers.push(this); }
    setPixelRatio() {}
    setSize(w, h) { this.sizes.push([w,h]); }
    render(scene, camera) { this.frames.push({position: [...camera.position.toArray()], quaternion: [...camera.quaternion.toArray()], aspect: camera.aspect}); }
    dispose() { this.disposed = true; }
  }
  globalThis.THREE = {...threeContext.THREE, WebGLRenderer: Renderer};
  globalThis.document = {createElement: element};
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {} disconnect() {}
  };
  let fetches = 0;
  globalThis.fetch = async () => { fetches++; return {ok: true, json: async () => sampleData}; };
  return {container, stage, renderers, observers, get fetches() { return fetches; }, click: action => elements.get(`[data-action="${action}"]`).events.click(),
    selection: elements.get('.morphology-selection')};
}

test('a transient anatomy fetch rejects and the selection bridge retries a real mount', async t => {
  const env = mountEnvironment(t);
  const successfulFetch = globalThis.fetch;
  globalThis.fetch = async () => { globalThis.fetch = successfulFetch; throw Error('offline'); };
  const bridge = createSelectionBridge(() => module.mountMorphology(env.container));
  await assert.rejects(bridge.open(), /neuron data could not be loaded/i);
  assert.equal(env.renderers[0].disposed, true);
  assert.match(env.stage.innerHTML, /neuron data could not be loaded/i);
  await bridge.open();
  assert.equal(env.fetches, 1);
  assert.equal(env.renderers.length, 2);
  assert.ok(env.renderers[1].frames.length > 0);
});

test('unsupported WebGL stays a graceful fallback with its actual reason', async t => {
  const env = mountEnvironment(t, {webgl: false});
  const view = await module.mountMorphology(env.container);
  view.selectNeuron('other');
  assert.equal(env.fetches, 0);
  assert.match(env.stage.innerHTML, /could not start WebGL/i);
  assert.match(env.selection.textContent, /WebGL/i);
});

for (const action of ['zoom-in','focus']) test(`hidden anatomy preserves the ${action} camera on return and mobile resize`, async t => {
  const env = mountEnvironment(t, {width: 400, height: 400});
  const view = await module.mountMorphology(env.container);
  view.selectNeuron('other');
  env.click(action);
  const renderer = env.renderers[0], before = renderer.frames.at(-1), sizeCount = renderer.sizes.length;
  env.stage.clientWidth = 0; env.stage.clientHeight = 0;
  env.observers[0].callback();
  assert.equal(renderer.sizes.length, sizeCount, 'hidden stages must not render at 1 by 1');
  env.stage.clientWidth = 400; env.stage.clientHeight = 400;
  view.resize();
  assert.deepEqual(renderer.frames.at(-1), before, 'tab return preserves zoom and selected target');
  env.stage.clientWidth = 320; env.stage.clientHeight = 640;
  view.resize();
  assert.deepEqual(renderer.frames.at(-1).position, before.position, 'a mobile resize preserves the user camera');
  assert.deepEqual(renderer.frames.at(-1).quaternion, before.quaternion);
  assert.equal(renderer.frames.at(-1).aspect, .5);
});

test('a viewer mounted hidden fits once at its first real dimensions', async t => {
  const env = mountEnvironment(t, {width: 0, height: 0});
  const view = await module.mountMorphology(env.container);
  assert.deepEqual(env.renderers[0].sizes, []);
  env.stage.clientWidth = 300; env.stage.clientHeight = 600;
  view.resize();
  const firstLayout = env.renderers[0].frames.at(-1);
  await module.mountMorphology(env.container);
  assert.deepEqual(env.renderers[1].frames.at(-1), firstLayout, 'first visible fit equals a mount at the same real dimensions');
});
