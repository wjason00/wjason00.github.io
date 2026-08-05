/*
 * Portfolio behaviour. Deferred, dependency-free, and strictly an enhancement:
 * with scripting off the page still reads, the videos keep native controls and
 * the demo opens full screen in its own tab.
 *
 * theme.js has already run synchronously in <head>; it applied any stored theme
 * and added the `js` class. This file owns everything that can wait.
 */

const root = document.documentElement;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

/* ----------------------------------------------------------------- theme -- */

const themeToggle = document.querySelector('.theme-toggle');

function resolvedTheme() {
  return root.dataset.theme || (darkQuery.matches ? 'dark' : 'light');
}

/* The document ships two media-scoped theme-color metas, which are correct
   while the visitor is following their system. An explicit choice has to
   override both, so they collapse into one unscoped meta. */
function setThemeColor(theme) {
  const colour = theme === 'dark' ? '#111614' : '#f1efe7';
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (!metas.length) return;

  metas.forEach((meta, index) => {
    if (index === 0) {
      meta.removeAttribute('media');
      meta.content = colour;
    } else {
      meta.remove();
    }
  });
}

function describeToggle(theme) {
  if (!themeToggle) return;
  const next = theme === 'dark' ? 'light' : 'dark';
  themeToggle.setAttribute('aria-label', `Switch to ${next} colour theme (currently ${theme})`);
  themeToggle.setAttribute('title', `Switch to ${next} theme`);
}

function applyTheme(theme, persist) {
  root.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem('portfolio-theme', theme);
    } catch (error) {
      /* Private mode or blocked storage: the choice just will not survive. */
    }
  }
  setThemeColor(theme);
  describeToggle(theme);
}

describeToggle(resolvedTheme());
if (root.dataset.theme) setThemeColor(root.dataset.theme);

themeToggle?.addEventListener('click', () => {
  applyTheme(resolvedTheme() === 'dark' ? 'light' : 'dark', true);
});

/* Follow the system while the visitor has not made an explicit choice. */
darkQuery.addEventListener('change', () => {
  if (!root.dataset.theme) describeToggle(resolvedTheme());
});

/* ------------------------------------------------------- demo capability -- */

/* The MorphBrain build renders through three.js, so a page without a WebGL
   context can only ever show a broken canvas. Detect once, up front, and
   present the recorded poster plus a written explanation instead. */
function hasWebGLSupport() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch (error) {
    return false;
  }
}

/* Memoised: creating a throwaway context is cheap but not free, and the legal
   pages share this script without ever hosting a demo. */
let webglMemo = null;
function webglAvailable() {
  if (webglMemo === null) webglMemo = hasWebGLSupport();
  return webglMemo;
}

/* ------------------------------------------------------------ iframe demo -- */

const IFRAME_TIMEOUT_MS = 20000;
let activeIframeDemo = null;

function statusOf(demo) {
  return demo.querySelector('.demo-status');
}

function unloadIframeDemo(demo, { restoreFocus = false } = {}) {
  const mount = demo.querySelector('.demo-mount');
  const button = demo.querySelector('.demo-load');
  const status = statusOf(demo);

  if (demo.dataset.loadTimer) {
    clearTimeout(Number(demo.dataset.loadTimer));
    delete demo.dataset.loadTimer;
  }

  if (mount) mount.textContent = '';
  demo.classList.remove('is-loaded', 'is-error');
  if (button) {
    button.textContent = 'Load interactive demo';
    button.setAttribute('aria-expanded', 'false');
    /* Removing the iframe would otherwise drop focus onto <body>. */
    if (restoreFocus) button.focus();
  }
  // A state, not telemetry. "Poster loaded · no GPU view active" sat in the
  // highest-value position on the page and reads to a non-engineer as an
  // error — the demo announcing something had failed before they touched it.
  if (status) status.textContent = 'Interactive demo · not yet loaded';
  if (activeIframeDemo === demo) activeIframeDemo = null;
}

function loadIframeDemo(demo) {
  if (!demo || demo.classList.contains('is-loaded') || demo.classList.contains('is-unsupported')) return;

  const mount = demo.querySelector('.demo-mount');
  if (!mount) return;

  /* Only one live GPU context at a time — see demos/EMBED_CONTRACT.md. */
  if (activeIframeDemo && activeIframeDemo !== demo) unloadIframeDemo(activeIframeDemo);

  const button = demo.querySelector('.demo-load');
  const status = statusOf(demo);
  const iframe = document.createElement('iframe');

  iframe.src = demo.dataset.demoSrc;
  iframe.title = demo.dataset.demoTitle || 'Interactive project demonstration';
  iframe.loading = 'eager';
  iframe.allow = 'fullscreen';
  iframe.referrerPolicy = 'no-referrer';
  /* Same-origin, so this is defence in depth: it blocks top-level navigation,
     form submission and popups from the embedded build. */
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-downloads');

  const timer = window.setTimeout(() => {
    if (demo.classList.contains('is-loaded') && status && !demo.dataset.demoReady) {
      demo.classList.add('is-error');
      status.textContent = 'Demo is slow to start · try opening it full screen';
    }
  }, IFRAME_TIMEOUT_MS);
  demo.dataset.loadTimer = String(timer);

  iframe.addEventListener('load', () => {
    demo.dataset.demoReady = 'true';
    clearTimeout(timer);
    delete demo.dataset.loadTimer;
    demo.classList.remove('is-error');
    if (status) status.textContent = 'Interactive demo loaded · unload to release the 3D view';
  }, { once: true });

  iframe.addEventListener('error', () => {
    clearTimeout(timer);
    demo.classList.add('is-error');
    if (status) status.textContent = 'Demo failed to load · open it full screen instead';
  }, { once: true });

  delete demo.dataset.demoReady;
  mount.appendChild(iframe);
  demo.classList.add('is-loaded');
  if (button) {
    button.textContent = 'Unload demo';
    button.setAttribute('aria-expanded', 'true');
  }
  if (status) status.textContent = 'Loading bounded application…';
  activeIframeDemo = demo;
}

document.querySelectorAll('.iframe-demo').forEach((demo) => {
  const button = demo.querySelector('.demo-load');
  const status = statusOf(demo);

  if (!webglAvailable()) {
    demo.classList.add('is-unsupported');
    if (status) status.textContent = 'WebGL unavailable · showing the recorded poster';
    return;
  }

  button?.addEventListener('click', () => {
    if (demo.classList.contains('is-loaded')) {
      unloadIframeDemo(demo, { restoreFocus: true });
      return;
    }
    loadIframeDemo(demo);
  });
});

/* Hero and spotlight shortcuts: load the demo, scroll to it, and take focus
   with it so keyboard and screen-reader users are not left behind. */
document.querySelectorAll('.demo-jump').forEach((link) => {
  if (link.classList.contains('button') && !webglAvailable()) {
    link.textContent = 'See the MorphBrain experiment';
  }

  link.addEventListener('click', (event) => {
    const targetId = link.dataset.demoTarget;
    const demo = targetId ? document.getElementById(targetId) : null;
    if (!demo) return;

    event.preventDefault();
    loadIframeDemo(demo);
    demo.scrollIntoView({
      behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
      block: 'center',
    });
    demo.focus({ preventScroll: true });
  });
});

/* ------------------------------------------------------- video enhancement -- */

function formatTime(value) {
  if (!Number.isFinite(value)) return '0:00';
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

document.querySelectorAll('.video-demo').forEach((demo) => {
  const video = demo.querySelector('video');
  const playButton = demo.querySelector('.video-play');
  const range = demo.querySelector('.video-range');
  const output = demo.querySelector('.video-time');
  const recordingLabel = demo.dataset.recordingLabel || 'recorded result';
  if (!video || !playButton || !range || !output) return;

  const placeholderTime = output.textContent;

  demo.classList.add('is-enhanced');
  video.controls = false;

  /* Videos are preload="none", so duration is unknown until the first play.
     Keep the authored placeholder and park the scrubber until it is real. */
  range.disabled = true;
  range.setAttribute('aria-label', 'Playback position — available once the recording starts');

  function hasDuration() {
    return Number.isFinite(video.duration) && video.duration > 0;
  }

  function updateVideoControls() {
    playButton.textContent = video.paused ? 'Play' : 'Pause';
    playButton.setAttribute('aria-label', `${video.paused ? 'Play' : 'Pause'} ${recordingLabel}`);

    if (!hasDuration()) {
      output.textContent = placeholderTime;
      return;
    }

    if (range.disabled) {
      range.disabled = false;
      range.setAttribute('aria-label', 'Playback position');
    }
    range.value = String((video.currentTime / video.duration) * 100);
    range.setAttribute('aria-valuetext', `${formatTime(video.currentTime)} of ${formatTime(video.duration)}`);
    output.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
  }

  playButton.addEventListener('click', () => {
    if (video.paused) {
      video.play().catch(() => updateVideoControls());
    } else {
      video.pause();
    }
  });

  range.addEventListener('input', () => {
    if (!hasDuration()) return;
    video.pause();
    video.currentTime = (Number(range.value) / 100) * video.duration;
    updateVideoControls();
  });

  ['loadedmetadata', 'durationchange', 'timeupdate', 'play', 'pause', 'ended'].forEach((name) => {
    video.addEventListener(name, updateVideoControls);
  });
  updateVideoControls();
});

/* --------------------------------------------------------------- scrollspy -- */

/* Marks the nav link for whichever section currently owns the viewport, so a
   long single-page document still tells you where you are. */
const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
const watched = navLinks
  .map((link) => ({ link, section: document.getElementById(link.hash.slice(1)) }))
  .filter((entry) => entry.section);

if (watched.length && 'IntersectionObserver' in window) {
  const visible = new Set();

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });

      const current = watched.find((entry) => visible.has(entry.section));
      watched.forEach(({ link }) => {
        if (current && link === current.link) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    },
    { rootMargin: '-25% 0px -60% 0px', threshold: 0 },
  );

  watched.forEach(({ section }) => observer.observe(section));
}
