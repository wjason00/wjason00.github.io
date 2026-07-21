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

function loadIframeDemo(demo) {
  if (!demo || demo.classList.contains('is-loaded')) return;

  if (activeIframeDemo && activeIframeDemo !== demo) unloadIframeDemo(activeIframeDemo);

  const button = demo.querySelector('.demo-load');
  const status = demo.querySelector('.demo-status');
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
  if (button) button.textContent = 'Unload demo';
  if (status) status.textContent = 'Loading bounded application…';
  activeIframeDemo = demo;
}

document.querySelectorAll('.iframe-demo').forEach((demo) => {
  const button = demo.querySelector('.demo-load');

  button?.addEventListener('click', () => {
    if (demo.classList.contains('is-loaded')) {
      unloadIframeDemo(demo);
      return;
    }
    loadIframeDemo(demo);
  });
});

document.querySelectorAll('.demo-jump').forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = link.dataset.demoTarget;
    const demo = targetId ? document.getElementById(targetId) : null;
    if (!demo) return;

    event.preventDefault();
    loadIframeDemo(demo);
    demo.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
  });
});

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

  demo.classList.add('is-enhanced');
  video.controls = false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches && video.autoplay) {
    video.removeAttribute('autoplay');
    video.pause();
  }

  function updateVideoControls() {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const progress = duration > 0 ? (video.currentTime / duration) * 100 : 0;
    range.value = String(progress);
    range.setAttribute('aria-valuetext', `${formatTime(video.currentTime)} of ${formatTime(duration)}`);
    output.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
    playButton.textContent = video.paused ? 'Play' : 'Pause';
    playButton.setAttribute('aria-label', `${video.paused ? 'Play' : 'Pause'} ${recordingLabel}`);
  }

  playButton.addEventListener('click', () => {
    if (video.paused) {
      video.play().catch(() => updateVideoControls());
    } else {
      video.pause();
    }
  });

  range.addEventListener('input', () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;
    video.pause();
    video.currentTime = (Number(range.value) / 100) * video.duration;
    updateVideoControls();
  });

  video.addEventListener('loadedmetadata', updateVideoControls);
  video.addEventListener('timeupdate', updateVideoControls);
  video.addEventListener('play', updateVideoControls);
  video.addEventListener('pause', updateVideoControls);
  video.addEventListener('ended', updateVideoControls);
  updateVideoControls();
});
