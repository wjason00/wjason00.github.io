/* Homepage Model Morpher interactive entry: mounts the 30 saved surfaces
   with a 3-frame triptych (0, 15, 29) and scrubber, keeping the MP4 recording
   as a progressive fallback and secondary disclosure. */
import { mountMorphViewer, renderMorphThumbnail } from '../model-morpher/morph-cloud-viewer.js';

const LAST = 29;

function stageLabel(frame) {
  if (frame === 0) return 'Start · Dentate gyrus';
  if (frame === LAST) return 'End · Whole mouse brain';
  if (frame === 15) return 'Middle · Computed shape';
  return 'Computed shape in between';
}

export async function initMorphEntry(container = document.querySelector('[data-morph-entry]')) {
  if (!container) return null;
  const canvas = container.querySelector('[data-morph-canvas]');
  const slider = container.querySelector('[data-morph-range]');
  const playBtn = container.querySelector('[data-morph-play]');
  const resetBtn = container.querySelector('[data-morph-reset]');
  const output = container.querySelector('[data-morph-output]');
  const badge = container.querySelector('[data-morph-badge]');
  const live = container.querySelector('[data-morph-live]');
  const recording = container.querySelector('[data-morph-recording]');
  const presets = [...container.querySelectorAll('[data-morph-frame]')];
  const thumbs = [...container.querySelectorAll('[data-morph-thumb]')];

  if (!canvas) return null;

  function fail() {
    container.dataset.morphState = 'error';
    if (recording) recording.open = true;
  }

  let data;
  try {
    data = await import('../model-morpher/morph-cloud-data.js');
  } catch {
    fail();
    return null;
  }

  const radius = Number(data.metadata?.maxSampleRadius) || 1.0878;
  let lastLive = '';

  function paintThumbs() {
    for (const thumb of thumbs) {
      const idx = Number(thumb.dataset.morphThumb);
      if (data.frames?.[idx]) {
        renderMorphThumbnail(thumb, data.frames[idx], radius, { theme: 'dark' });
      }
    }
  }

  function updateUI(state) {
    const frame = Math.max(0, Math.min(LAST, Math.round(state.frame)));
    const label = stageLabel(frame);
    if (slider && Number(slider.value) !== frame) slider.value = String(frame);
    if (output) output.textContent = `${frame} / ${LAST}`;
    if (badge) badge.textContent = `Step ${frame} of 0–${LAST} · ${label}`;
    for (const btn of presets) {
      const match = Number(btn.dataset.morphFrame) === frame;
      btn.setAttribute('aria-current', match ? 'true' : 'false');
    }
    if (playBtn) {
      playBtn.textContent = state.playing ? 'Pause' : 'Play';
      playBtn.setAttribute('aria-pressed', state.playing ? 'true' : 'false');
    }
    if (live && !state.playing && !state.transitioning) {
      const msg = `${label}, saved surface ${frame} of 0 to ${LAST} (blend ${frame}/${LAST}).`;
      if (msg !== lastLive) {
        lastLive = msg;
        live.textContent = msg;
      }
    }
  }

  let viewer = null;
  try {
    viewer = mountMorphViewer(canvas, {
      frames: data.frames,
      metadata: data.metadata,
      initialFrame: 15,
      theme: 'dark',
      ghosts: false,
      blend: true,
      onReady() {
        container.dataset.morphState = 'ready';
        canvas.tabIndex = 0;
        if (recording) recording.open = false;
        paintThumbs();
        updateUI({ frame: 15, playing: false, transitioning: false });
      },
      onChange: updateUI,
      onError: fail,
    });
    viewer.ready?.catch(fail);
  } catch {
    fail();
    return null;
  }

  slider?.addEventListener('input', () => {
    viewer.setFrame(Number(slider.value));
  });

  for (const btn of presets) {
    btn.addEventListener('click', () => {
      viewer.setFrame(Number(btn.dataset.morphFrame));
    });
  }

  playBtn?.addEventListener('click', () => {
    if (playBtn.getAttribute('aria-pressed') === 'true') {
      viewer.pause();
    } else {
      for (const video of document.querySelectorAll('video')) {
        if (!video.paused) video.pause();
      }
      viewer.play();
    }
  });

  resetBtn?.addEventListener('click', () => {
    viewer.resetView();
  });

  document.addEventListener('play', event => {
    if (event.target instanceof HTMLVideoElement) viewer.pause();
  }, true);

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(paintThumbs, 140);
  }, { passive: true });

  return viewer;
}
