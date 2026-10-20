# Fly progressive disclosure implementation plan

> **For agentic workers:** Use the current subagent workflow with one owner per file. Jason explicitly requested analysis, planning and implementation in this session.

**Goal:** Make the whole Fly explorer understandable before exposing specialised settings.

**Architecture:** Keep each scientific visual and its primary readout visible. One Advanced control per active view reveals secondary controls and explanations without resetting state. Always-visible summaries disclose settings that affect interpretation.

**Tech stack:** Static HTML/CSS, existing JavaScript controllers, Three.js and Playwright.

**Spec:** The scope/default/advanced matrix below; the durable public review and future checklist will live at `demos/fly/ux-sheet.html`.

## Review and design decisions

The previous pass solved co-visibility by displaying nearly every related control. That confused availability with priority. This is a heuristic review informed by Jason's feedback, not a measured usability study.

| Problem | Decision |
| --- | --- |
| Scene, raster, motor badges, contact metrics and final outcome compete | Default to scene + raster; defer exact stepping, duplicate cues and illustrative outcome |
| Run choices and specialised variations have equal visual weight | Keep Input/Circuit and playback; defer trial/cycle/speed/drive tests |
| Anatomy repeats the neuron picker and implies experimental controls change static shapes | Keep one picker; separate static structure from saved-output settings |
| Full IDs and long evidence paragraphs dominate selection | Keep role, critical limit and selected effective weight; reveal audit detail on request |
| Hidden settings could silently change meaning | Keep current settings, comparison/drive warnings and a reset route visible |

Palette: paper #f4f6f7, ink #24333d, muted #5e6d77, line #d2dbe0, action teal #197989, condition mauve #87476a. Keep Source Sans 3; no new decoration, type family or animation. Left-align controls and explanations. Preserve the source specimen as the memorable visual.

Default layout: primary controls → two aligned scientific panes → one reference disclosure. Advanced reveals specialised tools beside their relevant content. It does not replace the visual with a settings page.

## Constraints and acceptance

- Preserve geometry, saved events, native renderer and motor/contact policies byte-for-byte.
- Preserve existing control IDs; scope secondary visibility on a stable ancestor because controllers regenerate children.
- Keep graph/skeleton/scene, native raster or paired output visible with Advanced closed.
- Keep prescribed-input, saved-simulation, uncalibrated-movement, separate-archive and comparison-pairing boundaries clear.
- Do not reset selection, time, camera or settings when toggling. Summarise hidden active settings.
- Use keyboard-operable buttons with aria-expanded and aria-controls; no hidden focused control.
- Basic body has no trial/cycle/speed/spike-step/drive-test controls. No duplicate anatomy picker.
- Essential HTML text is at least12px; do not conceal density with tiny type. Source canvas labels remain source-renderer output.
- Desktop1366×900: scene and raster co-visible. Phone390×844: main visual starts in first viewport, signals follow playback before secondary material. Single page scroll.
- Budgets are project acceptance rules, not universal UX laws; real task performance remains to be tested.

## Tasks

- [ ] Body: `body/index.html`, `body/embed.css`, `body/interface.js`: Advanced state, compact basic controls, summaries, concise captions and retained warnings. Verify default, compare/blocks, toggle during replay and frame resizing.
- [ ] Parent views: `index.html`, `explorer.css`, `explorer.js`, `network.js`, `morphology.js`, `fly.js`: Advanced state, one picker, concise selection, readable adjacent paired output. Preserve model maths. Verify lazy mounting, dynamic selection and settings after collapse.
- [ ] UX sheet: `ux-sheet.html`: compact default/advanced contract, critique, release checks, sources and small observational test script. Link from README and repository instructions. HTML is the canonical readable/editable sheet; Docs guide tools are unavailable.
- [ ] Root: update `tests/fly-portfolio.spec.mjs`, provenance and versioned asset URLs. Run affected browser/source checks, build/link checks, review screenshots and final independent defect review. Publish, verify live asset bytes and behaviour, then record T-168 and its receipt.

## Review focus

1. Advanced setting changed then closed: preserved value, visible summary and correct output.
2. Lazy anatomy mount or new neuron selection while collapsed: secondary content stays hidden; scientific limit stays visible.
3. Native compare/drive blocks while collapsed: pairing caveat and active warning remain visible, clear action works.
4. Keyboard toggle and playback: focus remains valid; replay state is not reset.
5. Phone and long labels: no overflow, readable controls, visible main action and no nested iframe scroll.

Research basis: [NN/G progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/), [GOV.UK Details](https://design-system.service.gov.uk/components/details/), [W3C Disclosure](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/). Keep essential information visible; defer specialised detail; make disclosure discoverable and accessible.
