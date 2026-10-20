# Portfolio disclosure implementation plan

> **For agentic workers:** use the executing-plans workflow for the homepage; root integrates a disjoint test/design-contract worker and one final review. Steps use checkbox tracking.

**Goal:** apply the Fly interface's prioritisation to the main portfolio and return the complete local LinkedIn package.

**Architecture:** retain the static homepage, one software gallery and native HTML disclosures. No new page mode or runtime. Preserve the newly published timing study and research wording at bc44506.

**Tech stack:** HTML, CSS, native details/summary, existing Playwright checks and publication builder.

**Spec:** Jason's current request and the canonical contract at `demos/fly/ux-sheet.html`. The homepage is a project-selection surface: local Methods & sources disclosures contain optional detail; question, result, contribution and critical limit remain visible.

## Global constraints

- Preserve all scientific claims, numerical results, limitations and source assets. Moving framing into existing disclosures does not revise evidence.
- Retain project IDs, launch-demo hooks, gallery keyboard behaviour and all deep links.
- No changes to frozen science, native runtimes, T-113 exclusions or the dirty Desktop checkout.
- Root owns index.html, styles.css, README.md, this plan, release and task state. Worker owns tests/portfolio-layout.spec.mjs and the homepage section of demos/fly/ux-sheet.html. One writer per file.
- Finish within 25 minutes: deployed verified homepage and a working complete LinkedIn link; save any blocker precisely.

## Design

Retain the existing slate/white research palette (#f4f6f7, #24333d, #5e6d77, #d2dbe0, #365e76) and self-hosted Source Sans 3. Let the scientific figure provide visual interest. Short opening above research; aligned result/figure, then timing and rare-error study; one preview stage followed by compact project accounts. Remove decorative project numbering and duplicate questions, retaining meaningful preview-return links.

## Review focus

- Native disclosures must open by keyboard with JavaScript disabled.
- Critical limits and all 15 paired comparisons must remain visible when details are closed.
- Software gallery, paused videos and model modal must preserve existing behaviour.
- Deep-link IDs and all source/download links must survive consolidation.
- Desktop and phone must retain readable visuals without overflow; inspect captures in both themes.

## Task 1: simplify the portfolio selection surface

**Files:** index.html, styles.css; worker tests/portfolio-layout.spec.mjs and demos/fly/ux-sheet.html; README.md.

**Interfaces:** consumes current gallery/data-launch-demo hooks and native details; produces the same routes with one optional methods disclosure per software project.

- [ ] Shorten intro; move the full Fly contribution/framing paragraph into its existing evidence disclosure, with a concise equivalent contribution visible. Preserve full result and interpretation limit.
- [ ] Remove duplicate software questions/eyebrows/numbers; preserve each action, purpose and critical limit. Consolidate MorphBrain's separate methods sections without deleting their content or IDs.
- [ ] Refine spacing for the shorter identity column; use the same restrained primary action treatment across software accounts.
- [ ] Extend the canonical UX sheet with homepage surface and acceptance rules; add a focused browser check for visible evidence/limits, one methods disclosure per project and no-JS keyboard access.
- [ ] Run the build and affected homepage browser checks; inspect desktop/phone captures. Run one bounded final review and fix any substantive issue.
- [ ] Update README with current scope and verification receipt, commit named files, push normally to main, inspect deployment success and verify changed public file bytes.
- [ ] Reopen/close T-173 with evidence and same-session scoped log. Return public portfolio and verified local LinkedIn package links.

## Execution rulings

Jason authorised implementation and live website updates. Continue directly; an extra plan-approval gate would repeat an already supplied instruction. The complete LinkedIn package remains local-only and its existing server has been restored without editing copy or the live profile.
