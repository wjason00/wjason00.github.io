// Fly study result chart: native SVG drawn from the 15 audited pairs (copied exactly from fly-media/paired-counts.json).
// Self-initialising; touches only #work-fly. If anything fails, the static plot and full table remain.
const FLY_PAIRS = [
  { gain: 0.8, seed: 0, intact: 49, cut: 24 },
  { gain: 0.8, seed: 1, intact: 31, cut: 16 },
  { gain: 0.8, seed: 2, intact: 36, cut: 19 },
  { gain: 0.8, seed: 3, intact: 25, cut: 12 },
  { gain: 0.8, seed: 4, intact: 33, cut: 21 },
  { gain: 1.0, seed: 0, intact: 67, cut: 50 },
  { gain: 1.0, seed: 1, intact: 52, cut: 47 },
  { gain: 1.0, seed: 2, intact: 65, cut: 51 },
  { gain: 1.0, seed: 3, intact: 58, cut: 37 },
  { gain: 1.0, seed: 4, intact: 68, cut: 45 },
  { gain: 1.2, seed: 0, intact: 76, cut: 61 },
  { gain: 1.2, seed: 1, intact: 64, cut: 52 },
  { gain: 1.2, seed: 2, intact: 77, cut: 54 },
  { gain: 1.2, seed: 3, intact: 80, cut: 56 },
  { gain: 1.2, seed: 4, intact: 75, cut: 50 }
];
const X_MAX = 90; // common axis across all gains
const NS = 'http://www.w3.org/2000/svg';

function svgEl(name, attrs, parent, text) {
  const node = document.createElementNS(NS, name);
  for (const key in attrs) node.setAttribute(key, attrs[key]);
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

function describe(gain, rows) {
  return `Recurrent gain ${gain.toFixed(1)}. ` + rows.map(r =>
    `Seed ${r.seed}: ${r.intact} MN9 spikes with Roundup intact, ${r.cut} with its outputs cut.`).join(' ');
}

function initFly(root) {
  const chart = root.querySelector('[data-fly-chart]');
  const group = root.querySelector('[data-fly-gain]');
  const status = root.querySelector('[data-fly-status]');
  if (!chart || !group) return;
  const buttons = Array.from(group.querySelectorAll('button[data-gain]'));
  let gain = 1.0;
  let lastWidth = 0;
  let svg = null;
  let frame = 0;

  function render() {
    const w = Math.round(chart.clientWidth);
    if (!w) return false;
    lastWidth = w;
    const narrow = w < 480;
    const left = narrow ? 64 : 80;
    const right = narrow ? 34 : 44;
    const top = 6;
    const rowH = narrow ? 54 : 66;
    const axisH = 34;
    const dotRadius = narrow ? 3.5 : 7.5;
    const squareHalf = narrow ? 3 : 7;
    const rows = FLY_PAIRS.filter(r => r.gain === gain).sort((a, b) => a.seed - b.seed);
    const h = top + rows.length * rowH + axisH;
    const pw = w - left - right;
    const x = v => left + (v / X_MAX) * pw;
    const step = pw < 360 ? 30 : 15;
    const plotBottom = top + rows.length * rowH;

    const next = svgEl('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img', 'aria-label': describe(gain, rows) });
    const grid = svgEl('g', { 'aria-hidden': 'true' }, next);
    for (let t = 0; t <= X_MAX; t += step) {
      svgEl('line', { class: 'fly-grid', x1: x(t), x2: x(t), y1: top, y2: plotBottom }, grid);
      svgEl('text', { class: 'fly-tick', x: x(t), y: plotBottom + 22, 'text-anchor': 'middle' }, grid, String(t));
    }
    svgEl('line', { class: 'fly-axis', x1: x(0), x2: x(X_MAX), y1: plotBottom, y2: plotBottom }, grid);

    const marks = svgEl('g', { 'aria-hidden': 'true' }, next);
    rows.forEach((r, i) => {
      const y = top + rowH * (i + 0.5);
      const xi = x(r.intact);
      const xc = x(r.cut);
      svgEl('text', { class: 'fly-seed', x: 0, y: y + 5 }, marks, `Seed ${r.seed}`);
      svgEl('line', { class: 'fly-link', x1: xc, x2: xi, y1: y, y2: y }, marks);
      svgEl('rect', { class: 'fly-mark-cut' + (narrow ? ' is-compact' : ''), x: xc - squareHalf, y: y - squareHalf, width: squareHalf * 2, height: squareHalf * 2 }, marks);
      svgEl('circle', { class: 'fly-mark-intact', cx: xi, cy: y, r: dotRadius }, marks);
      svgEl('text', { class: 'fly-val is-cut', x: xc - 13, y: y + 5.5, 'text-anchor': 'end' }, marks, String(r.cut));
      svgEl('text', { class: 'fly-val', x: xi + 13, y: y + 5.5, 'text-anchor': 'start' }, marks, String(r.intact));
    });

    if (svg) chart.replaceChild(next, svg); else chart.appendChild(next);
    svg = next;
    return true;
  }

  function select(button) {
    const value = Number(button.dataset.gain);
    if (value === gain) return;
    gain = value;
    buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    render();
    if (status) status.textContent = describe(gain, FLY_PAIRS.filter(r => r.gain === gain));
  }

  try {
    if (!render()) return;
    buttons.forEach(b => b.addEventListener('click', () => select(b)));
    group.hidden = false;
    root.classList.add('is-live');
    if ('ResizeObserver' in window) {
      new ResizeObserver(entries => {
        const w = Math.round(entries[0].contentRect.width);
        if (w === lastWidth || frame) return;
        frame = requestAnimationFrame(() => { frame = 0; if (Math.round(chart.clientWidth) !== lastWidth) render(); });
      }).observe(chart);
    }
  } catch (error) {
    if (svg && svg.parentNode) svg.parentNode.removeChild(svg);
    root.classList.remove('is-live');
    group.hidden = true;
  }
}

const flyRoot = document.querySelector('#work-fly');
if (flyRoot) initFly(flyRoot);
