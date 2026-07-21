const root = document.documentElement;
const themeToggle = document.querySelector('.theme-toggle');
const themeMeta = document.querySelector('meta[name="theme-color"]');

function resolvedTheme() {
  if (root.dataset.theme) return root.dataset.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  localStorage.setItem('portfolio-theme', theme);
  themeToggle?.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} colour theme`);
  if (themeMeta) themeMeta.content = theme === 'dark' ? '#111614' : '#f1efe7';
}

const savedTheme = localStorage.getItem('portfolio-theme');
if (savedTheme === 'light' || savedTheme === 'dark') applyTheme(savedTheme);

themeToggle?.addEventListener('click', () => {
  applyTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
});

let activeIframeDemo = null;

function unloadIframeDemo(demo) {
  const frame = demo.querySelector('iframe');
  frame?.remove();
  demo.classList.remove('is-loaded');
  const button = demo.querySelector('.demo-load');
  const status = demo.querySelector('.demo-status');
  if (button) button.textContent = 'Load interactive demo';
  if (status) status.textContent = 'Poster loaded · no GPU view active';
  if (activeIframeDemo === demo) activeIframeDemo = null;
}

document.querySelectorAll('.iframe-demo').forEach((demo) => {
  const button = demo.querySelector('.demo-load');
  const status = demo.querySelector('.demo-status');

  button?.addEventListener('click', () => {
    if (demo.classList.contains('is-loaded')) {
      unloadIframeDemo(demo);
      return;
    }

    if (activeIframeDemo && activeIframeDemo !== demo) unloadIframeDemo(activeIframeDemo);

    const iframe = document.createElement('iframe');
    iframe.src = demo.dataset.demoSrc;
    iframe.title = demo.dataset.demoTitle || 'Interactive project demonstration';
    iframe.loading = 'eager';
    iframe.allow = 'fullscreen';
    iframe.referrerPolicy = 'no-referrer';
    iframe.tabIndex = 0;
    iframe.addEventListener('load', () => {
      if (status) status.textContent = 'Interactive demo loaded · unload to release the 3D view';
      iframe.focus({ preventScroll: true });
    }, { once: true });

    demo.insertBefore(iframe, demo.querySelector('.demo-toolbar'));
    demo.classList.add('is-loaded');
    button.textContent = 'Unload demo';
    if (status) status.textContent = 'Loading bounded application…';
    activeIframeDemo = demo;
  });
});

document.querySelectorAll('.sequence-demo').forEach((demo) => {
  const frames = (demo.dataset.frames || '').split('|').filter(Boolean);
  const image = demo.querySelector('.sequence-image');
  const range = demo.querySelector('.sequence-range');
  const output = demo.querySelector('.sequence-output');
  const playButton = demo.querySelector('.sequence-play');
  let timer = null;

  function updateFrame(index) {
    if (!frames.length || !image || !range || !output) return;
    const safeIndex = Math.max(0, Math.min(frames.length - 1, Number(index)));
    image.src = frames[safeIndex];
    image.alt = `Recorded Morphliner product-drop runtime at selected frame ${safeIndex + 1} of ${frames.length}`;
    range.value = String(safeIndex);
    range.setAttribute('aria-valuetext', `Frame ${safeIndex + 1} of ${frames.length}`);
    output.textContent = `Frame ${safeIndex + 1} of ${frames.length}`;
  }

  function pause() {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    if (playButton) {
      playButton.textContent = 'Play';
      playButton.setAttribute('aria-label', 'Play recorded Morphliner frame sequence');
    }
  }

  function play() {
    if (timer !== null || !range) return;
    if (playButton) {
      playButton.textContent = 'Pause';
      playButton.setAttribute('aria-label', 'Pause recorded Morphliner frame sequence');
    }
    timer = window.setInterval(() => {
      const next = (Number(range.value) + 1) % frames.length;
      updateFrame(next);
    }, 900);
  }

  range?.addEventListener('input', () => {
    pause();
    updateFrame(range.value);
  });

  playButton?.addEventListener('click', () => {
    if (timer === null) play(); else pause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) pause();
    }, { threshold: 0.05 });
    observer.observe(demo);
  }

  updateFrame(0);
});
