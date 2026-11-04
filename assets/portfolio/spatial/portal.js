// Independent project landscape. No B controller or shared fixed media stage.
const root = document.querySelector('.portal');
if (root) {
  root.classList.add('has-js');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let gsap = null;
  let openingPlayed = false;
  const opening = root.querySelector('.portal-opening');
  const scenes = Array.from(root.querySelectorAll('.portal-scene'));
  const navLinks = Array.from(root.querySelectorAll('.portal-wayfinder a'));
  function openingMotion() {
    if (openingPlayed || reduce.matches || !gsap) return;
    openingPlayed = true;
    gsap.fromTo(opening.querySelectorAll('h2 span'), { x: -22, opacity: .55 }, { x: 0, opacity: 1, duration: .7, stagger: .075, ease: 'power3.out', clearProps: 'transform,opacity' });
  }
  // The vendored dist file is UMD: load it as a classic script, not a strict ES module.
  const motionScript = document.createElement('script');
  motionScript.src = new URL('./vendor/gsap.min.js', import.meta.url).href;
  motionScript.async = true;
  motionScript.addEventListener('load', () => {
    gsap = window.gsap || null;
    root.dataset.motionLibrary = gsap ? 'gsap' : 'native-fallback';
    if (opening.getBoundingClientRect().top < innerHeight && opening.getBoundingClientRect().bottom > 0) openingMotion();
  }, { once: true });
  motionScript.addEventListener('error', () => { root.dataset.motionLibrary = 'native-fallback'; }, { once: true });
  document.head.appendChild(motionScript);
  if ('IntersectionObserver' in window) {
    const openingObserver = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) openingMotion(); });
    openingObserver.observe(opening);
  }
  // Resolve the active section from the whole current layout, rather than only
  // the changed entries of an IntersectionObserver callback.
  let wayfinderFrame = 0;
  function updateWayfinder() {
    wayfinderFrame = 0;
    const marker = innerHeight * .3;
    const current = scenes.filter(scene => scene.getBoundingClientRect().top <= marker).pop() || scenes[0];
    if (!current) return;
    navLinks.forEach(link => { if (link.hash === '#' + current.id) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current'); });
  }
  function scheduleWayfinder() { if (!wayfinderFrame) wayfinderFrame = requestAnimationFrame(updateWayfinder); }
  window.addEventListener('scroll', scheduleWayfinder, { passive: true });
  window.addEventListener('resize', scheduleWayfinder);
  scheduleWayfinder();
  navLinks.concat(Array.from(root.querySelectorAll('.portal-opening-foot a'))).forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', link.hash);
      if (event.detail === 0) {
        const destination = target.querySelector('.portal-title') || target;
        destination.tabIndex = -1;
        destination.focus({ preventScroll: true });
      }
      if (gsap && !reduce.matches) gsap.fromTo(target.querySelector('.portal-title'), { x: -12, opacity: .65 }, { x: 0, opacity: 1, duration: .5, ease: 'power2.out', clearProps: 'transform,opacity' });
    });
  });

  // One on-demand WebGL object, displaying only the exact saved snapshots.
  const surfaceHost = root.querySelector('[data-surface]');
  const surfaceCaption = root.querySelector('[data-surface-cap]');
  let viewer = null, surfaceToken = 0, surfaceVisible = false, surfaceFailed = false;
  let frame = 15, wireframe = false;
  const frameNames = { 0: 'Start', 15: 'Middle', 29: 'End' };
  const frameButtons = Array.from(root.querySelectorAll('[data-frame]'));
  const wireButton = root.querySelector('[data-wire]');
  const tools = root.querySelector('.portal-surface-tools');
  function surfaceReadyCaption() { surfaceCaption.textContent = frameNames[frame] + ': exact saved surface ' + frame + ' of 0–29. Drag or use the arrow keys to turn it.'; }
  function releaseSurface() {
    surfaceToken++;
    if (viewer) { viewer.destroy(); viewer = null; }
    const canvas = surfaceHost.querySelector('canvas');
    if (surfaceHost.classList.contains('is-mounted')) {
      const fresh = canvas.cloneNode(false); fresh.tabIndex = -1; canvas.replaceWith(fresh);
    }
    surfaceHost.classList.remove('is-mounted', 'is-ready');
    tools.hidden = true;
  }
  function failSurface(token) {
    if (token !== surfaceToken) return;
    surfaceFailed = true;
    releaseSurface();
    surfaceCaption.textContent = 'Static saved rendering. The interactive surface could not start in this browser; the recording still plays.';
  }
  function syncSurface() {
    if (!surfaceVisible || document.hidden || surfaceFailed) { if (viewer || surfaceHost.classList.contains('is-mounted')) releaseSurface(); return; }
    if (viewer || surfaceHost.classList.contains('is-mounted')) return;
    const token = ++surfaceToken;
    const canvas = surfaceHost.querySelector('canvas');
    surfaceHost.classList.add('is-mounted');
    import('./surface-viewer.js').then(module => {
      if (token !== surfaceToken) return null;
      viewer = module.mountSurfaceViewer(canvas, { frame, color: '#687f70', onError: () => failSurface(token) });
      return viewer.ready;
    }).then(() => {
      if (token !== surfaceToken || !viewer) return;
      viewer.setFrame(frame); viewer.setWireframe(wireframe);
      surfaceHost.classList.add('is-ready'); tools.hidden = false; canvas.tabIndex = 0;
      surfaceReadyCaption();
    }).catch(() => failSurface(token));
  }
  frameButtons.forEach(button => button.addEventListener('click', () => {
    frame = Number(button.dataset.frame);
    frameButtons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
    if (viewer) viewer.setFrame(frame);
    surfaceReadyCaption();
  }));
  wireButton.addEventListener('click', () => { wireframe = !wireframe; wireButton.setAttribute('aria-pressed', String(wireframe)); if (viewer) viewer.setWireframe(wireframe); });
  root.querySelector('[data-reset]').addEventListener('click', () => viewer?.resetView());
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { surfaceVisible = entries[entries.length - 1].isIntersecting; syncSurface(); }, { rootMargin: '150px 0px' }).observe(surfaceHost);
  } else { surfaceVisible = true; syncSurface(); }

  // The EEG source image is unchanged. Only the two recorded decision windows switch.
  const eeg = root.querySelector('.portal-eeg');
  const windowButtons = Array.from(eeg.querySelectorAll('[data-window]'));
  eeg.querySelector('.portal-window-pick').hidden = false;
  windowButtons.forEach(button => button.addEventListener('click', () => {
    eeg.dataset.window = button.dataset.window;
    windowButtons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  }));
  const dialog = root.querySelector('.portal-dialog');
  const enlarge = root.querySelector('[data-enlarge]');
  if (typeof dialog.showModal === 'function') {
    enlarge.addEventListener('click', event => { event.preventDefault(); dialog.querySelector('img').src = enlarge.href; dialog.showModal(); dialog.querySelector('button').focus(); });
    dialog.addEventListener('close', () => enlarge.focus());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  }

  // The existing MorphBrain application is loaded only by explicit request.
  const brainButton = root.querySelector('[data-load-brain]');
  const brainSlot = root.querySelector('[data-brain-slot]');
  const brainRestart = root.querySelector('.portal-brain-restart');
  brainButton.hidden = false;
  brainRestart.hidden = false;
  let brainLoadedAt = 0;
  const brainObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => { if (!entry.isIntersecting && entry.time >= brainLoadedAt && brainSlot.querySelector('iframe')) unloadBrain(); });
  }) : null;
  function unloadBrain() {
    brainObserver?.unobserve(brainSlot);
    brainSlot.querySelector('iframe')?.remove(); brainSlot.hidden = true;
    brainButton.hidden = false;
  }
  brainButton.addEventListener('click', () => {
    if (brainSlot.querySelector('iframe')) return;
    const iframe = document.createElement('iframe'); iframe.src = '/demos/morphbrain/'; iframe.title = 'MorphBrain patterning model';
    brainSlot.appendChild(iframe); brainSlot.hidden = false; brainRestart.hidden = false; brainButton.hidden = true;
    brainLoadedAt = performance.now();
    brainSlot.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    iframe.focus();
    requestAnimationFrame(() => { if (brainSlot.querySelector('iframe') === iframe) brainObserver?.observe(brainSlot); });
  });

  // Videos pause on exit/background/collapsed details, and never autoplay.
  const videos = Array.from(root.querySelectorAll('video'));
  videos.forEach(video => video.addEventListener('play', () => videos.forEach(other => { if (other !== video) other.pause(); })));
  root.querySelectorAll('details').forEach(details => details.addEventListener('toggle', () => { if (!details.open) details.querySelectorAll('video').forEach(video => video.pause()); }));
  if ('IntersectionObserver' in window) {
    const videoObserver = new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) entry.target.pause(); }));
    videos.forEach(video => videoObserver.observe(video));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { videos.forEach(video => video.pause()); releaseSurface(); unloadBrain(); }
    else syncSurface();
  });
  window.addEventListener('pagehide', () => { videos.forEach(video => video.pause()); releaseSurface(); unloadBrain(); });
}

// The Fly evidence figure keeps its readable fallback if its optional controller fails.
import('./fly-scene.js').catch(() => {});

// Optional deliberate inspection of stills from the Morphliner export.
import('./morphliner-scene.js').catch(() => {});
