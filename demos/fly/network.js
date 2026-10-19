const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const make = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (text !== undefined) el.textContent = text;
  return el;
};
export function effectiveSourceWeight(edge, gain, cut, roundup) {
  return cut && String(edge.source) === String(roundup) ? 0 : Number(edge.signedCount) * Number(gain);
}
const number = value => Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 });
const shortName = node => node.role === 'roundup' ? 'Roundup' : node.role === 'mn9' ? 'MN9' : !node.label || /^Unannotated/i.test(node.label) ? `Unannotated …${String(node.id).slice(-5)}` : node.label;
const escapeText = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function initNetwork() {
  let data, state = { gain: 1, cut: true }, selected, positions, zoom = 1, pan = { x: 0, y: 0 };
  const svg = $('network-graph'), world = $('graph-world');
  const transform = () => world.setAttribute('transform', `translate(${pan.x} ${pan.y}) scale(${zoom})`);
  function layout() {
    const incoming = new Set(data.edges.filter(e => String(e.target) === String(data.roundup)).map(e => String(e.source)));
    const left = [], right = [];
    for (const node of data.nodes) {
      if ([String(data.roundup), String(data.mn9)].includes(String(node.id))) continue;
      (incoming.has(String(node.id)) || node.role === 'sensory' ? left : right).push(node);
    }
    positions = new Map([[String(data.roundup), { x: 455, y: 290 }], [String(data.mn9), { x: 795, y: 290 }]]);
    for (const [nodes, side] of [[left, -1], [right, 1]]) {
      nodes.sort((a, b) => String(a.id).localeCompare(String(b.id)));
      nodes.forEach((node, i) => {
        const ring = i % 2, index = Math.floor(i / 2), count = Math.ceil((nodes.length - ring) / 2);
        const angle = -1.32 + (index + .5) / Math.max(1, count) * 2.64;
        positions.set(String(node.id), { x: 455 + side * (195 + ring * 165) * Math.cos(angle), y: 290 + (205 + ring * 35) * Math.sin(angle) });
      });
    }
  }
  function inspection() {
    if (!data || !selected) return;
    let html;
    if (selected.kind === 'node') {
      const node = data.nodes.find(n => String(n.id) === selected.id);
      const ins = data.edges.filter(e => String(e.target) === selected.id), outs = data.edges.filter(e => String(e.source) === selected.id);
      const types = Array.isArray(node.types) ? node.types.join(', ') : node.types;
      html = `<h3>${escapeText(shortName(node))}</h3><p class="inspection-kind">${node.role === 'roundup' ? 'Intervention target' : node.role === 'mn9' ? 'Simulated motor output' : node.role === 'sensory' ? 'Sensory neuron' : 'Source neuron'}</p><dl><dt>Full source ID</dt><dd class="source-id">${escapeText(node.id)}</dd><dt>Source annotation</dt><dd>${escapeText(types || 'Unannotated in this export')}</dd><dt>Selected-subgraph connections</dt><dd>${ins.length} incoming · ${outs.length} outgoing</dd><dt>Full-source connections</dt><dd>${node.inDegree} incoming · ${node.outDegree} outgoing</dd></dl>`;
      if (node.role === 'roundup') html += `<p class="state-note">${state.cut ? 'All Roundup outputs are zeroed in the cut condition. Incoming connections remain.' : 'Roundup outputs are retained.'}</p>`;
      if (node.role === 'mn9') html += '<p class="state-note">MN9 is the motor neuron read out in the saved experiment. Its spikes are plotted below.</p>';
      $('node-picker').value = node.id;
    } else {
      const edge = selected.edge, from = data.nodes.find(n => String(n.id) === String(edge.source)), to = data.nodes.find(n => String(n.id) === String(edge.target));
      const zeroed = state.cut && String(edge.source) === String(data.roundup);
      html = `<h3>${escapeText(shortName(from))} → ${escapeText(shortName(to))}</h3><p class="inspection-kind">Directed source connection</p><dl><dt>Source → target IDs</dt><dd class="source-id">${escapeText(edge.source)}<br>→ ${escapeText(edge.target)}</dd><dt>Source signed count</dt><dd>${number(edge.signedCount)}</dd><dt>Effective model weight · ${state.gain.toFixed(1)}×</dt><dd>${number(effectiveSourceWeight(edge, state.gain, state.cut, data.roundup))}${zeroed ? ' · cut to zero' : ''}</dd><dt>Source row</dt><dd>${escapeText(edge.row)}</dd></dl><p class="state-note">Signed count × global gain${zeroed ? ', then zeroed by the cut' : ''}. The sign is a model assignment, not a measured response or neurotransmitter identification.</p>`;
    }
    $('network-inspection').innerHTML = html;
  }
  function choose(selection) { selected = selection; draw(); }
  function interactive(el, label, action) {
    el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); el.setAttribute('aria-label', label);
    el.addEventListener('click', event => { event.stopPropagation(); action(); });
    el.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); action(); } });
  }
  function draw() {
    if (!data) return;
    const focusKey = document.activeElement?.getAttribute('data-graph-key');
    world.replaceChildren();
    const ranked = [...data.edges].sort((a, b) => Math.abs(b.signedCount) - Math.abs(a.signedCount));
    const strongRows = new Set([...ranked.slice(0, 105).map(e => String(e.row)), ...data.pathRows.map(String)]);
    const edges = $('edge-filter').value === 'all' ? data.edges : data.edges.filter(e => strongRows.has(String(e.row)) || (String(e.source) === String(data.roundup) && String(e.target) === String(data.mn9)));
    const adjacent = selected?.kind === 'node' ? new Set(data.edges.filter(e => String(e.source) === selected.id || String(e.target) === selected.id).flatMap(e => [String(e.source), String(e.target)])) : new Set();
    const max = Math.max(...data.edges.map(e => Math.abs(e.signedCount)), 1);
    for (const edge of edges) {
      const a = positions.get(String(edge.source)), b = positions.get(String(edge.target));
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.max(1, Math.hypot(dx, dy));
      const r1 = String(edge.source) === String(data.roundup) ? 24 : String(edge.source) === String(data.mn9) ? 22 : 9;
      const r2 = String(edge.target) === String(data.roundup) ? 26 : String(edge.target) === String(data.mn9) ? 25 : 11;
      const sx = a.x + dx / len * r1, sy = a.y + dy / len * r1, tx = b.x - dx / len * r2, ty = b.y - dy / len * r2;
      const bend = String(edge.source).localeCompare(String(edge.target)) > 0 ? 17 : -17;
      const path = len < 2 ? `M${a.x} ${a.y-10}c-35-45 35-45 0 0` : `M${sx} ${sy}Q${(sx+tx)/2-dy/len*bend} ${(sy+ty)/2+dx/len*bend} ${tx} ${ty}`;
      const cut = state.cut && String(edge.source) === String(data.roundup);
      const active = selected?.kind === 'edge' ? String(selected.edge.row) === String(edge.row) : String(edge.source) === selected?.id || String(edge.target) === selected?.id;
      const group = make('g', { 'data-graph-key':`edge:${edge.row}`, class: `graph-link ${edge.signedCount < 0 ? 'negative' : 'positive'}${cut ? ' severed' : ''}${active ? ' active' : ''}` });
      group.append(make('path', { d: path, class: 'edge-ink', 'stroke-width': Math.min(6, .65 + 4.5 * Math.sqrt(Math.abs(edge.signedCount) / max) * state.gain), 'marker-end': 'url(#graph-arrow)' }), make('path', { d: path, class: 'edge-hit' }));
      interactive(group, `${shortName(data.nodes.find(n => String(n.id) === String(edge.source)))} to ${shortName(data.nodes.find(n => String(n.id) === String(edge.target)))}, signed count ${edge.signedCount}${cut ? ', cut' : ''}`, () => choose({kind:'edge', edge}));
      world.append(group);
    }
    for (const node of data.nodes) {
      const p = positions.get(String(node.id)), special = ['roundup', 'mn9'].includes(node.role), active = selected?.id === String(node.id);
      const group = make('g', { 'data-graph-key':`node:${node.id}`, class: `graph-node ${node.role}${active ? ' selected' : ''}${adjacent.size && !adjacent.has(String(node.id)) && !active ? ' distant' : ''}`, transform: `translate(${p.x} ${p.y})` });
      group.append(make('circle', { r: special ? 29 : 16, class:'node-hit' }), make('circle', { r: special ? 23 : node.role === 'sensory' ? 10 : 8, class:'node-ink' }));
      group.append(make('title', {}, `${shortName(node)} · ${node.id}`));
      if (special || node.role === 'sensory') group.append(make('text', { x:0, y:special ? 43 : -17, 'text-anchor':'middle', class:special ? 'major-label' : 'minor-label' }, shortName(node)));
      interactive(group, `Inspect ${shortName(node)}, source ID ${node.id}`, () => choose({kind:'node', id:String(node.id)}));
      world.append(group);
    }
    $('network-summary').textContent = `${data.nodes.length} source neurons · ${edges.length} of ${data.edges.length} selected directed links shown`;
    transform(); inspection();
    if(focusKey)[...world.querySelectorAll('[data-graph-key]')].find(el=>el.getAttribute('data-graph-key')===focusKey)?.focus();
  }
  const zoomBy = factor => { const next = Math.max(.6, Math.min(3.5, zoom * factor)); pan.x = 480 - (480-pan.x)*next/zoom; pan.y = 295 - (295-pan.y)*next/zoom; zoom = next; transform(); };
  $('zoom-in').addEventListener('click', () => zoomBy(1.25)); $('zoom-out').addEventListener('click', () => zoomBy(.8));
  $('zoom-reset').addEventListener('click', () => { zoom=1; pan={x:0,y:0}; transform(); });
  $('edge-filter').addEventListener('change', draw);
  $('node-picker').addEventListener('change', event => choose({ kind:'node', id:event.target.value }));
  let drag;
  svg.addEventListener('pointerdown', event => { if (event.target.closest('[role="button"]')) return; drag={x:event.clientX,y:event.clientY,px:pan.x,py:pan.y}; svg.setPointerCapture(event.pointerId); });
  svg.addEventListener('pointermove', event => { if (!drag) return; const scale = 960/svg.getBoundingClientRect().width; pan={x:drag.px+(event.clientX-drag.x)*scale,y:drag.py+(event.clientY-drag.y)*scale}; transform(); });
  for (const event of ['pointerup','pointercancel']) svg.addEventListener(event, () => { drag=null; });
  fetch(new URL('./network-data.json', import.meta.url)).then(response => { if (!response.ok) throw Error('source-data fetch failed'); return response.json(); }).then(result => {
    data=result; selected={kind:'node',id:String(data.roundup)}; layout();
    $('node-picker').replaceChildren(...data.nodes.map(node => { const option=document.createElement('option'); option.value=node.id; option.textContent=`${shortName(node)}${node.role==='roundup'?' · target':node.role==='mn9'?' · motor output':''}`; return option; }));
    draw();
  }).catch(() => { $('network-summary').textContent='Source network unavailable'; $('network-error').hidden=false; $('network-error').textContent='The source network could not be loaded. Reload this page to try again; the saved MN9 results remain available below.'; });
  return { setState(next) { if (state.gain===next.gain && state.cut===next.cut) return; state={...next}; draw(); } };
}
