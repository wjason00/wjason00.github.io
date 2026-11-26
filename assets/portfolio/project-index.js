// Project index preview: progressive enhancement of the five-project list in the opening.
// The original <ul class="portal-index"> and its five native anchors stay in the DOM untouched
// (portal.js binds its own click listeners to them). This adds, beside the list, one large preview
// built from the same images and one-line purpose text, plus a separate "View" button per row so a
// touch can select a project without navigating. Hover and keyboard focus on an anchor preview it
// too. Without JavaScript the original index is all that renders.

const root = document.getElementById('projects');
const list = root && root.querySelector('.portal-index');

if (list && !list.closest('.exhibit-index')) init(list);

function init(list) {
  const rows = Array.from(list.children).map(li => {
    const a = li.querySelector('a[href]');
    if (!a) return null;
    const img = a.querySelector('.portal-index-media img');
    const text = sel => (a.querySelector(sel)?.textContent || '').trim();
    return {
      li, a,
      href: a.getAttribute('href'),
      name: text('.portal-index-row strong'),
      year: text('.portal-index-year'),
      field: text('.portal-index-field'),
      line: text('.portal-index-line'),
      src: img ? img.getAttribute('src') : '',
      w: img ? img.getAttribute('width') : '',
      h: img ? img.getAttribute('height') : ''
    };
  }).filter(Boolean);
  if (rows.length < 2) return;

  const wrap = document.createElement('div');
  wrap.className = 'exhibit-index';
  list.parentNode.insertBefore(wrap, list);
  wrap.appendChild(list);

  const preview = document.createElement('figure');
  preview.className = 'exhibit-preview';
  preview.id = 'exhibit-preview';
  preview.innerHTML =
    '<div class="exhibit-preview-frame">' +
      '<p class="exhibit-preview-hud"><span data-x="index"></span>' +
        '<span class="exhibit-preview-meta"><span data-x="field"></span><span data-x="year"></span></span></p>' +
      '<img class="exhibit-preview-img" alt="" decoding="async">' +
      '<p class="exhibit-preview-fallback" hidden></p>' +
    '</div>' +
    '<figcaption class="exhibit-preview-text">' +
      '<strong class="exhibit-preview-name" data-x="name"></strong>' +
      '<span class="exhibit-preview-line" data-x="line"></span>' +
      '<a class="exhibit-preview-open" href="#projects"></a>' +
    '</figcaption>';
  wrap.appendChild(preview);

  const frame = preview.querySelector('.exhibit-preview-frame');
  const pImg = preview.querySelector('.exhibit-preview-img');
  const fallback = preview.querySelector('.exhibit-preview-fallback');
  const open = preview.querySelector('.exhibit-preview-open');
  const slot = key => preview.querySelector(`[data-x="${key}"]`);

  let current = -1;

  pImg.addEventListener('error', () => {
    if (current < 0) return;
    const r = rows[current];
    pImg.hidden = true;
    fallback.hidden = false;
    fallback.textContent = '';
    fallback.append(`The ${r.name} preview image did not load. `);
    const link = document.createElement('a');
    link.href = r.href;
    link.textContent = `Go to ${r.name}`;
    fallback.append(link);
  });
  pImg.addEventListener('load', () => { pImg.hidden = false; fallback.hidden = true; });

  function select(i) {
    if (i === current || !rows[i]) return;
    current = i;
    const r = rows[i];
    rows.forEach((row, j) => {
      row.li.classList.toggle('is-selected', j === i);
      row.btn.setAttribute('aria-pressed', String(j === i));
    });
    fallback.hidden = true;
    pImg.hidden = false;
    if (r.w && r.h) {
      pImg.width = +r.w; pImg.height = +r.h;
      frame.style.setProperty('--preview-aspect', `${r.w} / ${r.h}`);
    }
    if (r.src) pImg.src = r.src; else pImg.dispatchEvent(new Event('error'));
    const pad = n => String(n).padStart(2, '0');
    slot('index').textContent = `${pad(i + 1)} / ${pad(rows.length)}`;
    slot('field').textContent = r.field;
    slot('year').textContent = r.year;
    slot('name').textContent = r.name;
    slot('line').textContent = r.line;
    open.href = r.href;
    open.textContent = `Open ${r.name}`;
    preview.dataset.project = r.href.replace(/^#/, '');
    // Restart a short fade on the frame; CSS drops it under reduced motion.
    frame.classList.remove('is-in');
    void frame.offsetWidth;
    frame.classList.add('is-in');
  }

  rows.forEach((r, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'exhibit-pick';
    btn.setAttribute('aria-pressed', 'false');
    btn.setAttribute('aria-controls', preview.id);
    btn.setAttribute('aria-label', `View ${r.name} preview`);
    btn.innerHTML = '<span aria-hidden="true">View</span>';
    btn.addEventListener('click', () => select(i));
    r.btn = btn;
    r.li.appendChild(btn);
    r.li.classList.add('exhibit-row');
    r.a.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') select(i); });
    r.a.addEventListener('focus', () => select(i));
  });

  document.documentElement.classList.add('exhibit-index-on');
  select(0);

  // Journey reparents the opening's children into its pinned copy. If the list is ever moved on
  // its own, follow it so the list and preview stay together. Live nodes only, no timers.
  const keep = new MutationObserver(() => {
    if (list.parentNode && list.parentNode !== wrap) {
      list.parentNode.insertBefore(wrap, list);
      wrap.insertBefore(list, preview);
    }
  });
  keep.observe(root, { childList: true, subtree: true });
}
