# Jason Wang — project portfolio

Static GitHub Pages portfolio led by Jason's computational developmental-neuroscience work in MorphBrain, with
separate Model Morpher and Morphliner demonstrations.

## Demonstrations

- MorphBrain is an interactive production build loaded on request. The current World-A replay stops on a declared
  numerical tolerance rather than a fixed iteration count. The allowlist includes the application bundles, GW21–36
  atlas GLBs and Draco decoder only; parked eigenmode and mechanics assets are excluded.
- Model Morpher uses a compressed recording from the public desktop prototype, with same-page Allen Mouse CCF
  and BrainGlobe attribution.
- Morphliner reuses the exact video and poster from the live waitlist hero. The slot can later move to the iframe
  protocol documented in `demos/EMBED_CONTRACT.md`.
- The CV is available by request through the public UCL email address; no CV PDF is shipped with the site. The
  deployment check fails if a CV- or resume-named PDF is accidentally added later. The social preview card is
  site-specific and derived from the real MorphBrain World A interface.

The portfolio shell has no runtime dependencies, analytics, external fonts or CDN resources. The MorphBrain
sub-application bundles its own open-source runtime and fonts; data and software notices are published with the site.

## Files in the shell

| File | Role |
| --- | --- |
| `index.html` | The portfolio itself |
| `404.html`, `third-party-notices.html`, `licenses/index.html` | Secondary pages; all share the same header, footer and theme |
| `styles.css` | Every style for every page |
| `theme.js` | **Render-blocking by design.** Applies the stored theme before first paint and marks the document `js` |
| `script.js` | Deferred enhancement: theme toggle, demo loading, video controls, scroll-spy |

`theme.js` must stay in `<head>` without `defer`. It does two things that have to happen before the first frame:
applies a saved dark/light choice (otherwise every navigation flashes the light paper background) and adds a `js`
class that CSS uses to lay out script-only controls immediately (otherwise the video controls shift the page down
when `script.js` runs). Both are single-line changes with visible consequences — do not "optimise" it to `defer`.

## Progressive enhancement contract

- **No JavaScript**: the page reads normally, the videos keep native `controls`, the demo opens full screen in its
  own tab, and the theme follows `prefers-color-scheme`. Script-only controls are hidden by `html:not(.js)` rather
  than left on the page as dead buttons.
- **No WebGL**: `script.js` feature-detects a WebGL context before offering the MorphBrain demo. Without one, the
  Load button is replaced by a written explanation, the recorded poster stays, and the full-screen link remains.
- **Reduced motion / high contrast**: honoured via `prefers-reduced-motion` and `prefers-contrast`.

## Content-Security-Policy and the inline JSON-LD

Every page ships a strict CSP with no `'unsafe-inline'`. `index.html` carries one inline
`<script type="application/ld+json">` block for structured data, allowlisted by sha256 hash. **After editing that
block, regenerate the hash** or the browser drops it silently and logs a violation:

```
node scripts/csp-hash.mjs index.html
```

## Deployment

The Actions workflow assembles an explicit `_site` allowlist. Local QA captures, source maps, parked World-C mode
files and unrelated repository content are not deployed. Before uploading it asserts that the artifact contains no
source maps, no CV/resume PDF, no volumetric neuroimaging formats (`.nii`, `.nii.gz`, `.mgz`, `.dcm`), and stays
under 12 MB, then checks that every internal link and fragment resolves:

```
node scripts/check-links.mjs _site
```

Adding a file to the shell means adding it to the `cp` allowlist in `.github/workflows/pages.yml`; the build fails
loudly rather than deploying a page with a missing stylesheet or script.
