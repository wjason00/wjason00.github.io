/* Hash links reveal their complete native study, including with keyboard use. */
function revealStudy() {
  let target;
  try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); }
  catch { return; }
  if (!target) return;
  let opened = false;
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement && !parent.open) { parent.open = true; opened = true; }
  }
  if (opened) requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
}
addEventListener('hashchange', revealStudy);
revealStudy();
