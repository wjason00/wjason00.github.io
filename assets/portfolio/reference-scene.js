/* A static source specimen is always present. Scrolling changes only the
   presentation of that illustration, never neural data or the source rig. */
const opening = document.querySelector('.specimen-opening');
const specimen = opening?.querySelector('.specimen-opening__scene img');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let scheduled = false;
function positionSpecimen() {
  scheduled = false;
  if (!opening || !specimen) return;
  const progress = Math.max(0, Math.min(1, -opening.getBoundingClientRect().top / opening.offsetHeight));
  specimen.style.transform = reduced.matches ? 'none' : `translateY(${progress * 42}px) rotate(${progress * 5}deg)`;
}
addEventListener('scroll', () => {
  if (!scheduled) { scheduled = true; requestAnimationFrame(positionSpecimen); }
}, { passive: true });
reduced.addEventListener('change', positionSpecimen);
positionSpecimen();

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
