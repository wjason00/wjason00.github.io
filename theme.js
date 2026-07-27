/*
 * Runs synchronously in <head>, before first paint.
 *
 * Two jobs, both of which must happen before the browser paints:
 *   1. Apply a stored colour-theme choice so a visitor who picked dark never
 *      sees a flash of the light paper background on navigation.
 *   2. Mark the document as script-enabled so CSS can lay out JS-only controls
 *      from the very first frame instead of shifting them in later.
 *
 * Keep this file tiny — it is render-blocking by design. Everything that can
 * wait belongs in script.js, which is deferred.
 */
(function () {
  var root = document.documentElement;
  root.classList.add('js');

  try {
    var saved = localStorage.getItem('portfolio-theme');
    if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;
  } catch (error) {
    /* Storage can be blocked entirely; fall back to prefers-color-scheme. */
  }
})();
