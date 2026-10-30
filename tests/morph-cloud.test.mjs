import test from 'node:test';
import assert from 'node:assert/strict';
import { mountMorphViewer } from '../assets/model-morpher/morph-cloud-viewer.js';
import { frames, metadata } from '../assets/model-morpher/morph-cloud-data.js';

function fixture(width = 800, height = 600) {
  const handlers = new Map(), docHandlers = new Map(), raf = new Map();
  let time = 0, nextId = 0, resize, intersection, disconnects = 0;
  const painted = [];
  const ctx = new Proxy({
    arc(x, y) { painted.push([x, y]); },
    fillRect(x, y, w, h) { if (w < 20 && h < 20) painted.push([x, y]); },
    createRadialGradient() { return { addColorStop() {} }; },
  }, { get: (o, k) => o[k] ?? (() => {}), set: (o, k, v) => (o[k] = v, true) });
  const media = { matches: false, addEventListener() {}, removeEventListener() {} };
  const win = {
    performance: { now: () => time }, devicePixelRatio: 3,
    requestAnimationFrame(fn) { const id = ++nextId; raf.set(id, fn); return id; },
    cancelAnimationFrame(id) { raf.delete(id); },
    matchMedia: () => media,
    addEventListener() {}, removeEventListener() {},
    ResizeObserver: class { constructor(fn) { resize = fn; } observe() {} disconnect() { disconnects++; } },
    IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} disconnect() { disconnects++; } },
  };
  const doc = { defaultView: win, hidden: false,
    addEventListener: (name, fn) => docHandlers.set(name, fn),
    removeEventListener: name => docHandlers.delete(name) };
  const canvas = { ownerDocument: doc, dataset: {}, style: { touchAction: 'auto' },
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width, height, left: 0, top: 0 }),
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: name => handlers.delete(name),
    setPointerCapture() {}, releasePointerCapture() {}, hasPointerCapture: () => true,
    setAttribute() {}, focus() {},
  };
  return { canvas, handlers, doc, docHandlers, painted,
    frame(at = time + 17) { time = at; const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(fn => fn(time)); },
    resize() { resize?.([{ target: canvas, contentRect: { width, height } }]); },
    visible(value) { intersection?.([{ target: canvas, isIntersecting: value, intersectionRatio: Number(value) }]); },
    get queued() { return raf.size; }, get disconnects() { return disconnects; },
  };
}

function settle(f, start = 0) { for (let i = 0; i < 40 && f.queued; i++) f.frame(start + i * 17); }

test('saved frames have finite coordinates and match their recorded mesh metadata', () => {
  assert.equal(frames.length, 30);
  assert.equal(metadata.frameCount, frames.length);
  let radius = 0;
  for (const [index, frame] of frames.entries()) {
    assert.ok(frame instanceof Float32Array);
    assert.equal(frame.length, metadata.pointsPerFrame * 3);
    assert.equal(metadata.frames[index].index, index);
    assert.equal(metadata.frames[index].t, index / 29);
    assert.match(metadata.frames[index].sourceMeshSha256, /^[a-f0-9]{64}$/);
    assert.ok(metadata.frames[index].sourcePoints >= metadata.pointsPerFrame);
    for (let i = 0; i < frame.length; i += 3) {
      assert.ok(Number.isFinite(frame[i]) && Number.isFinite(frame[i + 1]) && Number.isFinite(frame[i + 2]));
      radius = Math.max(radius, Math.hypot(frame[i], frame[i + 1], frame[i + 2]));
    }
  }
  assert.ok(radius <= metadata.maxSampleRadius + 0.0001, 'The shared camera bound must contain every saved sample');
});

test('frame selection clamps saved indices and preserves exact recorded t and source count', async () => {
  const f = fixture(); const changes = []; let initial;
  const viewer = mountMorphViewer(f.canvas, { onReady: value => { initial = value; }, onChange: value => changes.push(value) });
  assert.equal(typeof viewer.setFrame, 'function', 'The controller must be returned immediately');
  await viewer.ready; settle(f);
  assert.equal(f.canvas.dataset.morphReady, 'true');
  assert.equal(Number(f.canvas.dataset.frame), 0);
  assert.equal(initial.frame, 0);
  viewer.setFrame(15); settle(f, 1000);
  assert.equal(Number(f.canvas.dataset.frame), 15);
  assert.equal(Number(f.canvas.dataset.t), 15 / 29);
  assert.equal(changes.at(-1).sourcePoints, metadata.frames[15].sourcePoints);
  assert.equal(changes.at(-1).transitioning, false, 'Blending is off by default');
  viewer.setFrame(999); settle(f, 2000);
  assert.equal(Number(f.canvas.dataset.frame), 29);
  viewer.setFrame(-100); settle(f, 3000);
  assert.equal(Number(f.canvas.dataset.frame), 0);
  viewer.destroy();
});

test('all saved surfaces remain inside portrait and landscape camera bounds', async () => {
  for (const [width, height] of [[320, 600], [900, 480]]) {
    const f = fixture(width, height), viewer = mountMorphViewer(f.canvas);
    await viewer.ready; viewer.setGhosts(false); viewer.setReducedMotion(true);
    for (let frame = 0; frame < frames.length; frame++) {
      f.painted.length = 0; viewer.setFrame(frame); f.frame(frame * 100);
      for (const [x, y] of f.painted) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
        assert.ok(x >= width * 0.035 && x <= width * 0.965 && y >= height * 0.035 && y <= height * 0.965,
          `Frame ${frame} must fit the fixed camera with a margin`);
      }
    }
    assert.equal(f.canvas.width, Math.round(width * 1.5), 'Device pixel ratio is capped at 1.5');
    viewer.destroy();
  }
});

test('play advances current saved frames and pauses at the last without looping', async () => {
  const f = fixture(), changes = [], viewer = mountMorphViewer(f.canvas, { onChange: value => changes.push(value) });
  await viewer.ready; settle(f); viewer.setReducedMotion(true); viewer.setFrame(27); f.frame(100);
  changes.length = 0; viewer.play();
  for (let i = 1; i <= 20; i++) f.frame(100 + i * 100);
  assert.ok(changes.some(value => value.frame === 28));
  assert.equal(Number(f.canvas.dataset.frame), 29);
  assert.equal(f.canvas.dataset.playing, 'false');
  assert.equal(f.queued, 0);
  viewer.setFrame(10); viewer.play(); f.frame(2300); viewer.pause(); settle(f, 2400);
  const pausedFrame = f.canvas.dataset.frame;
  f.frame(6000);
  assert.equal(f.canvas.dataset.frame, pausedFrame);
  assert.equal(f.canvas.dataset.transitioning, 'false');
  viewer.destroy();
});

test('reduced motion and nonadjacent selection finish on exact saved frames', async () => {
  const f = fixture(), viewer = mountMorphViewer(f.canvas);
  await viewer.ready; settle(f); viewer.setBlend(true); viewer.setFrame(15); f.frame(100);
  assert.equal(f.canvas.dataset.transitioning, 'false', 'A nonadjacent jump does not animate intermediate geometry');
  viewer.setReducedMotion(true); viewer.setFrame(16); f.frame(200);
  assert.equal(f.canvas.dataset.transitioning, 'false');
  assert.equal(Number(f.canvas.dataset.frame), 16);
  assert.equal(Number(f.canvas.dataset.t), metadata.frames[16].t);
  viewer.destroy();
});

test('adjacent blending paints saved coordinates only and pause completes the blend', async () => {
  const f = fixture();
  const samples = [new Float32Array([-0.8, 0.1, 0.2, 0.5, 0.2, -0.1]),
    new Float32Array([-0.4, -0.2, 0.1, 0.2, 0.5, -0.2])];
  const info = { frameCount: 2, pointsPerFrame: 2, maxSampleRadius: 1,
    frames: [{ index: 0, t: 0, sourcePoints: 2 }, { index: 1, t: 1, sourcePoints: 2 }] };
  const viewer = mountMorphViewer(f.canvas, { frames: samples, metadata: info });
  await viewer.ready; viewer.setGhosts(false); settle(f);
  const key = point => point.map(value => value.toFixed(6)).join(',');
  f.painted.length = 0; viewer.setFrame(1); f.frame(100);
  const second = f.painted.map(key);
  f.painted.length = 0; viewer.setFrame(0); f.frame(200);
  const first = f.painted.map(key), savedCoordinates = new Set([...first, ...second]);
  assert.ok(first.length > 0 && second.length > 0, 'The fixture must observe rendered points');
  viewer.setBlend(true); viewer.setFrame(1);
  f.painted.length = 0; f.frame(280);
  assert.equal(f.canvas.dataset.transitioning, 'true');
  assert.ok(f.painted.length > 0);
  for (const point of f.painted) assert.ok(savedCoordinates.has(key(point)), 'Opacity blending must never interpolate vertex coordinates');
  viewer.pause(); settle(f, 400);
  assert.equal(f.canvas.dataset.transitioning, 'false');
  assert.equal(Number(f.canvas.dataset.frame), 1);
  assert.equal(f.queued, 0);
  viewer.destroy();
});

test('idle resize stays idle, drag and keys rotate, and reset restores the initial view', async () => {
  let calls = 0;
  const f = fixture(), viewer = mountMorphViewer(f.canvas, { onChange: () => calls++ });
  await viewer.ready; settle(f);
  assert.equal(f.queued, 0, 'A static frame must not maintain a RAF loop');
  const renders = f.canvas.dataset.renderCount;
  f.resize(); assert.equal(f.queued, 0); assert.equal(f.canvas.dataset.renderCount, renders);
  viewer.setReducedMotion(true);
  const initialX = Number(f.canvas.dataset.rotationX), initialY = Number(f.canvas.dataset.rotationY);
  f.handlers.get('pointerdown')({ clientX: 400, clientY: 300, pointerId: 7, pointerType: 'mouse', button: 0 });
  f.handlers.get('pointermove')({ clientX: 500, clientY: 340, pointerId: 7, pointerType: 'mouse' });
  f.handlers.get('pointerup')({ pointerId: 7, pointerType: 'mouse' });
  settle(f, 1000);
  assert.notEqual(Number(f.canvas.dataset.rotationY), initialY);
  f.handlers.get('keydown')({ key: 'Home', ctrlKey: true, preventDefault() { assert.fail('Modified browser shortcuts stay available'); } });
  f.handlers.get('keydown')({ key: 'Home', preventDefault() {} }); settle(f, 2000);
  assert.equal(Number(f.canvas.dataset.rotationX), initialX);
  assert.equal(Number(f.canvas.dataset.rotationY), initialY);
  f.handlers.get('keydown')({ key: 'ArrowRight', preventDefault() {} }); settle(f, 3000);
  assert.notEqual(Number(f.canvas.dataset.rotationY), initialY);
  viewer.resetView(); settle(f, 4000);
  assert.equal(Number(f.canvas.dataset.rotationY), initialY);
  viewer.play(); viewer.destroy();
  assert.equal(f.canvas.dataset.morphReady, 'false');
  assert.equal(f.canvas.style.touchAction, 'auto');
  assert.equal(f.handlers.size, 0); assert.equal(f.docHandlers.size, 0); assert.equal(f.queued, 0);
  assert.ok(f.disconnects >= 1);
  const afterDestroy = calls;
  viewer.resetView(); viewer.setReducedMotion(false); viewer.setTheme('dark'); viewer.play();
  assert.equal(calls, afterDestroy, 'A disposed figure must not update its former shell');
  assert.equal(f.queued, 0);
});

test('visibility and offscreen changes pause playback', async () => {
  const f = fixture(), viewer = mountMorphViewer(f.canvas);
  await viewer.ready; settle(f); viewer.play();
  f.doc.hidden = true; f.docHandlers.get('visibilitychange')?.();
  assert.equal(f.canvas.dataset.playing, 'false');
  assert.equal(f.queued, 0);
  f.doc.hidden = false; f.docHandlers.get('visibilitychange')?.(); viewer.play(); f.visible(false);
  assert.equal(f.canvas.dataset.playing, 'false');
  assert.equal(f.queued, 0);
  viewer.destroy();
});
