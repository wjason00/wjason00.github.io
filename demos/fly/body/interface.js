/* Presentation only: disclosure, run summary, frame sizing and active drive blocks. */
(function () {
  'use strict';
  const main = document.querySelector('main');
  const advancedToggle = document.getElementById('body-advanced-toggle');
  const runSummary = document.getElementById('body-run-summary');
  let summaryScheduled = false;

  const selectedText = id => {
    const control = document.getElementById(id);
    return control.selectedOptions[0]?.textContent.trim() || '';
  };

  function updateRunSummary() {
    summaryScheduled = false;
    const trial = document.getElementById('trial');
    if (!trial.options.length) return;
    const compare = document.getElementById('compare-mode').getAttribute('aria-pressed') === 'true';
    const input = selectedText('stimulus').replace(/\s*\u00b7\s*/g, ' ');
    const circuit = compare ? 'Compare: Intact + ' + selectedText('comparison') : selectedText('circuit');
    const speed = Number(document.getElementById('speed').value);
    const cycle = document.getElementById('repeat').checked ? 'cycling trials' : 'cycle off';
    const text = [input, circuit, 'trial ' + (Number(trial.value) + 1) + '/30', speed + '\u00d7 speed', compare ? '' : 'single fly', cycle].filter(Boolean).join('; ') + '.';
    if (runSummary.textContent !== text) runSummary.textContent = text;
  }

  function scheduleSummary() {
    if (summaryScheduled) return;
    summaryScheduled = true;
    requestAnimationFrame(updateRunSummary);
  }

  advancedToggle.addEventListener('click', () => {
    const expanded = advancedToggle.getAttribute('aria-expanded') !== 'true';
    if (!expanded && document.activeElement?.closest('[data-advanced-only]')) {
      advancedToggle.focus({ preventScroll: true });
    }
    document.body.dataset.advanced = String(expanded);
    advancedToggle.setAttribute('aria-expanded', String(expanded));
    scheduleSummary();
    scheduleReport();
  });
  document.addEventListener('change', scheduleSummary);
  for (const id of ['watch-mode', 'compare-mode', 'clear-motor-blocks']) {
    document.getElementById(id).addEventListener('click', scheduleSummary);
  }
  window.addEventListener('fly-body-ready', scheduleSummary);
  // Native cycling changes the select value without dispatching a DOM event.
  new MutationObserver(() => {
    if (document.getElementById('repeat').checked) scheduleSummary();
  }).observe(document.getElementById('trial-description'), { childList: true, characterData: true });
  scheduleSummary();

  const blocks = ['block-mn9', 'block-mn6'].map(id => document.getElementById(id));
  const blockNote = document.getElementById('active-blocks');
  const blockStatus = document.getElementById('active-block-status');

  function showActiveBlocks() {
    const active = blocks.filter(input => input.checked);
    blockNote.hidden = active.length === 0;
    blockStatus.textContent = active.length
      ? active.map(input => input.id === 'block-mn9' ? 'MN9' : 'MN6').join(' and ') + ' drive blocked. Saved spikes are retained.'
      : '';
  }

  blocks.forEach(input => input.addEventListener('change', showActiveBlocks));
  document.getElementById('clear-motor-blocks').addEventListener('click', () => {
    const active = blocks.filter(input => input.checked);
    blocks.forEach(input => { input.checked = false; });
    if (active.length) active[0].dispatchEvent(new Event('change', { bubbles: true }));
    showActiveBlocks();
    if (document.activeElement.id === 'clear-motor-blocks') advancedToggle.focus({ preventScroll: true });
  });
  showActiveBlocks();

  let lastHeight = 0;
  let scheduled = false;
  let forceReport = false;

  function reportHeight() {
    scheduled = false;
    if (!main || window.parent === window) return;
    const rect = main.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const height = Math.ceil(rect.height);
    if (!forceReport && Math.abs(height - lastHeight) < 2) return;
    forceReport = false;
    lastHeight = height;
    window.parent.postMessage({ type: 'fly-body-height', height }, window.location.origin);
  }

  function scheduleReport() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(reportHeight);
  }

  new ResizeObserver(scheduleReport).observe(main);
  window.addEventListener('resize', scheduleReport);
  window.addEventListener('fly-body-ready', scheduleReport);
  window.addEventListener('load', scheduleReport);
  document.addEventListener('toggle', scheduleReport, true);
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin !== window.location.origin) return;
    if (!event.data || event.data.type !== 'fly-body-measure') return;
    forceReport = true;
    scheduleReport();
  });
  if (document.fonts) document.fonts.ready.then(scheduleReport);
  scheduleReport();
})();
