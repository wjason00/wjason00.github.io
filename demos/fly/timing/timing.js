export const PATTERNS = ['aligned', 'staggered'];
export const CONDITIONS = ['intact', 'direct_edge', 'all_outgoing'];
const LABELS = { intact: 'Intact', direct_edge: 'Direct edge cut', all_outgoing: 'All outputs cut' };
const patternLabel = pattern => pattern === 'aligned' ? 'Aligned · shared template' : 'Circularly shifted copies';
const fail = message => { throw new Error(message); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const idKey = row => `${row.template_id}|${row.pattern}|${row.condition}`;
export function safeEvidenceUrl(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (!normalized || /[\\\s\u0000-\u001f\u007f]/.test(normalized)) return false;
  if (/^https?:\/\//i.test(normalized)) {
    try { const url = new URL(normalized); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname); } catch { return false; }
  }
  return !normalized.includes(':') && !normalized.startsWith('/');
}
export function selectCells(data, templateId, pattern) {
  return CONDITIONS.map(condition => data.cells.find(cell => cell.template_id === templateId && cell.pattern === pattern && cell.condition === condition));
}
export function pairedEffects(data, templateId) {
  const effect = pattern => {
    const [, direct, all] = selectCells(data, templateId, pattern);
    return direct.mn9_count - all.mn9_count;
  };
  const e_aligned = effect('aligned'), e_staggered = effect('staggered');
  return { template_id: templateId, e_aligned, e_staggered, interaction: e_staggered - e_aligned };
}
export function validateData(data) {
  if (!data || data.schema_version !== 1) fail('Unsupported evidence format.');
  if (data.metadata?.stage === 'pending' && data.metadata?.audited === false) return { pending: true };
  if (data.metadata?.stage !== 'verified' || data.metadata?.audited !== true) fail('Evidence has not passed the independent audit.');
  if (data.metadata.summary !== undefined && (typeof data.metadata.summary !== 'string' || !data.metadata.summary.trim())) fail('The evidence summary must be a nonempty string.');
  const expected = { gain: 1, dt_ms: .1, run_ms: 1500, warmup_ms: 500, analysis_start_ms: 500, analysis_end_ms: 1000, period_ms: 500, input_time_reference: 'absolute_run', scheduled_events_per_grn_period: 50 };
  for (const [key, value] of Object.entries(expected)) if (data.metadata[key] !== value) fail(`Unexpected experiment metadata: ${key}.`);
  if (!Array.isArray(data.templates) || data.templates.length !== 5) fail('Expected five input templates.');
  const ids = data.templates.map(item => item.id);
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== 5 || data.templates.some(item => typeof item.label !== 'string')) fail('Template IDs and labels must be unique strings.');
  if (!Array.isArray(data.cells) || data.cells.length !== 30) fail('Expected the complete 30-cell experiment grid.');
  const keys = new Set();
  for (const cell of data.cells) {
    if (!ids.includes(cell.template_id) || !PATTERNS.includes(cell.pattern) || !CONDITIONS.includes(cell.condition) || !Number.isInteger(cell.mn9_count) || cell.mn9_count < 0) fail('Invalid experiment cell.');
    if (keys.has(idKey(cell))) fail('Duplicate experiment cell.');
    for (const key of ['scheduled_count', 'applied_count', 'grn_spike_count']) if (cell[key] !== undefined && (!Number.isInteger(cell[key]) || cell[key] < 0)) fail(`Invalid input audit count: ${key}.`);
    keys.add(idKey(cell));
  }
  if (!Array.isArray(data.paired_contrasts) || data.paired_contrasts.length !== 5 || new Set(data.paired_contrasts.map(row => row.template_id)).size !== 5) fail('Expected five paired contrasts.');
  for (const id of ids) {
    const supplied = data.paired_contrasts.find(row => row.template_id === id), actual = pairedEffects(data, id);
    if (!supplied || ['e_aligned', 'e_staggered', 'interaction'].some(key => !finite(supplied[key]) || supplied[key] !== actual[key])) fail('Paired contrasts do not reconcile with the counts.');
  }
  if (!Array.isArray(data.input_events)) fail('Scheduled input events are missing.');
  const neurons = new Map(ids.flatMap(id => PATTERNS.map(pattern => [`${id}|${pattern}`, new Set()])));
  const eventCounts = new Map(ids.flatMap(id => PATTERNS.map(pattern => [`${id}|${pattern}`, new Map()])));
  for (const event of data.input_events) {
    if (!ids.includes(event.template_id) || !PATTERNS.includes(event.pattern) || typeof event.neuron_id !== 'string' || !/^\d+$/.test(event.neuron_id) || !finite(event.time_ms) || event.time_ms < 500 || event.time_ms >= 1000) fail('Invalid scheduled input event.');
    neurons.get(`${event.template_id}|${event.pattern}`).add(event.neuron_id);
    const counts = eventCounts.get(`${event.template_id}|${event.pattern}`);
    counts.set(event.neuron_id, (counts.get(event.neuron_id) || 0) + 1);
  }
  const groups = [...neurons.values()].map(group => [...group].sort().join(','));
  if ([...neurons.values()].some(group => group.size !== 21) || new Set(groups).size !== 1) fail('Every raster must contain the same 21 input neuron IDs.');
  for (const id of ids) for (const pattern of PATTERNS) {
    const counts = eventCounts.get(`${id}|${pattern}`);
    if ([...counts.values()].some(count => count !== data.metadata.scheduled_events_per_grn_period)) fail('Scheduled input must contain exactly 50 events per GRN in each pattern.');
    const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
    for (const cell of selectCells(data, id, pattern)) if (cell.scheduled_count !== undefined && cell.scheduled_count !== total) fail('Scheduled input audit counts do not reconcile with the shared raster.');
    const pairedCounts = eventCounts.get(`${id}|${pattern === 'aligned' ? 'staggered' : 'aligned'}`);
    if ([...counts].some(([neuronId, count]) => pairedCounts.get(neuronId) !== count)) fail('Per-GRN scheduled event counts differ across timing patterns.');
  }
  const links = [...(data.sources || []), data.audit];
  if (!Array.isArray(data.sources) || !data.sources.length || !data.audit || links.some(link => !link || typeof link.label !== 'string' || !safeEvidenceUrl(link.url))) fail('Public evidence and independent audit links are required.');
  return { pending: false, neuronIds: groups[0].split(',') };
}
export function createEvidenceState() {
  const state = { templateId: '1001', pattern: 'aligned', data: null, validation: null, error: null, pending: true };
  return {
    state,
    select(templateId, pattern) { state.templateId = templateId; state.pattern = PATTERNS.includes(pattern) ? pattern : state.pattern; },
    accept(data) {
      try {
        const validation = validateData(data);
        state.data = validation.pending ? null : data; state.validation = validation; state.pending = validation.pending; state.error = null;
        if (!validation.pending && !data.templates.some(item => item.id === state.templateId)) state.templateId = data.templates[0].id;
      } catch (error) { this.reject(error); }
      return state;
    },
    reject(error) { state.data = null; state.validation = null; state.error = error.message || String(error); state.pending = false; return state; }
  };
}
const NS = 'http://www.w3.org/2000/svg';
function svgElement(tag, attrs = {}, value) {
  const element = document.createElementNS(NS, tag);
  for (const [key, val] of Object.entries(attrs)) element.setAttribute(key, val);
  if (value !== undefined) element.textContent = value;
  return element;
}
function appendText(parent, tag, value, className) { const el = document.createElement(tag); el.textContent = value; if (className) el.className = className; parent.append(el); return el; }
export function boot(root = document) {
  const model = createEvidenceState(), byId = id => root.getElementById(id);
  const template = byId('template'), pattern = byId('pattern'), status = byId('status');
  let request = 0;
  function render() {
    const { data, error, pending, templateId } = model.state;
    byId('results').hidden = !data; byId('empty-state').hidden = Boolean(data);
    const summary = data?.metadata.summary?.trim() || '';
    byId('finding').textContent = summary; byId('finding').hidden = !summary;
    status.parentElement.dataset.state = error ? 'error' : data ? 'verified' : 'pending';
    status.parentElement.hidden = Boolean(data);
    status.textContent = error ? `Results could not load: ${error} Try again.` : pending ? 'Results are not yet available.' : 'Five artificial templates · 30 simulation conditions';
    byId('empty-state').querySelector('h3').textContent = error ? 'Results unavailable' : 'Results not yet available';
    byId('empty-state').querySelector('p').textContent = error ? 'Your selection is preserved. Try again to load the results.' : 'The comparison will appear here when the complete results and their independent checks are available.';
    if (!data) return;
    const previous = template.value;
    template.replaceChildren(...data.templates.map(item => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.label; return option; }));
    template.value = templateId || previous; pattern.value = model.state.pattern;
    const selected = data.templates.find(item => item.id === templateId), timing = model.state.pattern;
    byId('input-caption').textContent = `${selected.label} · ${patternLabel(timing)}`;
    const raster = byId('raster');
    raster.querySelectorAll(':scope > :not(title):not(desc)').forEach(el => el.remove());
    const ids = model.state.validation.neuronIds, left = 48, right = 755, top = 25, bottom = 315;
    for (let t = 0; t <= 500; t += 100) {
      const x = left + t / 500 * (right - left);
      raster.append(svgElement('line', { x1: x, x2: x, y1: top - 10, y2: bottom, class: 'raster-tick' }), svgElement('text', { x, y: 336, 'text-anchor': 'middle' }, t));
    }
    ids.forEach((id, index) => raster.append(svgElement('text', { x: 33, y: top + index * 14 + 3, 'text-anchor': 'end', class: 'row-label' }, index + 1)));
    raster.append(svgElement('text', { x: 402, y: 357, 'text-anchor': 'middle', class: 'raster-axis' }, 'Time in measurement window (ms)'));
    const row = new Map(ids.map((id, index) => [id, index]));
    const pulses = document.createDocumentFragment();
    data.input_events.filter(event => event.template_id === templateId && event.pattern === timing).forEach(event => {
      const x = left + (event.time_ms - data.metadata.analysis_start_ms) / 500 * (right - left), y = top + row.get(event.neuron_id) * 14;
      pulses.append(svgElement('line', { x1: x, x2: x, y1: y - 4, y2: y + 4, class: timing === 'staggered' ? 'pulse shifted' : 'pulse' }));
    });
    raster.append(pulses);
    byId('neuron-ids').replaceChildren(); ids.forEach(id => appendText(byId('neuron-ids'), 'li', id));
    byId('counts-caption').textContent = `${selected.label} · ${patternLabel(timing)} · spikes per 500 ms`;
    const counts = byId('counts'); counts.replaceChildren();
    const maxCount = Math.max(1, ...data.cells.map(cell => cell.mn9_count));
    selectCells(data, templateId, timing).forEach(cell => {
      const container = document.createElement('div'); container.className = 'count-row';
      appendText(container, 'span', LABELS[cell.condition]);
      const track = appendText(container, 'div', '', 'count-track'); track.setAttribute('aria-hidden', 'true');
      const bar = appendText(track, 'span', '', `count-bar ${cell.condition}`); bar.style.width = `${cell.mn9_count / maxCount * 100}%`;
      appendText(container, 'strong', cell.mn9_count); counts.append(container);
    });
    const selectedCells = selectCells(data, templateId, timing), auditKeys = ['scheduled_count', 'applied_count', 'grn_spike_count'];
    const hasInputAudit = selectedCells.every(cell => auditKeys.every(key => cell[key] !== undefined));
    byId('input-audit-details').hidden = !hasInputAudit;
    byId('input-audit').replaceChildren();
    if (hasInputAudit) {
      const inputTable = document.createElement('table'); inputTable.className = 'contrast-table';
      const inputHead = document.createElement('thead'), inputHeading = document.createElement('tr');
      ['Condition', 'Scheduled', 'Applied', 'GRN spikes'].forEach(label => { const th = appendText(inputHeading, 'th', label); th.scope = 'col'; }); inputHead.append(inputHeading); inputTable.append(inputHead);
      const inputBody = document.createElement('tbody'); selectedCells.forEach(cell => { const tr = document.createElement('tr'); appendText(tr, 'td', LABELS[cell.condition]); auditKeys.forEach(key => appendText(tr, 'td', cell[key])); inputBody.append(tr); }); inputTable.append(inputBody); byId('input-audit').append(inputTable);
    }
    const rows = data.templates.map(item => ({ ...pairedEffects(data, item.id), label: item.label }));
    const lo = Math.min(0, ...rows.flatMap(row => [row.e_aligned, row.e_staggered])), hi = Math.max(1, ...rows.flatMap(row => [row.e_aligned, row.e_staggered]));
    const x = value => 5 + (value - lo) / (hi - lo) * 190;
    const table = document.createElement('table'); table.className = 'contrast-table';
    const head = document.createElement('thead'), heading = document.createElement('tr');
    ['Template', 'E aligned', 'E shifted', 'Paired E', 'I'].forEach(label => { const th = appendText(heading, 'th', label); th.scope = 'col'; }); head.append(heading); table.append(head);
    const body = document.createElement('tbody');
    rows.forEach(row => {
      const tr = document.createElement('tr'); if (row.template_id === templateId) tr.className = 'selected';
      appendText(tr, 'td', row.label); appendText(tr, 'td', row.e_aligned); appendText(tr, 'td', row.e_staggered);
      const plotCell = appendText(tr, 'td', '', 'contrast-plot'), plot = svgElement('svg', { viewBox: '0 0 200 22', 'aria-hidden': 'true' });
      plot.append(svgElement('line', { x1: x(0), x2: x(0), y1: 0, y2: 22, class: 'zero' }), svgElement('line', { x1: x(row.e_aligned), x2: x(row.e_staggered), y1: 11, y2: 11 }), svgElement('circle', { cx: x(row.e_aligned), cy: 11, r: 4 }), svgElement('rect', { x: x(row.e_staggered) - 4, y: 7, width: 8, height: 8 }));
      plotCell.append(plot); const scale = appendText(plotCell, 'div', '', 'contrast-scale'); appendText(scale, 'span', lo); appendText(scale, 'span', hi);
      appendText(tr, 'td', row.interaction > 0 ? `+${row.interaction}` : row.interaction); body.append(tr);
    }); table.append(body); byId('contrasts').replaceChildren(table);
    byId('sources').replaceChildren();
    [...data.sources, data.audit].forEach(source => { const li = document.createElement('li'), link = document.createElement('a'); link.href = source.url.trim(); link.textContent = source.label; li.append(link); byId('sources').append(li); });
  }
  template.addEventListener('change', () => { model.select(template.value, pattern.value); render(); });
  pattern.addEventListener('change', () => { model.select(template.value, pattern.value); render(); });
  async function reload() {
    const token = ++request; byId('reload').disabled = true; status.textContent = 'Loading results…';
    try { const response = await fetch(new URL('data.json', import.meta.url), { cache: 'no-store' }); if (!response.ok) throw new Error(`Evidence file returned ${response.status}.`); const data = await response.json(); if (token === request) model.accept(data); }
    catch (error) { if (token === request) model.reject(error); }
    if (token === request) { byId('reload').disabled = false; render(); }
  }
  byId('reload').addEventListener('click', reload); reload();
  return { model, reload, render };
}
if (typeof document !== 'undefined' && document.getElementById('template')) boot();
