# Research gallery implementation plan

> Execution: root implements the homepage; a separate worker owns figure refinements and the explicitly requested Fable review. One writer per file. Jason approved C and said to go ahead; no further design approval is required for this scope.

**Goal:** Publish the accepted C composition with clearer source-backed figures and all existing study and software interactions preserved.

**Architecture:** Keep the static portfolio and scientific runtimes. Replace the opening/work index and its obsolete final CSS block with the gallery composition, retaining full native study accounts and existing interaction selectors. Reproducibly refine selected figure assets from their frozen sources after a bounded actual Fable critique.

**Tech stack:** HTML, self-hosted CSS/fonts, existing JavaScript, existing Node/Python figure renderers and Playwright.

**Spec:** `Applications/output/portfolio-design-20261021/c-gallery.html`, accepted by Jason on 21 October 2026; `demos/fly/ux-sheet.html`; task T-210.

**Bound:** 45 minutes from 18:34 UTC; finish with tested deployed page and delivery receipt, or the precise remaining release blocker.

## Constraints and ownership

- Root owns index.html, styles.css, assets/portfolio/gallery-home.css, portfolio presentation tests, README, UX sheet, release records and control task. No unrelated checkout changes.
- Figure worker owns renderer scripts, generated figure assets/provenance, focused figure tests and output/gallery-20261021/fable/. Actual Fable model identity must be recorded from the response.
- Preserve every legacy study/software hash, theme preference, no-script content, keyboard routes, model dialog recovery and user-triggered playback. Keep the complete Fly network and all 15 paired results co-visible at 1366×900.
- Preserve scientific data and runtimes, existing attribution and the held EEG boundary. No new experiment or validation claim. Selected schematic connections are not anatomy or activity flow.

## Review focus

- Phone opening: readable identity/action and research entry within the first screen; no overflow.
- Deep links: ancestor study disclosures and software panels open correctly, below the sticky header.
- Theme/reduced motion/no-script: explicit preferences persist; figures remain readable; optional motion cannot hide content.
- Scientific reading: selected inputs/outputs and plots retain exact values, conditions, units and interpretation limits.
- Existing model interactions: gallery keyboard navigation, playback and model dialog success/failure survive the restyle.

## Tasks

- [x] Inspect current owner and clean isolated checkout; branch codex/research-gallery-20261021. Baseline: 31 source tests and 42 browser cases passed.
- [x] Replace the homepage opening and work index with accepted C; replace obsolete homepage CSS, retaining study styles. Update only superseded presentation assertions and add compact-opening checks.
- [x] Obtain actual Fable critique; implement bounded figure refinements and preserve provenance. Record adopted/rejected suggestions and numerical/source checks.
- [x] Run build, source tests and all browser cases; inspect desktop/phone/light/dark captures and meaningful failure/no-script routes. Obtain one bounded independent combined review and figure fidelity check. Result: 33 source checks and 43 browser cases pass; final figure source audit found no material defect.

Release sequence: publish the clean verified commit, verify Pages and live bytes,
upload desktop/phone previews, reconcile README/T-210 and log scoped files.
Completion status and the exact deployed commit belong to T-210 and
`output/gallery-20261021/verification.json`, written after publication.

## Decisions

- Retain existing complete study disclosures and live software gallery after the new research index: the approved draft is a visual direction, not permission to discard source accounts or working demos.
- Keep system/stored theme behavior; provide the C palette in light mode and a readable green dark counterpart.
