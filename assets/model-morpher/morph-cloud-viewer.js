/* Display actual saved surfaces. A transition blends opacity, never positions. */
export const frameIndex = (value, count) => Math.max(0, Math.min(Math.max(0, count - 1), Math.round(Number(value) || 0)));
export const fitScaleForRadius = radius => .46 / Math.max(.001, radius);
export function rotateXYZ(x, y, z, yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const xx = x * cy + z * sy, zz = z * cy - x * sy;
  return [xx, y * cp - zz * sp, y * sp + zz * cp];
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (v, target, dt) => target + (v - target) * Math.exp(-15 * dt);

export function mountMorphViewer(canvas, options = {}) {
  const doc = canvas?.ownerDocument, win = doc?.defaultView ?? globalThis;
  const clock = () => win.performance?.now?.() ?? Date.now();
  const request = win.requestAnimationFrame?.bind(win) ?? (fn => win.setTimeout(() => fn(clock()), 16));
  const cancel = win.cancelAnimationFrame?.bind(win) ?? win.clearTimeout?.bind(win);
  const listeners = [];
  let ctx, frames = [], metadata = {}, ready = false, destroyed = false, visible = true;
  let width = 0, height = 0, dpr = 1, radius = 1, scale = .46, raf = null, renders = 0;
  let frame = 0, pendingFrame = 0, blend = false, ghosts = true, playing = false, reduced = false;
  let transition = null, nextFrameAt = 0, lastTime = 0, theme = 'light';
  let yaw = 0, pitch = 0, targetYaw = 0, targetPitch = 0;
  let velocityX = 0, velocityY = 0, resizeObserver, intersectionObserver;
  const pointer = { down: false, id: null, x: 0, y: 0 };
  const oldTouchAction = canvas?.style?.touchAction ?? '';
  const state = () => ({ frame, t: metadata.frames?.[frame]?.t ?? frame / Math.max(1, frames.length - 1),
    sourcePoints: metadata.frames?.[frame]?.sourcePoints ?? frames[frame]?.length / 3 ?? 0,
    playing, transitioning: Boolean(transition), fromFrame: transition?.from ?? frame,
    rotationX: pitch, rotationY: yaw });
  function stamp() {
    if (!canvas?.dataset) return;
    const s = state();
    Object.assign(canvas.dataset, { morphReady: String(ready && !destroyed), frame: String(frame),
      t: String(s.t), playing: String(playing), transitioning: String(s.transitioning),
      renderCount: String(renders), rotationX: pitch.toFixed(5), rotationY: yaw.toFixed(5),
      dragging: String(pointer.down) });
  }
  function notify() { stamp(); options.onChange?.(state()); }
  function active() { return ready && !destroyed && visible && !doc?.hidden && width > 0 && height > 0; }
  function invalidate() { if (active() && raf === null) raf = request(draw); }
  function stop() { if (raf !== null) cancel?.(raf); raf = null; lastTime = 0; }
  function on(target, name, fn, opts) {
    target?.addEventListener?.(name, fn, opts);
    listeners.push(() => target?.removeEventListener?.(name, fn, opts));
  }
  function resize() {
    if (!canvas || destroyed) return;
    const b = canvas.getBoundingClientRect();
    const w = Math.max(0, Math.min(2400, b.width)), h = Math.max(0, Math.min(1800, b.height));
    const ratio = Math.min(1.5, Math.max(1, win.devicePixelRatio || 1));
    const bw = Math.max(1, Math.round(w * ratio)), bh = Math.max(1, Math.round(h * ratio));
    if (w === width && h === height && ratio === dpr && canvas.width === bw && canvas.height === bh) return;
    width = w; height = h; dpr = ratio; canvas.width = bw; canvas.height = bh;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    invalidate();
  }
  function finishTransition() { const changed = Boolean(transition); transition = null; return changed; }
  function choose(index, time = clock(), allowTransition = true) {
    index = frameIndex(index, frames.length);
    const old = frame;
    transition = blend && !reduced && allowTransition && Math.abs(index - old) === 1
      ? { from: old, to: index, start: time, duration: 160 } : null;
    frame = index; notify(); invalidate();
  }
  function pause() {
    const changed = playing || Boolean(transition);
    playing = false; finishTransition(); nextFrameAt = 0;
    if (changed) { notify(); invalidate(); }
  }
  function pointerPosition(e) {
    const b = canvas.getBoundingClientRect();
    return [(e.clientX - b.left) * width / Math.max(1, b.width),
      (e.clientY - b.top) * height / Math.max(1, b.height)];
  }
  function down(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (pointer.down && e.pointerId !== pointer.id) return;
    const [x, y] = pointerPosition(e);
    Object.assign(pointer, { down: true, id: e.pointerId, x, y });
    velocityX = velocityY = 0;
    try { canvas.setPointerCapture?.(e.pointerId); } catch { /* Synthetic/ended pointer. */ }
    notify(); invalidate();
  }
  function move(e) {
    if (!pointer.down || e.pointerId !== pointer.id) return;
    const [x, y] = pointerPosition(e), dx = x - pointer.x, dy = y - pointer.y;
    targetYaw += dx * .008; targetPitch = clamp(targetPitch + dy * .006, -1.45, 1.45);
    velocityY = clamp(dx * .0015, -.05, .05); velocityX = clamp(dy * .001, -.035, .035);
    pointer.x = x; pointer.y = y;
    invalidate();
  }
  function up(e) {
    if (!pointer.down || e.pointerId !== pointer.id) return;
    pointer.down = false;
    if (reduced) velocityX = velocityY = 0;
    try { canvas.releasePointerCapture?.(e.pointerId); } catch { /* Already released. */ }
    notify(); invalidate();
  }
  function key(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const changes = { ArrowLeft: [-.18, 0], ArrowRight: [.18, 0], ArrowUp: [0, -.14], ArrowDown: [0, .14] };
    if (e.key === 'Home' || e.key.toLowerCase?.() === 'r') { e.preventDefault(); controller.resetView(); return; }
    if (!changes[e.key]) return;
    e.preventDefault(); velocityX = velocityY = 0;
    targetYaw += changes[e.key][0]; targetPitch = clamp(targetPitch + changes[e.key][1], -1.45, 1.45);
    invalidate();
  }
  function drawCloud(index, opacity, ghost = false) {
    if (opacity <= 0) return;
    const data = frames[index], list = [];
    const factor = Math.min(width, height) * scale;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (let i = 0; i < data.length; i += 3) {
      const x = data[i], y = data[i + 1], z = data[i + 2];
      const xx = x * cy + z * sy, zz = z * cy - x * sy;
      list.push([width / 2 + xx * factor, height / 2 - (y * cp - zz * sp) * factor, y * sp + zz * cp]);
    }
    list.sort((a, b) => a[2] - b[2]);
    const dark = theme === 'dark';
    for (const [x, y, z] of list) {
      const shade = clamp((z / radius + 1) / 2, 0, 1);
      const tone = Math.round(shade * 12);
      if (ghost) ctx.fillStyle = dark ? '#a5bcb3' : '#6e929b';
      else if (dark) ctx.fillStyle = `rgb(${76 + tone * 12},${104 + tone * 11},${108 + tone * 10})`;
      else ctx.fillStyle = `rgb(${132 - tone * 7},${158 - tone * 6},${162 - tone * 5})`;
      ctx.globalAlpha = opacity * (ghost ? .12 : .42 + shade * .52);
      const dot = ghost ? 1 : (width < 600 ? 1.05 : 1.25) * (.85 + shade * .5);
      ctx.beginPath(); ctx.arc(x, y, dot, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function draw(time) {
    raf = null;
    if (!active()) return;
    const dt = clamp(lastTime ? (time - lastTime) / 1000 : 1 / 60, .001, .05);
    lastTime = time;
    if (playing && time >= nextFrameAt) {
      while (time >= nextFrameAt && frame < frames.length - 1) {
        choose(frame + 1, time); nextFrameAt += 1000 / 12;
      }
      if (frame === frames.length - 1) { playing = false; finishTransition(); notify(); }
    }
    if (!pointer.down && !reduced) {
      targetYaw += velocityY * dt * 60;
      targetPitch = clamp(targetPitch + velocityX * dt * 60, -1.45, 1.45);
      velocityX *= Math.exp(-dt * 8); velocityY *= Math.exp(-dt * 8);
    }
    yaw = reduced ? targetYaw : ease(yaw, targetYaw, dt);
    pitch = reduced ? targetPitch : ease(pitch, targetPitch, dt);
    let mix = transition ? clamp((time - transition.start) / transition.duration, 0, 1) : 1;
    if (transition && mix >= 1) { finishTransition(); notify(); mix = 1; }
    ctx.clearRect(0, 0, width, height);
    if (ghosts) {
      for (const i of new Set([0, frames.length - 1]))
        if (i !== frame && i !== transition?.from) drawCloud(i, 1, true);
    }
    if (transition) drawCloud(transition.from, 1 - mix);
    drawCloud(frame, mix);
    renders++; stamp();
    const turning = Math.abs(yaw - targetYaw) + Math.abs(pitch - targetPitch) > .0005;
    const moving = !reduced && (turning || Math.abs(velocityX) + Math.abs(velocityY) > .0001);
    if (playing || transition || moving) invalidate();
    else lastTime = 0;
  }
  const controller = {
    ready: null,
    setFrame(value) {
      pendingFrame = value;
      if (!ready || destroyed) return;
      playing = false; nextFrameAt = 0; choose(value);
    },
    setBlend(value) {
      blend = Boolean(value);
      if (!blend && finishTransition()) { notify(); invalidate(); }
    },
    setGhosts(value) { ghosts = Boolean(value); invalidate(); },
    resetView() {
      if (destroyed) return;
      targetYaw = targetPitch = velocityX = velocityY = 0;
      if (reduced) yaw = pitch = 0;
      notify(); invalidate();
    },
    play() {
      if (!ready || destroyed || doc?.hidden || !visible) return;
      if (frame >= frames.length - 1) choose(0, clock(), false);
      playing = true; nextFrameAt = clock() + 1000 / 12; notify(); invalidate();
    },
    pause,
    setTheme(value) { if (destroyed) return; theme = value === 'dark' ? 'dark' : 'light'; invalidate(); },
    setReducedMotion(value) {
      if (destroyed) return;
      reduced = Boolean(value); velocityX = velocityY = 0;
      finishTransition();
      if (reduced) { yaw = targetYaw; pitch = targetPitch; }
      notify(); invalidate();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; ready = false; playing = false; transition = null; stop();
      listeners.forEach(off => off()); resizeObserver?.disconnect(); intersectionObserver?.disconnect();
      if (canvas?.style) canvas.style.touchAction = oldTouchAction;
      if (canvas?.dataset) { pointer.down = false; stamp(); }
      ctx?.clearRect(0, 0, width, height); frames = [];
    },
  };
  controller.ready = Promise.resolve().then(async () => {
    if (!canvas?.getContext) throw new Error('A canvas is required for the saved-surface figure.');
    ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) throw new Error('Canvas is unavailable; the recording remains available.');
    const data = options.frames ? { frames: options.frames, metadata: options.metadata ?? {} }
      : await import('./morph-cloud-data.js');
    if (destroyed) return controller;
    frames = data.frames; metadata = data.metadata ?? {};
    if (!Array.isArray(frames) || !frames.length) throw new Error('No saved surfaces were supplied.');
    radius = Number(metadata.maxSampleRadius) || 0;
    for (const points of frames) {
      if (!points?.length || points.length % 3) throw new Error('A saved point cloud is incomplete.');
      for (let i = 0; i < points.length; i += 3) {
        if (![points[i], points[i + 1], points[i + 2]].every(Number.isFinite)) throw new Error('Invalid saved surface coordinates.');
        radius = Math.max(radius, Math.hypot(points[i], points[i + 1], points[i + 2]));
      }
    }
    scale = fitScaleForRadius(radius);
    const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    reduced = Boolean(media?.matches);
    on(media, 'change', e => controller.setReducedMotion(e.matches));
    canvas.style.touchAction = 'pan-y';
    on(canvas, 'pointerdown', down); on(canvas, 'pointermove', move);
    on(canvas, 'pointerup', up); on(canvas, 'pointercancel', up); on(canvas, 'keydown', key);
    on(doc, 'visibilitychange', () => {
      if (doc.hidden) { pause(); stop(); } else invalidate();
    });
    if (win.ResizeObserver) { resizeObserver = new win.ResizeObserver(resize); resizeObserver.observe(canvas); }
    else on(win, 'resize', resize, { passive: true });
    if (win.IntersectionObserver) {
      intersectionObserver = new win.IntersectionObserver(entries => {
        visible = entries[0]?.isIntersecting !== false;
        if (visible) invalidate(); else { pause(); stop(); }
      }, { rootMargin: '60px' });
      intersectionObserver.observe(canvas);
    }
    frame = frameIndex(pendingFrame, frames.length); ready = true; resize(); notify();
    options.onReady?.({ ...state(), metadata, frameCount: frames.length, pointsPerFrame: frames[0].length / 3 });
    return controller;
  }).catch(error => {
    if (canvas?.dataset) canvas.dataset.morphReady = 'false';
    options.onError?.(error); throw error;
  });
  return controller;
}
