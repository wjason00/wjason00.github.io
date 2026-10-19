export function createSelectionBridge(load) {
  let latest, resource, pending;
  return {
    select(id) { latest = String(id); resource?.selectNeuron(latest); },
    async open() {
      pending ||= Promise.resolve().then(load).then(result => (resource = result)).catch(error => { pending = null; throw error; });
      const view = await pending;
      if (latest) view.selectNeuron(latest);
      view.resize();
      return view;
    }
  };
}

function loadThree() {
  if (window.THREE) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./vendor/three.min.js', import.meta.url).href;
    script.onload = resolve;
    script.onerror = () => { script.remove(); reject(Error('The 3D renderer could not be loaded.')); };
    document.head.append(script);
  });
}

export function initExplorer() {
  const $ = id => document.getElementById(id);
  const tabs = [...document.querySelectorAll('[data-explorer-view]')];
  if (!tabs.length) return;
  const bodyFrame = $('body-frame');
  window.addEventListener('message', event => {
    if (event.source !== bodyFrame.contentWindow || event.origin !== window.location.origin) return;
    const message = event.data;
    if (message?.type !== 'fly-body-height' || typeof message.height !== 'number' || !Number.isFinite(message.height) || message.height <= 0) return;
    bodyFrame.style.setProperty('--body-height', `${Math.ceil(message.height)}px`);
    $('body-status').hidden = true;
  });
  let active = 'connections';
  const anatomy = createSelectionBridge(async () => {
    $('anatomy-status').textContent = 'Loading source neuron skeletons…';
    await loadThree();
    const { mountMorphology } = await import('./morphology.js');
    const viewer = await mountMorphology($('neuron-anatomy'), {
      onSelect: id => document.dispatchEvent(new CustomEvent('fly:select-neuron', { detail: { id: String(id) } }))
    });
    $('anatomy-status').textContent = '';
    return viewer;
  });
  document.addEventListener('fly:neuron-selected', event => anatomy.select(event.detail.id));

  async function show(view, focus = false) {
    active = view;
    const hash = view === 'connections' ? '' : `#${view}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    tabs.forEach(tab => {
      const selected = tab.dataset.explorerView === view;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    for (const panel of document.querySelectorAll('[data-explorer-panel]')) panel.hidden = panel.dataset.explorerPanel !== view;
    const body = view === 'body';
    document.querySelector('.project-intro h1').textContent = body ? 'From saved spikes to movement' : 'The fly feeding circuit';
    document.querySelector('.project-intro p').textContent = body ? 'Inspect MN9 and MN6 activity alongside the illustrative body replay.' : 'Explore the wiring. Compare the saved motor output.';
    $('paired-controls').hidden = body;
    $('paired-output').hidden = body;
    $('neuron-inspector').hidden = body;
    $('network-workbench').classList.toggle('body-view', body);
    document.querySelector('.experiment').classList.toggle('body-view', body);
    $('layout-note').textContent = view === 'connections' ? 'Graph layout · not anatomical positions' : view === 'anatomy' ? 'Source skeleton geometry · FlyWire v630' : 'Saved motor spikes · assumed body movement';
    $('view-title').textContent = view === 'connections' ? 'Roundup’s neighbourhood' : view === 'anatomy' ? 'Reconstructed neurons' : 'Motor replay';
    $('view-description').textContent = body ? 'A separate saved author archive drives this replay. Body movement is an uncalibrated illustration.' : view === 'anatomy' ? 'A subset of 55 source neurons in their shared coordinate frame. Cut and gain change the experiment below, not these static shapes.' : 'Select a neuron to understand its role, evidence and connections.';
    if (view === 'anatomy') {
      try { await anatomy.open(); }
      catch { $('anatomy-status').textContent = 'The 3D anatomy could not load. Check your connection, then select this view again. Neuron explanations and saved results remain available.'; }
    }
    if (body && !bodyFrame.getAttribute('src')) {
      $('body-status').hidden = false;
      bodyFrame.src = 'body/index.html?v=20261019-workbench';
    }
    else if (body) bodyFrame.contentWindow?.postMessage({ type: 'fly-body-measure' }, window.location.origin);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => show(tab.dataset.explorerView));
    tab.addEventListener('keydown', event => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next !== null) { event.preventDefault(); show(tabs[next].dataset.explorerView, true); }
    });
  });
  const observer = new ResizeObserver(() => { if (active === 'anatomy') anatomy.open().catch(() => {}); });
  observer.observe($('neuron-anatomy'));
  const requested = window.location.hash.slice(1);
  show(tabs.some(tab => tab.dataset.explorerView === requested) ? requested : 'connections');
}

if (typeof document !== 'undefined') initExplorer();
