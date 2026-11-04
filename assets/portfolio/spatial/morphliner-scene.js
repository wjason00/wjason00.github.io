// Exact moments from the native export; no playback starts automatically.
export function initMorphlinerScene(root = typeof document === 'undefined' ? null : document) {
  const scene = root?.matches?.('.morphliner-study') ? root : root?.querySelector?.('.morphliner-study');
  if (!scene || scene.dataset.morphlinerMounted) return;
  const video = scene.querySelector('[data-morphliner-video]');
  const inspect = scene.querySelector('[data-morphliner-inspect]');
  const status = scene.querySelector('[data-morphliner-status]');
  const buttons = Array.from(scene.querySelectorAll('[data-morphliner-time]'));
  if (!video || !inspect || !status || !buttons.length) return;
  scene.dataset.morphlinerMounted = 'true';

  let selected = null;
  let metadataRequested = false;
  const instruction = 'Select a still to pause the film at that moment.';
  function clearSelection() {
    selected = null;
    buttons.forEach(button => button.setAttribute('aria-pressed', 'false'));
    status.textContent = instruction;
  }
  function seekLatest() {
    if (!selected || video.readyState < 1) return;
    video.pause();
    try {
      // Read the current selection here, including clicks made while metadata loaded.
      video.currentTime = selected.time;
      selected.applied = true;
      status.textContent = video.seeking ? 'Seeking to ' + selected.label + ' s…' : 'Film paused at ' + selected.label + ' s.';
    } catch {
      clearSelection();
      status.textContent = 'Use the video controls to inspect the film.';
    }
  }
  video.addEventListener('loadedmetadata', seekLatest);
  video.addEventListener('seeked', () => {
    // A native scrub away from a selected still no longer represents that selection.
    if (!selected?.applied) return;
    if (Math.abs(video.currentTime - selected.time) > .05) clearSelection();
    else status.textContent = 'Film paused at ' + selected.label + ' s.';
  });
  video.addEventListener('play', () => { if (!video.paused) clearSelection(); });
  video.addEventListener('error', () => {
    metadataRequested = false;
    clearSelection();
    status.textContent = 'The film could not load. You can download it below.';
  });
  buttons.forEach(button => button.addEventListener('click', () => {
    const time = Number(button.dataset.morphlinerTime);
    if (!Number.isFinite(time)) return;
    selected = { time, label: button.dataset.morphlinerTime, applied: false };
    buttons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    video.pause();
    if (video.readyState >= 1) {
      seekLatest();
    } else {
      status.textContent = 'Loading the film at ' + selected.label + ' s…';
      if (!metadataRequested) {
        metadataRequested = true;
        video.preload = 'metadata';
        video.load();
      }
    }
  }));
  inspect.hidden = false;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => initMorphlinerScene(), { once: true });
  else initMorphlinerScene();
}
