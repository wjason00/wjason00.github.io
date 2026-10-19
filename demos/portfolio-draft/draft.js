/* A normal document scroll drives the decorative stage. Every section and link
   remains usable without this script; no wheel interception or scroll snapping. */
(() => {
  const chapters = [...document.querySelectorAll('.project-chapter')];
  const visuals = [...document.querySelectorAll('[data-visual]')];
  const links = [...document.querySelectorAll('.draft-nav a')];
  const toggle = document.querySelector('[data-direction-toggle]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const directions = ['mist', 'night', 'editorial'];
  const url = new URL(location.href);
  let direction = directions.includes(url.searchParams.get('direction')) ? url.searchParams.get('direction') : 'mist';
  let active = '';
  let pending = false;
  let observer;

  function applyDirection() {
    document.body.dataset.direction = direction;
    toggle.textContent = `Appearance: ${direction[0].toUpperCase()}${direction.slice(1)}`;
    document.querySelector('meta[name="theme-color"]').content = direction === 'night' ? '#192633' : '#eef1f3';
    window.dispatchEvent(new CustomEvent('portfolio-direction', { detail: direction }));
  }
  applyDirection();
  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    direction = directions[(directions.indexOf(direction) + 1) % directions.length];
    url.searchParams.set('direction', direction);
    history.replaceState(null, '', `${url.pathname}${url.search}${location.hash}`);
    applyDirection();
  });

  function update() {
    pending = false;
    const midpoint = innerHeight * .52;
    let nearest = chapters[0];
    let distance = Infinity;
    for (const chapter of chapters) {
      const box = chapter.getBoundingClientRect();
      const nextDistance = Math.abs(box.top + box.height / 2 - midpoint);
      if (nextDistance < distance) {
        distance = nextDistance;
        nearest = chapter;
      }
    }
    const key = nearest.dataset.project;
    if (active !== key) {
      active = key;
      document.body.dataset.project = key;
      for (const visual of visuals) visual.classList.toggle('is-active', visual.dataset.visual === key);
      for (const link of links) {
        if (link.hash === `#${nearest.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
    const box = nearest.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (innerHeight - box.top) / (innerHeight + box.height)));
    window.PortfolioGhost?.setActive(key === 'fly' && !document.hidden);
    window.PortfolioGhost?.setProgress(motion.matches ? .45 : progress);
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(update); }
  }
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  addEventListener('hashchange', schedule);
  document.addEventListener('visibilitychange', schedule);
  motion.addEventListener('change', schedule);
  if ('ResizeObserver' in window) {
    observer = new ResizeObserver(schedule);
    for (const chapter of chapters) observer.observe(chapter);
  }
  addEventListener('pagehide', event => {
    if (!event.persisted) { observer?.disconnect(); window.PortfolioGhost?.destroy(); }
  });
  // Font loading can change the chapter heights on narrow screens.
  document.fonts.ready.then(schedule);
  update();
})();
