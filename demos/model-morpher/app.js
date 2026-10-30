// Model Morpher interactive 3D surface viewer: binds the scrubber, triptych
// presets and rotation controls to the 30 saved production surfaces.
import { mountMorphViewer, renderMorphThumbnail } from '../../assets/model-morpher/morph-cloud-viewer.js';

const LAST = 29;
const num = new Intl.NumberFormat('en-GB');

const $ = (id) => document.getElementById(id);
const plate = $('plate');
const canvas = $('morph-canvas');
const triptych = $('triptych');
const controls = $('controls');
const help = $('view-help');
const slider = $('progress');
const playBtn = $('play');
const resetBtn = $('reset');
const blendBox = $('blend');
const ghostBox = $('ghosts');
const presets = Array.from(document.querySelectorAll('[data-frame]'));
const thumbs = Array.from(document.querySelectorAll('[data-thumb-frame]'));
const video = $('recording-video');

const out = {
  frame: $('st-frame'),
  t: $('st-t'),
  points: $('st-points'),
  line: $('state-line'),
  live: $('state-live'),
  badge: $('badge-frame'),
  stage: $('badge-stage'),
};

let meta = null;
let pointsPerFrame = 2048;
let lastAnnounced = '';
let wasPlaying = false;

function stageName(frame) {
  if (frame === 0) return 'Start · Dentate gyrus';
  if (frame === LAST) return 'End · Whole mouse brain';
  if (frame === 15) return 'Middle · Computed shape';
  return 'Computed shape in between';
}

function stageSentence(frame) {
  if (frame === 0) return 'Start surface: mouse dentate gyrus (Allen CCF region 726).';
  if (frame === LAST) return 'End surface: whole mouse brain (Allen CCF root 997).';
  if (frame === 15) return 'Middle saved surface (frame 15 of 0–29, blend 15/29) between dentate gyrus and whole brain.';
  return `Computed intermediate surface — step ${frame + 1} of 30 (blend ${frame}/29).`;
}

function sourceCount(frame, fromChange) {
  if (Number.isFinite(fromChange)) return fromChange;
  const f = meta && meta.frames && meta.frames[frame];
  return f && Number.isFinite(f.sourcePoints) ? f.sourcePoints : null;
}

function settledSentence(frame, src) {
  const srcText = src == null ? 'unknown' : num.format(src);
  return `${stageName(frame)}, frame ${frame} of 0 to ${LAST} (${frame}/${LAST}). ${num.format(pointsPerFrame)} vertices shown from ${srcText}.`;
}

function announce(text) {
  if (text === lastAnnounced) return;
  lastAnnounced = text;
  out.live.textContent = text;
}

function showFallback(message) {
  plate.classList.remove('is-live');
  if (triptych) triptych.hidden = true;
  controls.hidden = true;
  help.hidden = true;
  out.frame.textContent = '29';
  out.badge.textContent = '29';
  if (out.stage) out.stage.textContent = stageName(29);
  out.t.textContent = '29/29';
  out.points.textContent = 'Rendered surface; point viewer inactive';
  canvas.removeAttribute('tabindex');
  out.line.classList.remove('is-transition');
  out.line.textContent = message;
}

async function paintTriptych() {
  if (!thumbs.length) return;
  try {
    const data = await import('../../assets/model-morpher/morph-cloud-data.js');
    const radius = Number(data.metadata?.maxSampleRadius) || 1.0878;
    for (const thumb of thumbs) {
      const idx = Number(thumb.dataset.thumbFrame);
      if (data.frames?.[idx]) renderMorphThumbnail(thumb, data.frames[idx], radius, { theme: 'dark' });
    }
  } catch {
    /* Main viewer handles load errors. */
  }
}

function render(state) {
  const frame = Math.max(0, Math.min(LAST, Math.round(state.frame)));
  const src = sourceCount(frame, state.sourcePoints);

  out.frame.textContent = String(frame);
  out.badge.textContent = String(frame);
  if (out.stage) out.stage.textContent = stageName(frame);
  out.t.textContent = `${frame}/${LAST}`;
  out.points.textContent = `${num.format(pointsPerFrame)} of ${src == null ? '—' : num.format(src)}`;

  if (Number(slider.value) !== frame) slider.value = String(frame);
  presets.forEach((b) => {
    b.setAttribute('aria-current', Number(b.dataset.frame) === frame ? 'true' : 'false');
  });

  playBtn.textContent = state.playing ? 'Pause' : 'Play';
  playBtn.setAttribute('aria-pressed', state.playing ? 'true' : 'false');

  if (state.transitioning && Number.isFinite(state.fromFrame) && state.fromFrame !== frame) {
    out.line.classList.add('is-transition');
    out.line.textContent = `Cross-fading frame ${state.fromFrame} → ${frame} (opacity only; coordinates unchanged).`;
  } else {
    out.line.classList.remove('is-transition');
    out.line.textContent = state.playing
      ? 'Playing the 30 saved surfaces in order (12 frames per second).'
      : stageSentence(frame);
  }

  if (!state.playing && !state.transitioning) {
    announce(wasPlaying ? `Paused. ${settledSentence(frame, src)}` : settledSentence(frame, src));
  }
  wasPlaying = Boolean(state.playing);
}

let viewer;
try {
  viewer = mountMorphViewer(canvas, {
    theme: 'dark',
    ghosts: Boolean(ghostBox?.checked),
    blend: Boolean(blendBox?.checked),
    onReady(info) {
      meta = info.metadata || null;
      if (Number.isFinite(info.pointsPerFrame)) pointsPerFrame = info.pointsPerFrame;
      plate.classList.add('is-live');
      if (triptych) triptych.hidden = false;
      controls.hidden = false;
      help.hidden = false;
      canvas.tabIndex = 0;
      render({ frame: 0, playing: false, transitioning: false });
      paintTriptych();
    },
    onChange: render,
    onError(err) {
      console.error(err);
      showFallback('The interactive 3D view could not load. The poster above and the rendered recording below remain available.');
    },
  });
} catch (err) {
  console.error(err);
  showFallback('The interactive 3D view could not start. The poster above and the rendered recording below remain available.');
}

if (viewer) {
  out.line.textContent = 'Loading the 30 saved surfaces…';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const applyMotion = () => viewer.setReducedMotion(reduced.matches);
  applyMotion();
  if (reduced.addEventListener) reduced.addEventListener('change', applyMotion);

  viewer.setTheme('dark');
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

  if (video) video.addEventListener('play', () => viewer.pause());

  if (viewer.ready && typeof viewer.ready.catch === 'function') {
    viewer.ready.catch(() => {
      showFallback('The interactive 3D view could not load. The poster above and the rendered recording below remain available.');
    });
  }

  window.addEventListener('pagehide', (e) => {
    if (!e.persisted) viewer.destroy();
  });
}
