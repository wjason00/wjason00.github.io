# Jason Wang — portfolio

A static portfolio for computational neuroscience and machine-learning researchers,
labs and placement selectors. Research questions, methods and evidence come first;
geometry and animation tools provide supporting software examples.

## Independent EEG project withheld — 17 October 2026

Jason asked to hold the cross-session/time-lagged EEG study from portfolio, CV and promotional use
because he does not yet understand it. Its homepage entry, introductory claim and public aggregate
evidence have been removed; the build excludes its figure and CSV. Research sources and historical
receipts remain in Git and their private owners. Neonatal EEG source modelling, the fly study,
MorphBrain, Model Morpher and Morphliner retain their existing scope. Next action: see T-113.

## Research update — 15 October 2026

The fly circuit and EEG normalization studies now lead the research section. Their
questions, Jason's proposed/directed contribution, checked results and limitations
follow the current project owners and reviewed master CV. dPCA remains a smaller
supporting methods study; its interactive artifact and all existing projects remain.

Only checked figures and aggregate CSV summaries were added under
`assets/portfolio/research-20261015/`. No raw EEG, subject MRI or trial-level predictions
are included. `scripts/prepare-research-evidence.py` derives those summaries from the
verified saved outputs and records exact local sources in ignored
`output/research-20261015/source-provenance.json`. Pass the verified study directories
with `--fly-source` and `--eeg-source`; local machine paths are not hard-coded in the
public generator. The public JSON contains aggregate
methods, limits and source hashes. Original research owners retain full execution and
contribution provenance; public wording does not assert sole manual implementation.

Actual Claude Opus 5.5 reviewed the changed scientific copy. The revised version
discloses both fly post-failure amendments and the EEG verifier correction; the
127,400-neuron count is bound to the verified run identity. Codex checked the
dispositions and rebuilt the site. Jason authorised public release on 15 October.
T-089 owns deployment verification; the existing 12 October release below is history.

**Source wording correction — 15 October 2026:** the primary paper's Methods
(Par60) explains the dataset's left-right inversion and corrected biological naming.
The site, aggregate evidence and its generator now retain the narrower unresolved
limits: genetic-driver coverage and historical cell-ID lineage. Numerical results,
figures and earlier review receipts are unchanged. This source-checked correction
has its own [build and layout receipt](output/research-20261015/hemisphere-wording-20261015.json);
the existing Claude review retains its original scope. This correction is included
in the 15 October research update.

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

- **Research:** the completed fly sensitivity and EEG normalization comparisons lead, with checked figures, aggregate downloads and scientific limits. The UCL research-assistant role remains described at the level of EEG source modelling.
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
