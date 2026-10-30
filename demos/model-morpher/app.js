// Model Morpher surface morph study: binds the page controls to the shared
// point-cloud engine. The HTML is a complete static fallback (poster, recording,
// caption, source); this script only reveals controls once the engine is ready.
import { mountMorphViewer } from '../../assets/model-morpher/morph-cloud-viewer.js';

const LAST = 29;
const num = new Intl.NumberFormat('en-GB');

const $ = (id) => document.getElementById(id);
const plate = $('plate');
const canvas = $('morph-canvas');
const controls = $('controls');
const help = $('view-help');
const slider = $('progress');
const playBtn = $('play');
const resetBtn = $('reset');
const blendBox = $('blend');
const ghostBox = $('ghosts');
const presets = Array.from(document.querySelectorAll('[data-frame]'));
const video = $('recording-video');

const out = {
  frame: $('st-frame'),
  t: $('st-t'),
  points: $('st-points'),
  line: $('state-line'),
  live: $('state-live'),
  badge: $('badge-frame'),
};

let meta = null;
let pointsPerFrame = 2048;
let lastAnnounced = '';
let wasPlaying = false;

function tText(frame) {
  return `t = ${frame}/${LAST} = ${(frame / LAST).toFixed(3)}`;
}

function sourceCount(frame, fromChange) {
  if (Number.isFinite(fromChange)) return fromChange;
  const f = meta && meta.frames && meta.frames[frame];
  return f && Number.isFinite(f.sourcePoints) ? f.sourcePoints : null;
}

function settledSentence(frame, src) {
  const srcText = src == null ? 'unknown' : num.format(src);
  return `Saved surface ${frame + 1} of ${LAST + 1}, ${tText(frame)}. ${num.format(pointsPerFrame)} points sampled from ${srcText} vertices.`;
}

function announce(text) {
  if (text === lastAnnounced) return;
  lastAnnounced = text;
  out.live.textContent = text;
}

function showFallback(message) {
  plate.classList.remove('is-live');
  controls.hidden = true;
  help.hidden = true;
  out.frame.textContent = '29';
  out.badge.textContent = '29';
  out.t.textContent = tText(29);
  out.points.textContent = 'Rendered surface; point viewer inactive';
  canvas.removeAttribute('tabindex');
  out.line.classList.remove('is-transition');
  out.line.textContent = message;
}

function render(state) {
  const frame = Math.max(0, Math.min(LAST, Math.round(state.frame)));
  const src = sourceCount(frame, state.sourcePoints);

  out.frame.textContent = String(frame);
  out.badge.textContent = String(frame);
  out.t.textContent = tText(frame);
  out.points.textContent = `${num.format(pointsPerFrame)} of ${src == null ? '—' : num.format(src)}`;

  if (Number(slider.value) !== frame) slider.value = String(frame);
  presets.forEach((b) => {
    b.setAttribute('aria-current', Number(b.dataset.frame) === frame ? 'true' : 'false');
  });

  playBtn.textContent = state.playing ? 'Pause' : 'Play';
  playBtn.setAttribute('aria-pressed', state.playing ? 'true' : 'false');

  if (state.transitioning && Number.isFinite(state.fromFrame) && state.fromFrame !== frame) {
    out.line.classList.add('is-transition');
    out.line.textContent = `Transition: frame ${state.fromFrame} → ${frame} (opacity blend, not a computed shape)`;
  } else {
    out.line.classList.remove('is-transition');
    out.line.textContent = state.playing
      ? 'Playing saved frames in order at 12 frames per second.'
      : 'One actual saved surface, shown as vertex samples.';
  }

  // Live region: only settled, paused states and the moment playback stops.
  if (!state.playing && !state.transitioning) {
    announce(wasPlaying ? `Paused. ${settledSentence(frame, src)}` : settledSentence(frame, src));
  }
  wasPlaying = Boolean(state.playing);
}

let viewer;
try {
  viewer = mountMorphViewer(canvas, {
    onReady(info) {
      meta = info.metadata || null;
      if (Number.isFinite(info.pointsPerFrame)) pointsPerFrame = info.pointsPerFrame;
      plate.classList.add('is-live');
      controls.hidden = false;
      help.hidden = false;
      canvas.tabIndex = 0;
      render({ frame: 0, playing: false, transitioning: false });
    },
    onChange: render,
    onError(err) {
      console.error(err);
      showFallback('The interactive point view could not load. The poster above and the original recording below are still available.');
    },
  });
} catch (err) {
  console.error(err);
  showFallback('The interactive point view could not start. The poster above and the original recording below are still available.');
}

if (viewer) {
  out.line.textContent = 'Loading the saved point sets…';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const applyMotion = () => viewer.setReducedMotion(reduced.matches);
  applyMotion();
  if (reduced.addEventListener) reduced.addEventListener('change', applyMotion);

  try { viewer.setTheme('light'); } catch (err) { console.warn(err); }
  viewer.setBlend(blendBox.checked);
  viewer.setGhosts(ghostBox.checked);

  slider.addEventListener('input', () => {
    if (playBtn.getAttribute('aria-pressed') === 'true') viewer.pause();
    viewer.setFrame(Number(slider.value));
  });

  presets.forEach((b) => {
    b.addEventListener('click', () => {
      viewer.pause();
      viewer.setFrame(Number(b.dataset.frame));
    });
  });

  playBtn.addEventListener('click', () => {
    if (playBtn.getAttribute('aria-pressed') === 'true') viewer.pause();
    else viewer.play();
  });

  resetBtn.addEventListener('click', () => viewer.resetView());
  blendBox.addEventListener('change', () => viewer.setBlend(blendBox.checked));
  ghostBox.addEventListener('change', () => viewer.setGhosts(ghostBox.checked));

  // The recording is independent; pause the point view rather than run both.
  if (video) video.addEventListener('play', () => viewer.pause());

  if (viewer.ready && typeof viewer.ready.catch === 'function') {
    viewer.ready.catch(() => {
      showFallback('The interactive point view could not load. The poster above and the original recording below are still available.');
    });
  }

  window.addEventListener('pagehide', (e) => {
    if (!e.persisted) viewer.destroy();
  });
}
