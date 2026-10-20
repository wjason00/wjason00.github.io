# Fly portfolio media implementation plan

**Goal:** replace the dense homepage research plate with a recorded fly replay and a compact, faithful saved-result comparison.

**Spec:** Jason requested an improved figure and a fly video. The canonical UX sheet governs scientific visibility and optional detail. The video uses the existing renderer and a separate motor archive; it is not paired-study motion or animal footage.

**Design:** one full-width project header, then a roughly 60/40 video/chart row; stack on phones. Retain Source Sans 3 and the slate palette. Use the source renderer's pale background beside a white vector chart, labelled by evidence type. Let real geometry and saved model counts supply the visual interest. No autoplay or decorative motion.

**Ownership:** root owns index.html, styles.css, script.js, tests, UX contract, README, release and T-173. Video worker owns only new MP4/WebP assets and ignored capture receipts. Figure worker owns the new plotting script/SVG and ignored plotting receipt. All original science and native renderers remain frozen.

**Time cap:** 30 minutes from 09:57 UTC. Finish with the deployed media/chart, public-byte verification, source/number checks and a working user link; record an exact blocker if the cap is reached.

## Steps

- [ ] Record the unchanged renderer over a disclosed saved replay window; H264, muted, native controls, clean poster and no browser chrome. Verify duration, decoded frames and actual frame changes.
- [ ] Redraw all 15 matched pairs from SHA-verified primary CSV: three gains, common nonnegative count axis, two direct condition encodings, input-seed pairing. Remove the repeated ratio panel, rainbow legend and miniature methods.
- [ ] Integrate both as one responsive homepage visual row. Keep result, contribution and critical limits visible. Move the old figure link into evidence, retaining exact original bytes.
- [ ] Keep the separate-archive/unvalidated-movement boundary visible. Link the complete explorer and original evidence; no new biological claim.
- [ ] Check the new figure independently against primary counts; inspect actual rendered figure and movie frames.
- [ ] Build and run affected browser checks: playable native video, pause when offscreen, co-visible desktop panes, phone stacking, no-JS media access, existing gallery/modal behaviour.
- [ ] Update canonical UX contract/README, commit named files and publish normally. Verify deployment and exact public bytes, update T-173 and log the owned change.

## Acceptance

An unfamiliar visitor can see a fly, play its recorded replay, and read the paired count evidence on the same project surface without mistaking the video for the gain experiment. Automated QA is implementation evidence, not a completed user study or new scientific validation.
