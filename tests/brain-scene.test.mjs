import test from 'node:test';
import assert from 'node:assert/strict';
import { rotatePoint, projectPoint, easeValue, fitScaleForRadius, mountScene } from '../assets/portfolio/brain-scene.js';
import { positions as atlasPositions } from '../assets/portfolio/brain-surface-data.js';

test('surface orbit preserves distances and produces the expected quarter turn', () => {
  const original = [0.4, -0.3, 0.8];
  const rotated = rotatePoint(...original, 1.4, -0.5, 0.2);
  assert.ok(Math.abs(Math.hypot(...rotated) - Math.hypot(...original)) < 1e-12);
  const quarter = rotatePoint(1, 0, 0, Math.PI / 2, 0);
  assert.ok(Math.abs(quarter[0]) < 1e-12);
  assert.ok(Math.abs(quarter[2] + 1) < 1e-12);
});

test('camera centres the origin and nearer points have larger projected separation', () => {
  assert.deepEqual(projectPoint(0, 0, 0, 800, 600), [400, 300, 1]);
  const near = projectPoint(0.5, 0, 1, 800, 600);
  const far = projectPoint(0.5, 0, -1, 800, 600);
  assert.ok(near[0] - 400 > far[0] - 400);
  for (const value of projectPoint(1, -1, 4, 320, 844)) assert.ok(Number.isFinite(value));
});

test('the actual atlas surface fits desktop and phone canvases throughout orbit', () => {
  let radius = 0;
  for (let i = 0; i < atlasPositions.length; i += 3)
    radius = Math.max(radius, Math.hypot(atlasPositions[i], atlasPositions[i + 1], atlasPositions[i + 2]));
  const scale = fitScaleForRadius(radius);
  for (const [width, height] of [[320, 500], [1000, 700]]) {
    for (let step = 0; step <= 16; step++) for (const pitch of [-1.15, -0.5, 0, 0.5, 1.15]) {
      const yaw = -Math.PI + step * Math.PI / 8;
      for (let i = 0; i < atlasPositions.length; i += 3) {
        const point = rotatePoint(atlasPositions[i], atlasPositions[i + 1], atlasPositions[i + 2], yaw, pitch, 0.1);
        const [x, y] = projectPoint(...point, width, height, scale);
        assert.ok(x >= 0 && x <= width && y >= 0 && y <= height, 'An orbit must not crop surface points');
      }
    }
  }
});

test('settling has the same result at different frame rates and cannot overshoot', () => {
  const whole = easeValue(0, 1, 0.1);
  const halves = easeValue(easeValue(0, 1, 0.05), 1, 0.05);
  assert.ok(Math.abs(whole - halves) < 1e-12);
  assert.ok(whole > 0 && whole < 1);
  assert.equal(easeValue(0.3, 1, 0), 0.3);
});

function fixture() {
  const handlers = new Map(); let queued = null, removed = 0;
  const ctx = new Proxy({}, { get: (o, k) => o[k] ?? (() => {}), set: (o, k, v) => (o[k] = v, true) });
  const win = { performance: { now: () => 100 }, devicePixelRatio: 3,
    requestAnimationFrame: fn => (queued = fn, 1), cancelAnimationFrame: () => { queued = null; },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
  let resized;
  win.ResizeObserver = class { constructor(fn) { resized = fn; } observe() {} disconnect() {} };
  const doc = { defaultView: win, hidden: false, addEventListener() {}, removeEventListener() {} };
  const canvas = { ownerDocument: doc, dataset: {}, style: { touchAction: 'auto' },
    getContext: () => ctx, getBoundingClientRect: () => ({ width: 800, height: 600, left: 0, top: 0 }),
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: name => { handlers.delete(name); removed++; } };
  return { canvas, handlers, frame: time => { const fn = queued; queued = null; fn?.(time); },
    resize: () => resized?.(),
    get queued() { return queued; }, get removed() { return removed; } };
}

test('mounted surface responds to orbit keys, settles, and destroy removes its event hooks', async () => {
  const f = fixture();
  const scene = mountScene(f.canvas, { positions: new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]) });
  await scene.ready;
  f.frame(100);
  const initial = Number(f.canvas.dataset.rotationY);
  scene.setReducedMotion(true);
  f.handlers.get('keydown')({ key: 'Home', ctrlKey: true, preventDefault() { assert.fail('Browser shortcuts must remain available'); } });
  f.handlers.get('keydown')({ key: 'ArrowRight', preventDefault() {} });
  f.frame(120);
  assert.ok(Number(f.canvas.dataset.rotationY) > initial + 0.1);
  assert.equal(f.canvas.width, 1200, 'DPR is capped at 1.5');
  assert.equal(f.canvas.style.touchAction, 'pan-y');
  const initialHooks = f.handlers.size;
  scene.destroy();
  assert.equal(f.canvas.dataset.sceneReady, 'false');
  assert.equal(f.canvas.style.touchAction, 'auto');
  assert.equal(f.handlers.size, 0);
  assert.equal(f.removed, initialHooks);
  assert.equal(f.queued, null);
});

test('pointer proximity reaches the surface and a captured drag changes its actual rotation', async () => {
  const f = fixture();
  const scene = mountScene(f.canvas, { positions: new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]) });
  await scene.ready;
  scene.setReducedMotion(true);
  f.handlers.get('pointermove')({ clientX: 405, clientY: 300, pointerType: 'mouse' });
  f.frame(100);
  assert.ok(Number(f.canvas.dataset.pointerInfluence) > 0.9);
  const before = Number(f.canvas.dataset.rotationY);
  f.handlers.get('pointerdown')({ clientX: 405, clientY: 300, pointerId: 7, pointerType: 'mouse', button: 0 });
  f.handlers.get('pointermove')({ clientX: 505, clientY: 300, pointerId: 7, pointerType: 'mouse' });
  f.frame(120);
  assert.ok(Number(f.canvas.dataset.rotationY) > before + 0.7);
  f.handlers.get('pointerup')({ pointerId: 7, pointerType: 'mouse' });
  assert.equal(f.canvas.dataset.dragging, 'false');
  scene.destroy();
});

test('the surface stops requesting frames after a project transition settles', async () => {
  const f = fixture();
  const scene = mountScene(f.canvas, { positions: new Float32Array([-1, 0, 0, 1, 0, 0, 0, 1, 0]) });
  await scene.ready;
  f.frame(100);
  assert.equal(f.queued, null, 'An untouched surface has no perpetual animation loop');
  f.resize();
  assert.equal(f.queued, null, 'An unchanged observed box must not queue another frame');
  scene.setProject('morphliner');
  for (let i = 0; i < 120; i++) f.frame(120 + i * 16);
  assert.equal(f.queued, null);
  assert.ok(Number(f.canvas.dataset.renderCount) < 100);
  scene.destroy();
});

test('unsupported canvas reports an error while leaving fallback ownership to the shell', async () => {
  let reported;
  const scene = mountScene({ dataset: {}, style: {}, getContext: () => null }, { onError: error => { reported = error; } });
  await assert.rejects(scene.ready, /unavailable/);
  assert.match(reported.message, /static surface/);
  scene.destroy();
});
