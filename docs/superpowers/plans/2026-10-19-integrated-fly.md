# Integrated Fly Explorer Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent anatomy/body modules and executing-plans for root integration. Root owns integration and release; workers own disjoint files.

**Goal:** Publish one fly page with cited neuron roles, real source skeletons and the existing body replay.

**Architecture:** Keep paired data and graph modules. A view controller coordinates neuron selection across graph/anatomy; body is a lazy same-origin iframe with its separate archive. Local assets and source receipts are packaged explicitly.

**Tech stack:** Existing static HTML/CSS/ES modules, local Three.js, Python extraction, Node test runner.

**Spec:** ../specs/2026-10-19-integrated-fly-design.md

## Global constraints

- Source geometry and graph IDs pinned to materialization 630; IDs remain strings.
- No fabricated anatomy, unrecorded activity, new simulations or changed results.
- Body archive/mapping clearly separated from paired experiment; keep controls unambiguous.
- Local public assets only, redistribution attribution and hashes retained.
- Keyboard accessible, mobile readable, no autoplay; same portfolio URL and CV unchanged.

## Review focus

- Missing skeleton for a selected graph neuron: show truthful absence rather than another cell.
- View changes during async loading: display requested view without duplicate renderer or stale selection.
- Very large IDs: never coerce to JavaScript Number.
- Body view: hide unrelated paired controls; no suggestion of matched body trials.
- Unavailable WebGL or asset load: give useful fallback while source explanations/results remain usable.

### Task 1: Real neuron geometry and viewer — anatomy worker

Own morphology.js, morphology data/provenance/style, extraction script and tests. Verify official public release source, retrieve exact graph IDs, retain common coordinate frame and units. API `mountMorphology(container,{onSelect})` returns `{selectNeuron(id),resize()}`. Validate geometry/IDs/coordinate conversion with a failing then passing data test. Report unavailable cells and source checks.

### Task 2: Portable body replay — body worker

Own body/ and vendor/three.min.js plus license. Package dependency closure from functioning original; strip local-only navigation. Verify local references, source licensing and unchanged archive/policy with failing then passing packaging test. Report bytes and hashes.

### Task 3: Roles and view integration — root

Own neuron-roles.js, explorer.js, index.html, network.js, fly.js, fly.css and build budget. Add role resolution tests for sensory, motor, named and unannotated cells; ensure model sign does not invent function. Add selection event and programmatic graph selection. Three accessible tabs coordinate lazy views; preserve focus and hide paired experiment during body view. Run Node module tests and build/link checks.

### Task 4: Review and publish — root with independent reviewer

Review bounded diff and provenance against spec. Fix material defects. Verify all three views, matched input controls, anatomy selection/rotation/reset, body replay, mobile stacking and WebGL fallback. Record artifact size, commit and deploy; read back live bytes and browser result. Update owner and T-164, then ctl log. No new review of unchanged CV.
