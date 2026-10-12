# Jason Wang — portfolio

A static portfolio for computational neuroscience and machine-learning researchers,
labs and placement selectors. Research questions, methods and evidence come first;
geometry and animation tools provide supporting software examples.

## Portfolio release — 12 October 2026

This iteration gives the synthetic dPCA study a full visual feature,
clarifies its ground-truth metrics, and provides a direct CV-request route. Morphliner
now opens on an actual Trainer camera sequence with inline playback, three shot
shortcuts, a matching editor view and a clearly separate product render.

The site describes demonstrated project behaviour. Scientific limits are retained: the MorphBrain model is
illustrative, the dPCA study is synthetic, and the Morphliner video demonstrates
camera motion and captions around one model. Full Morphliner release remains in
development. No unpublished Fabrizi results or restricted research assets are shipped.

The implementation commit `98b3849` was pushed on 12 October 2026 to
[`codex/portfolio-publishable-20261012`](https://github.com/wjason00/wjason00.github.io/tree/codex/portfolio-publishable-20261012).
Publication was authorised on 12 October 2026. The live URL is
[wjason00.github.io](https://wjason00.github.io/); GitHub Pages deploys `main` through
the checked workflow below. T-065 and the local release receipts record deployment verification.

## Explore

- **Research:** the UCL research-assistant role is described at the level of EEG source modelling.
- **Rare-error study:** six saved trial allocations, five noise seeds, an explicit zero-error non-fit,
  full curves and downloadable metrics/configuration/provenance. Downloads do not include the analysis code.
- **MorphBrain:** a keyboard-operable saved-image comparison and an on-demand interactive model.
  Closing its dialog disposes the runtime; a full-page link remains available.
- **Model Morpher:** a scrub-capable recording of the public Python geometric-morphing prototype.
- **Morphliner:** a 6.5-second 1080p demo excerpt, matching editor screenshot and separate product render.
  A complete nine-second 720p Free export remains linked in the project notes.
- **Contact:** public UCL email, CV by request, GitHub and LinkedIn. No CV PDF is published.

## Preview and check

```powershell
npm ci
npm run build
node scripts/serve-static.mjs _site 4187
```

Open `http://127.0.0.1:4187/`. The server supports byte-range requests for video seeking.
`npm run build` creates a fresh `_site` from the publication allowlist, rejects prohibited
files and artifacts at or above 12 MiB, verifies copied file hashes and checks all internal
HTML links. Its manifest is saved to the ignored `output/release-manifest.json`.

The same assembly command runs in `.github/workflows/pages.yml` before deployment.
To check the assembled artifact's responsive layout:

```powershell
npx playwright install chromium
$env:PORTFOLIO_SITE_ROOT = '_site'
npm run test:layout
```

## Source map

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Portfolio content and responsive layout |
| `script.js` | Gallery, comparisons, video controls, shot selection, dialog and navigation |
| `theme.js` | Applies a stored colour theme before first paint; intentionally render-blocking |
| `rare-errors.html`, `assets/portfolio/study.css`, `assets/portfolio/study.js` | Saved-results study interface |
| `assets/portfolio/rare-errors/` | Frozen metrics, configuration, provenance and original figures |
| `scripts/portfolio-study.py` | Builds presentation data from hash-verified study outputs; runs no experiment |
| `scripts/build-site.mjs` | Shared local and CI publication assembly |
| `scripts/check-links.mjs` | Public HTML link and fragment verification |
| `404.html`, `third-party-notices.html`, `licenses/` | Secondary pages and source/licence information |

The shell has no runtime dependency, analytics or external font requests. Fonts and
the separate MorphBrain runtime are served locally. Source and data credits are in
`third-party-notices.html` and `licenses/`.

## Content and accessibility contracts

- No JavaScript: project previews and native video controls remain available; inactive custom controls are hidden.
- Keyboard: gallery tabs, saved-image reveal, video scrubbing, shot shortcuts and model dialog are operable.
- Reduced motion and forced colours are supported. Theme choice persists between pages.
- The study shows saved observations, not interpolated or newly fitted results.
- Frozen study downloads retain their exact bytes in Git so published provenance hashes remain valid.
- Videos do not autoplay. Hidden or offscreen videos pause, and only one video plays at a time.
- The inline JSON-LD is covered by a CSP hash. After changing it, run `node scripts/csp-hash.mjs index.html`
  and update the `script-src` hash. Do not weaken the CSP.
- Only the named shell files and `assets/`, `demos/`, `licenses/` enter `_site`. Private notes, local captures,
  build scripts and source maps are excluded. Keep restricted data and CV/resume PDFs out of the artifact.

## Local verification record

The assembled candidate passed four responsive-layout tests, 72 homepage/player checks,
27 study checks, seven final mobile/forced-colour checks and ten build-boundary checks.
Desktop, phone and dark-theme captures were visually reviewed. The release contains
89 public files (11,450,963 bytes); the ZIP is checked against the full file-hash manifest.
These are implementation and presentation checks, not additional research validation.

Current checks, media derivation, public file hashes and screenshots are saved under
`output/portfolio-final-20261012/` and `output/playwright/portfolio-final-20261012/`.
The exact earlier README, including dated decisions and source boundaries, is preserved
at `output/portfolio-final-20261012/before/README.md`. These local records are excluded
from the website. T-065 in the shared control vault owns next actions and completion.
