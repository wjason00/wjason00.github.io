/* Presentation only: frame sizing and the visibility of active drive blocks. */
(function () {
  'use strict';
  const main = document.querySelector('main');
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
  });
  showActiveBlocks();

  if (!main || window.parent === window) return;
  let lastHeight = 0;
  let scheduled = false;
  let forceReport = false;

  function reportHeight() {
    scheduled = false;
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
