/* Interface artwork from an openly licensed atlas surface. The cursor response
   is a display treatment, not a neural simulation or a connectivity model. */

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function rotatePoint(x, y, z, yaw, pitch, roll = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const rx = x * cy + z * sy;
  const rz = z * cy - x * sy;
  const ry = y * cp - rz * sp;
  const depth = y * sp + rz * cp;
  return [rx * cr - ry * sr, rx * sr + ry * cr, depth];
}

export function projectPoint(x, y, z, width, height, scale = 0.43) {
  const perspective = 4 / Math.max(1.5, 4 - z);
  const radius = Math.min(width, height) * scale;
  return [width / 2 + x * radius * perspective,
    height / 2 - y * radius * perspective, perspective];
}

export function easeValue(current, target, seconds, rate = 13) {
  if (seconds <= 0) return current;
  return target + (current - target) * Math.exp(-rate * Math.max(0, seconds));
}

/* Bound every orientation by the perspective projection of its enclosing sphere. */
export function fitScaleForRadius(radius, padding = 0.045) {
  if (!(radius > 0) || radius >= 4) throw new Error('Surface radius is outside the display camera.');
  const projectedRadius = radius * 4 / Math.sqrt(16 - radius * radius);
  return Math.min(0.44, (0.5 - padding) / projectedRadius);
}

const VIEWS = {
  overview: [-0.47, -0.13, 0.04],
  morphbrain: [-0.82, 0.05, -0.03],
  'model-morpher': [0.35, -0.16, 0.07],
  morpher: [0.35, -0.16, 0.07],
  morphliner: [1.12, 0.17, -0.07],
  fly: [-1.12, 0.26, 0.02],
  g27: [-0.08, 0.49, 0.06],
  signals: [-0.08, 0.49, 0.06],
};

const ACCENTS = {
  overview: [177, 134, 226], morphbrain: [90, 193, 165],
  'model-morpher': [177, 134, 226], morpher: [177, 134, 226],
  morphliner: [223, 171, 104], fly: [164, 191, 230],
  g27: [210, 137, 182], signals: [210, 137, 182],
};

function paletteFor(theme) {
  const dark = theme === 'dark';
  const low = dark ? [48, 84, 80] : [134, 155, 148];
  const high = dark ? [224, 245, 233] : [16, 59, 50];
  return Array.from({ length: 24 }, (_, i) => {
    const t = i / 23;
    return `rgb(${low.map((v, j) => Math.round(v + (high[j] - v) * t)).join(',')})`;
  });
}

/** Mount an event-driven canvas surface. No renderer loop remains active at rest. */
export function mountScene(canvas, options = {}) {
  const win = canvas?.ownerDocument?.defaultView ?? globalThis;
  const doc = canvas?.ownerDocument;
  const now = () => win.performance?.now?.() ?? Date.now();
  const request = win.requestAnimationFrame?.bind(win) ?? (fn => win.setTimeout(() => fn(now()), 16));
  const cancel = win.cancelAnimationFrame?.bind(win) ?? win.clearTimeout?.bind(win);
  const listeners = [];
  let ctx, points, metadata, offsets, count = 0, order = [], projected, cameraScale = 0.4;
  let width = 0, height = 0, dpr = 1, raf = null, destroyed = false;
  let visible = true, ready = false, reduced = false, theme = 'dark';
  let colors = paletteFor(theme), project = 'overview';
  let yaw = VIEWS.overview[0], pitch = VIEWS.overview[1], roll = VIEWS.overview[2];
  let userYaw = yaw, userPitch = pitch, targetRoll = roll;
  let spinX = 0, spinY = 0, parallaxX = 0, parallaxY = 0;
  let lastTime = 0, animateUntil = 0, renders = 0;
  const pointer = { x: -9999, y: -9999, inside: false, down: false, id: null,
    lastX: 0, lastY: 0, moved: 0 };
  let pulse = null, resizeObserver, intersectionObserver;
  const oldTouchAction = canvas?.style?.touchAction ?? '';

  function notify(type) {
    options.onInteraction?.({ type, project, rotationX: pitch, rotationY: yaw });
  }
  function stamp(influence = 0) {
    if (!canvas?.dataset) return;
    canvas.dataset.sceneReady = String(ready && !destroyed);
    canvas.dataset.renderCount = String(renders);
    canvas.dataset.rotationX = pitch.toFixed(4);
    canvas.dataset.rotationY = yaw.toFixed(4);
    canvas.dataset.pointerInfluence = influence.toFixed(3);
    canvas.dataset.project = project;
    canvas.dataset.pointCount = String(count);
  }
  function active() { return ready && !destroyed && visible && !doc?.hidden && width > 0 && height > 0; }
  function invalidate(duration = 1200) {
    animateUntil = Math.max(animateUntil, now() + (reduced ? 0 : duration));
    if (active() && raf === null) raf = request(draw);
  }
  function stop() { if (raf !== null) cancel?.(raf); raf = null; lastTime = 0; }
  function on(target, event, fn, opts) {
    target?.addEventListener?.(event, fn, opts);
    listeners.push(() => target?.removeEventListener?.(event, fn, opts));
  }
  function resize() {
    if (destroyed || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(0, Math.min(2400, rect.width));
    const nextHeight = Math.max(0, Math.min(1800, rect.height));
    const nextDpr = Math.min(1.5, Math.max(1, win.devicePixelRatio || 1));
    const pixelWidth = Math.max(1, Math.round(nextWidth * nextDpr));
    const pixelHeight = Math.max(1, Math.round(nextHeight * nextDpr));
    if (width === nextWidth && height === nextHeight && dpr === nextDpr &&
        canvas.width === pixelWidth && canvas.height === pixelHeight) return;
    width = nextWidth; height = nextHeight; dpr = nextDpr;
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    invalidate(500);
  }
  function localPointer(event) {
    const rect = canvas.getBoundingClientRect();
    return [(event.clientX - rect.left) * width / Math.max(1, rect.width),
      (event.clientY - rect.top) * height / Math.max(1, rect.height)];
  }
  function move(event) {
    const [x, y] = localPointer(event);
    pointer.x = x; pointer.y = y;
    pointer.inside = event.pointerType !== 'touch' || pointer.down;
    if (pointer.down && event.pointerId === pointer.id) {
      const dx = x - pointer.lastX, dy = y - pointer.lastY;
      userYaw += dx * 0.008;
      userPitch = clamp(userPitch + dy * 0.006, -1.15, 1.15);
      spinY = clamp(dx * 0.002, -0.065, 0.065);
      spinX = clamp(dy * 0.0015, -0.04, 0.04);
      pointer.moved += Math.abs(dx) + Math.abs(dy);
      pointer.lastX = x; pointer.lastY = y;
    }
    parallaxY = pointer.inside && !reduced ? (x / Math.max(1, width) - 0.5) * 0.48 : 0;
    parallaxX = pointer.inside && !reduced ? (y / Math.max(1, height) - 0.5) * 0.26 : 0;
    invalidate();
  }
  function down(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (pointer.down && event.pointerId !== pointer.id) return;
    const [x, y] = localPointer(event);
    Object.assign(pointer, { down: true, inside: true, id: event.pointerId,
      x, y, lastX: x, lastY: y, moved: 0 });
    spinX = 0; spinY = 0;
    try { canvas.setPointerCapture?.(event.pointerId); } catch { /* already cancelled */ }
    canvas.dataset.dragging = 'true';
    invalidate(); notify('drag-start');
  }
  function up(event) {
    if (!pointer.down || event.pointerId !== pointer.id) return;
    if (pointer.moved < 8 && !reduced) pulse = { x: pointer.x, y: pointer.y, age: 0 };
    pointer.down = false;
    canvas.dataset.dragging = 'false';
    if (event.pointerType === 'touch') {
      pointer.inside = false; parallaxX = 0; parallaxY = 0;
    }
    try { canvas.releasePointerCapture?.(event.pointerId); } catch { /* browser released it */ }
    if (reduced) spinX = spinY = 0;
    invalidate(); notify(pointer.moved < 8 ? 'probe' : 'orbit');
  }
  function leave() {
    if (pointer.down) return;
    pointer.inside = false; parallaxX = 0; parallaxY = 0; invalidate();
  }
  function key(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const moves = { ArrowLeft: [-0.18, 0], ArrowRight: [0.18, 0],
      ArrowUp: [0, -0.14], ArrowDown: [0, 0.14] };
    if (event.key === 'Home') { event.preventDefault(); controller.reset(); notify('keyboard'); return; }
    if (!moves[event.key]) return;
    event.preventDefault();
    userYaw += moves[event.key][0];
    userPitch = clamp(userPitch + moves[event.key][1], -1.15, 1.15);
    invalidate(); notify('keyboard');
  }

  function draw(time) {
    raf = null;
    if (!active()) return;
    const dt = clamp(lastTime ? (time - lastTime) / 1000 : 1 / 60, 0.001, 0.04);
    lastTime = time;
    if (!pointer.down && !reduced) {
      userYaw += spinY * dt * 60;
      userPitch = clamp(userPitch + spinX * dt * 60, -1.15, 1.15);
      spinX *= Math.exp(-dt * 7); spinY *= Math.exp(-dt * 7);
    }
    const targetYaw = userYaw + parallaxY;
    const targetPitch = userPitch + parallaxX;
    yaw = reduced ? targetYaw : easeValue(yaw, targetYaw, dt);
    pitch = reduced ? targetPitch : easeValue(pitch, targetPitch, dt);
    roll = reduced ? targetRoll : easeValue(roll, targetRoll, dt);
    ctx.clearRect(0, 0, width, height);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const sampleStep = width < 600 ? 2 : 1;
    const radius = Math.min(width, height) * cameraScale;
    const fieldRadius = clamp(Math.min(width, height) * 0.25, 75, 165);
    let influence = 0, settling = false;
    const accent = ACCENTS[project] ?? ACCENTS.overview;
    const accentStyle = `rgb(${accent.join(',')})`;
    for (let i = 0; i < count; i += sampleStep) {
      const p = i * 3, x = points[p], y = points[p + 1], z = points[p + 2];
      const rx = x * cy + z * sy, rz = z * cy - x * sy;
      const ry = y * cp - rz * sp, depth = y * sp + rz * cp;
      const xx = rx * cr - ry * sr, yy = rx * sr + ry * cr;
      const perspective = 4 / (4 - depth);
      const px = width / 2 + xx * radius * perspective;
      const py = height / 2 - yy * radius * perspective;
      let dx = 0, dy = 0, light = 0;
      if (pointer.inside) {
        const vx = px - pointer.x, vy = py - pointer.y;
        const distance = Math.hypot(vx, vy);
        if (distance < fieldRadius) {
          light = (1 - distance / fieldRadius) ** 2;
          const force = light * (pointer.down ? 32 : 24);
          dx = vx / Math.max(9, distance) * force;
          dy = vy / Math.max(9, distance) * force;
          influence = Math.max(influence, light);
        }
      }
      if (pulse) {
        const vx = px - pulse.x, vy = py - pulse.y, distance = Math.hypot(vx, vy);
        const wave = Math.exp(-(((distance - pulse.age * 340) / 23) ** 2)) * Math.max(0, 1 - pulse.age / 0.8);
        dx += vx / Math.max(9, distance) * wave * 15;
        dy += vy / Math.max(9, distance) * wave * 15;
        light = Math.max(light, wave * 0.8);
      }
      const o = i * 2;
      const oldX = offsets[o], oldY = offsets[o + 1];
      offsets[o] = reduced ? dx : easeValue(oldX, dx, dt, 17);
      offsets[o + 1] = reduced ? dy : easeValue(oldY, dy, dt, 17);
      if (Math.abs(offsets[o] - dx) + Math.abs(offsets[o + 1] - dy) > 0.09) settling = true;
      const j = i * 5;
      projected[j] = px + offsets[o]; projected[j + 1] = py + offsets[o + 1];
      projected[j + 2] = depth; projected[j + 3] = perspective; projected[j + 4] = light;
    }
    order.length = 0;
    for (let i = 0; i < count; i += sampleStep) order.push(i);
    order.sort((a, b) => projected[a * 5 + 2] - projected[b * 5 + 2]);
    for (const i of order) {
      const j = i * 5, depth = projected[j + 2], light = projected[j + 4];
      const shade = clamp((depth + 1.1) / 2.2, 0, 1);
      ctx.fillStyle = light > 0.12 ? accentStyle : colors[Math.round(shade * 23)];
      ctx.globalAlpha = light > 0.12 ? 0.65 + light * 0.35 : 0.26 + shade * 0.7;
      const dot = (width < 600 ? 0.9 : 1.1) * projected[j + 3] * (0.8 + shade * 0.5) + light * 1.4;
      ctx.beginPath(); ctx.arc(projected[j], projected[j + 1], dot, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (pointer.inside) {
      ctx.strokeStyle = accentStyle; ctx.globalAlpha = pointer.down ? 0.7 : 0.38;
      ctx.lineWidth = 1; ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, pointer.down ? 13 : 7, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (pulse) { pulse.age += dt; if (pulse.age > 0.8) pulse = null; }
    renders++; stamp(influence);
    const turning = Math.abs(yaw - targetYaw) + Math.abs(pitch - targetPitch) + Math.abs(roll - targetRoll) > 0.0005;
    if (!reduced && time < animateUntil && (turning || settling || pulse || Math.abs(spinX) + Math.abs(spinY) > 0.0001))
      raf = request(draw);
    else lastTime = 0;
  }

  const controller = {
    ready: null,
    setProject(id) {
      if (destroyed) return;
      project = String(id || 'overview');
      const view = VIEWS[project] ?? VIEWS.overview;
      userYaw = view[0]; userPitch = view[1]; targetRoll = view[2]; spinX = spinY = 0;
      invalidate(1500); stamp(); notify('project');
    },
    reset() {
      if (destroyed) return;
      const view = VIEWS[project] ?? VIEWS.overview;
      userYaw = view[0]; userPitch = view[1]; targetRoll = view[2];
      parallaxX = parallaxY = spinX = spinY = 0; pulse = null;
      pointer.inside = false; invalidate(); notify('reset');
    },
    setTheme(value) { theme = value === 'light' ? 'light' : 'dark'; colors = paletteFor(theme); invalidate(0); },
    setReducedMotion(value) {
      reduced = Boolean(value); spinX = spinY = parallaxX = parallaxY = 0; pulse = null;
      invalidate(0);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; ready = false; stop(); listeners.forEach(off => off());
      resizeObserver?.disconnect(); intersectionObserver?.disconnect();
      if (canvas?.style) canvas.style.touchAction = oldTouchAction;
      if (canvas?.dataset) { canvas.dataset.dragging = 'false'; stamp(); }
      ctx?.clearRect(0, 0, width, height);
      points = offsets = projected = null; order = [];
    },
  };

  controller.ready = Promise.resolve().then(async () => {
    if (!canvas?.getContext) throw new Error('A canvas element is required for the surface scene.');
    ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) throw new Error('Canvas rendering is unavailable; the static surface remains available.');
    const data = options.positions ? { positions: options.positions, metadata: options.metadata ?? {} }
      : await import('./brain-surface-data.js');
    if (destroyed) return controller;
    if (!data.positions || data.positions.length < 9 || data.positions.length % 3)
      throw new Error('The display surface is incomplete.');
    if (data.positions.some(value => !Number.isFinite(value)))
      throw new Error('The display surface contains invalid coordinates.');
    points = data.positions; metadata = data.metadata; count = points.length / 3;
    let surfaceRadius = 0;
    for (let i = 0; i < points.length; i += 3)
      surfaceRadius = Math.max(surfaceRadius, Math.hypot(points[i], points[i + 1], points[i + 2]));
    cameraScale = fitScaleForRadius(surfaceRadius);
    offsets = new Float32Array(count * 2); projected = new Float32Array(count * 5);
    const media = win.matchMedia?.('(prefers-reduced-motion: reduce)');
    reduced = Boolean(media?.matches);
    on(media, 'change', event => controller.setReducedMotion(event.matches));
    canvas.style.touchAction = 'pan-y';
    on(canvas, 'pointerenter', move); on(canvas, 'pointermove', move);
    on(canvas, 'pointerdown', down); on(canvas, 'pointerup', up);
    on(canvas, 'pointercancel', up); on(canvas, 'pointerleave', leave);
    on(canvas, 'keydown', key);
    on(doc, 'visibilitychange', () => { if (doc.hidden) stop(); else invalidate(500); });
    if (win.ResizeObserver) { resizeObserver = new win.ResizeObserver(resize); resizeObserver.observe(canvas); }
    else on(win, 'resize', resize, { passive: true });
    if (win.IntersectionObserver) {
      intersectionObserver = new win.IntersectionObserver(entries => {
        visible = entries[0]?.isIntersecting !== false;
        if (visible) invalidate(600); else stop();
      }, { rootMargin: '80px' });
      intersectionObserver.observe(canvas);
    }
    ready = true; resize(); stamp(); options.onReady?.({ metadata, pointCount: count });
    return controller;
  }).catch(error => {
    if (canvas?.dataset) canvas.dataset.sceneReady = 'false';
    options.onError?.(error);
    throw error;
  });
  return controller;
}
