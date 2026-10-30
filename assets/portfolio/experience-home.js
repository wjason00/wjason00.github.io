/* Home controller: legacy hash routing, the atlas scene, project hover/focus,
   cursor probe and theme. Everything here is progressive; the page reads
   and navigates without it. */

const root = document.documentElement;

/* Old single-page hashes now live on the full work page. */
const LEGACY_IDS = new Set([
  'compare-input', 'contact-title', 'demo-dialog-title', 'dpca', 'dpca-title',
  'experience', 'experience-title', 'fly-circuit', 'fly-network-caption',
  'fly-preview', 'fly-replay-caption', 'fly-replay-title', 'fly-strength-study',
  'fly-study-details', 'fly-timing-title', 'fly-title', 'fly-visuals', 'g27',
  'g27-account', 'g27-marked-title', 'g27-montage', 'g27-selector-title',
  'g27-timing', 'gallery-signals-title', 'intro-title', 'model-morpher',
  'model-morpher-title', 'morphbrain', 'morphbrain-demo', 'morphbrain-notes',
  'morphbrain-synthetic-study', 'morphbrain-title', 'morpher-project-limit',
  'morphliner', 'morphliner-project-limit', 'morphliner-title', 'opening-morpher',
  'opening-morpher-limit', 'preview-fly', 'preview-model-morpher',
  'preview-morphbrain', 'preview-morphliner', 'projects-title', 'select-fly',
  'select-model-morpher', 'select-morphbrain', 'select-morphliner',
  'selected-work', 'selected-work-title', 'signal-study-details',
  'supervised-title', 'supervised-work',
]);
const LOCAL_IDS = new Set(['top', 'main', 'projects', 'about', 'contact']);

function routeLegacyHash() {
  let id = '';
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  if (!id || LOCAL_IDS.has(id) || !LEGACY_IDS.has(id)) return;
  location.replace(`./work.html#${encodeURIComponent(id)}`);
}
routeLegacyHash();
window.addEventListener('hashchange', routeLegacyHash);

const reducedQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
const reduced = () => Boolean(reducedQuery?.matches);

const canvas = document.getElementById('portfolio-scene');
const probe = document.querySelector('[data-probe]');
const readoutPoints = document.querySelector('[data-readout-points]');
const readoutView = document.querySelector('[data-readout-view]');
const index = document.querySelector('.atlas__index');
const indexLinks = [...document.querySelectorAll('.atlas__index a[data-scene-project]')];
const peek = document.querySelector('[data-peek]');
const peekImages = peek ? [...peek.querySelectorAll('[data-peek-for]')] : [];

let scene = null;
let current = 'overview';

/* Theme */
function effectiveTheme() {
  if (root.dataset.theme === 'light' || root.dataset.theme === 'dark') return root.dataset.theme;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
document.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
  const next = effectiveTheme() === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('portfolio-theme', next); } catch { /* storage blocked */ }
  scene?.setTheme(next);
});
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener?.('change', () => {
  scene?.setTheme(effectiveTheme());
});

/* Project selection: turns the surface, shifts the page accent, marks the index. */
function select(id) {
  if (!id || id === current) return;
  current = id;
  if (id === 'overview') delete root.dataset.accent;
  else root.dataset.accent = id;
  for (const link of indexLinks) link.classList.toggle('is-current', link.dataset.sceneProject === id);
  scene?.setProject(id);
}

function projectFrom(target) {
  return target instanceof Element ? target.closest('[data-scene-project]')?.dataset.sceneProject : null;
}
document.addEventListener('pointerover', event => {
  if (event.pointerType === 'touch') return;
  const id = projectFrom(event.target);
  if (id) select(id);
});
document.addEventListener('focusin', event => {
  const id = projectFrom(event.target);
  if (id) select(id);
});

document.querySelector('[data-reset-scene]')?.addEventListener('click', () => {
  current = '';
  select('overview');
  scene?.reset();
  hidePeek();
});

/* Index: magnetic pull and a tilting preview beside the hovered project. */
function showPeek(link, event) {
  if (!peek || !finePointer?.matches) return;
  const id = link.dataset.sceneProject;
  for (const img of peekImages) img.classList.toggle('is-shown', img.dataset.peekFor === id);
  const peekHeight = peek.offsetHeight || 0;
  const y = link.offsetTop + link.offsetHeight / 2 - peekHeight / 2;
  peek.style.setProperty('--peek-y', `${Math.round(y)}px`);
  if (event && !reduced()) {
    const rect = link.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
    const ny = (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
    peek.style.setProperty('--tilt-y', `${(nx * 14).toFixed(2)}deg`);
    peek.style.setProperty('--tilt-x', `${(-ny * 10).toFixed(2)}deg`);
  } else {
    peek.style.setProperty('--tilt-x', '0deg');
    peek.style.setProperty('--tilt-y', '0deg');
  }
}
function hidePeek() {
  for (const img of peekImages) img.classList.remove('is-shown');
}

for (const link of indexLinks) {
  link.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    showPeek(link, event);
    if (reduced()) return;
    const rect = link.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    link.style.setProperty('--mx', `${Math.max(-8, Math.min(8, dx * 0.04)).toFixed(1)}px`);
    link.style.setProperty('--my', `${Math.max(-4, Math.min(4, dy * 0.12)).toFixed(1)}px`);
  });
  link.addEventListener('pointerleave', () => {
    link.style.setProperty('--mx', '0px');
    link.style.setProperty('--my', '0px');
  });
  link.addEventListener('focus', () => showPeek(link));
}
index?.addEventListener('pointerleave', hidePeek);
index?.addEventListener('focusout', event => {
  if (!index.contains(event.relatedTarget)) hidePeek();
});

/* Readout and cursor probe report only the display view, never a fabricated signal. */
const degrees = value => {
  const deg = Math.round((Number(value) || 0) * 180 / Math.PI);
  return `${deg < 0 ? '−' : ''}${Math.abs(deg)}°`;
};
function viewText() {
  return `yaw ${degrees(canvas.dataset.rotationY)}  pitch ${degrees(canvas.dataset.rotationX)}`;
}
function updateReadout() {
  if (readoutView && canvas?.dataset.sceneReady === 'true') readoutView.textContent = viewText();
}

let probeFrame = 0;
let probeX = 0, probeY = 0, engaged = false;
function placeProbe() {
  probeFrame = 0;
  if (!probe) return;
  probe.textContent = canvas.dataset.dragging === 'true' || engaged ? viewText() : 'Drag to turn';
  probe.style.transform = `translate3d(${Math.round(probeX + 18)}px, ${Math.round(probeY + 14)}px, 0)`;
}
if (canvas && probe) {
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || canvas.dataset.sceneReady !== 'true') return;
    const rect = canvas.getBoundingClientRect();
    probeX = event.clientX - rect.left;
    probeY = event.clientY - rect.top;
    probe.classList.add('is-on');
    if (!probeFrame) probeFrame = requestAnimationFrame(placeProbe);
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => {
    probe.classList.remove('is-on');
    updateReadout();
  });
}

/* Scene */
async function startScene() {
  if (!canvas) return;
  try {
    const { mountScene } = await import('./brain-scene.js');
    scene = mountScene(canvas, {
      onReady({ pointCount }) {
        root.dataset.scene = 'ready';
        if (readoutPoints && pointCount) readoutPoints.textContent = `${pointCount.toLocaleString('en-GB')} points`;
        scene.setTheme(effectiveTheme());
        updateReadout();
      },
      onInteraction({ type }) {
        if (type === 'drag-start' || type === 'orbit' || type === 'keyboard') engaged = true;
        if (type === 'reset') engaged = false;
        updateReadout();
        if (probe?.classList.contains('is-on') && !probeFrame) probeFrame = requestAnimationFrame(placeProbe);
      },
      onError() {
        root.dataset.scene = 'error';
        if (readoutPoints) readoutPoints.textContent = 'Static drawing shown; the interactive surface could not start';
      },
    });
    scene.ready?.catch(() => { /* onError already switched to the static drawing */ });
  } catch {
    root.dataset.scene = 'error';
  }
}
startScene();

/* One recording at a time; playback always starts from the visitor's own click. */
document.addEventListener('play', event => {
  for (const video of document.querySelectorAll('video')) {
    if (video !== event.target && !video.paused) video.pause();
  }
}, true);
