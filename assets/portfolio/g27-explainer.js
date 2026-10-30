/* Interactive stepper for the G27 EEG timing figure.
   Progressive enhancement: without JS every step renders in sequence.
   With JS, visitors step 1–5 paired with separate x-axis range highlights
   over the unchanged team PNG, or toggle "All 5 steps". */

export function initG27Explainers(scope = document) {
  const roots = [...scope.querySelectorAll('[data-g27-explainer]')];
  for (const el of roots) {
    if (el.dataset.g27Ready === 'true') continue;
    el.dataset.g27Ready = 'true';

    const pills = [...el.querySelectorAll('[data-g27-step]')];
    const items = [...el.querySelectorAll('[data-step]')];
    const prevBtn = el.querySelector('[data-g27-prev]');
    const nextBtn = el.querySelector('[data-g27-next]');
    const allBtn = el.querySelector('[data-g27-all]');
    const live = el.querySelector('[data-g27-live]');
    const count = items.length;
    if (!count || !pills.length) continue;

    let current = 1;
    let showAll = false;

    function apply(announceChange = false) {
      el.dataset.activeStep = showAll ? 'all' : String(current);
      for (const item of items) {
        const match = !showAll && Number(item.dataset.step) === current;
        item.classList.toggle('is-active', match);
      }
      for (const pill of pills) {
        const match = !showAll && Number(pill.dataset.g27Step) === current;
        if (match) pill.setAttribute('aria-current', 'step');
        else pill.removeAttribute('aria-current');
      }
      if (allBtn) {
        allBtn.setAttribute('aria-pressed', showAll ? 'true' : 'false');
        allBtn.textContent = showAll ? 'Single step' : 'All 5 steps';
      }
      if (prevBtn) prevBtn.disabled = !showAll && current <= 1;
      if (nextBtn) nextBtn.disabled = !showAll && current >= count;

      if (announceChange && live) {
        if (showAll) {
          live.textContent = 'Showing all 5 walkthrough steps.';
        } else {
          const head = items[current - 1]?.querySelector('.g27x__step-title')?.textContent?.trim() || '';
          live.textContent = `Step ${current} of ${count}: ${head}`;
        }
      }
    }

    function goTo(step, focusPill = false) {
      current = Math.max(1, Math.min(count, step));
      showAll = false;
      apply(true);
      if (focusPill) pills[current - 1]?.focus();
    }

    for (const pill of pills) {
      pill.addEventListener('click', () => {
        goTo(Number(pill.dataset.g27Step), false);
      });
      pill.addEventListener('keydown', event => {
        const idx = Number(pill.dataset.g27Step);
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          goTo(idx < count ? idx + 1 : 1, true);
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          goTo(idx > 1 ? idx - 1 : count, true);
        } else if (event.key === 'Home') {
          event.preventDefault();
          goTo(1, true);
        } else if (event.key === 'End') {
          event.preventDefault();
          goTo(count, true);
        }
      });
    }

    prevBtn?.addEventListener('click', () => {
      if (showAll) goTo(1, false);
      else if (current > 1) goTo(current - 1, false);
    });

    nextBtn?.addEventListener('click', () => {
      if (showAll) goTo(1, false);
      else if (current < count) goTo(current + 1, false);
    });

    allBtn?.addEventListener('click', () => {
      showAll = !showAll;
      apply(true);
    });

    apply(false);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initG27Explainers(), { once: true });
  } else {
    initG27Explainers();
  }
}
