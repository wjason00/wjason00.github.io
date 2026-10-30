# Agent rules for wjason00.github.io

Jason Wang's public portfolio, deployed by GitHub Pages at https://wjason00.github.io.
Google Antigravity is the only agent that writes to this repository.

## Scope
- Work only inside this workspace folder. Never read or write files outside it, and never open
  or edit another repository, even when a path or link points there.
- One branch per task, named `antigravity/<task>`, created from the base the task names.
  Push that branch and open a draft pull request. Jason reviews and merges.
- Never push to `main`. Pushing to `main` deploys the live site through
  `.github/workflows/pages.yml`. Don't change that workflow, Pages settings or repository settings.
- Don't delete, rebase or force-push other branches.
- Don't add planning, tracker or handoff documents. The pull request and walkthrough carry that.

## Claims
- Every project claim must match that project's own README and link to it. The task prompt
  supplies the source text. If you don't have it, don't go looking outside the workspace.
- If the evidence is unclear or missing, write "in progress" and list the claim in the walkthrough.
- Never add metrics, results, awards, job titles or affiliations that the source doesn't contain.
  Don't round, combine or reword numbers beyond what the source says.
- Produced is not validated. "Built", "ran" or "implemented" never becomes "showed",
  "validated" or "demonstrated" unless the source says so.
- Keep Fabrizi (supervised UCL EEG work), MorphBrain and Morphliner claims separate. Never
  share results, figures or wording between them.
- Keep each existing limitation sentence next to the claim it qualifies.
- If the project's README is in a private repository, add no link to it. Flag it in the walkthrough.

## Stack
- Static HTML, CSS and vanilla JavaScript. `scripts/build-site.mjs` builds `_site/` from an
  allowlist, rejects prohibited files, enforces a 32 MiB budget and checks internal links.
- `demos/morphbrain/` is a prebuilt bundle from another repository. Don't edit it.
- Keep the current stack. Ask Jason before adding any dependency, framework, CDN, web font,
  analytics, tracker, cookie or third-party embed.
- Keep the Content-Security-Policy. After changing inline JSON-LD, run
  `node scripts/csp-hash.mjs index.html` and update the hash.
- Never commit raw MRI/EEG data, CV or resume PDFs, or anything `.gitignore` blocks.
- Existing contracts: `demos/fly/ux-sheet.html` (Fly explorer) and the
  "Content and accessibility contracts" section of `README.md`.

## Visual design
Jason requested: "Can you update similar to Motionsites from Lovable and communicate to all other websites and etc." He confirmed "Use the general MotionSites direction" and "Also restyle existing sites now", then rejected the first implementation: "This looks bad. I meant look at specific sites i.e. from Lovable, Framer, MotionSites, Awwwards." This means research concrete live examples from those sources and adapt a coherent composition; a platform name is not a style specification. The rejected slate-block portfolio is not an accepted design standard.

Before designing, inspect and link specific rendered sites, including their imagery, spacing, type, navigation and phone behaviour. Name one primary reference and the particular decisions being transferred. Show a concrete composition with the actual project content early. Do not infer design quality from marketplace copy, a catalog screenshot, adjectives or another model's acceptance. Apply the resulting reference-led direction to existing sites within their functional and audience constraints; do not propagate a rejected implementation.

- Start with the audience and one clear task. Build a deliberate composition around real project imagery, confident typography, generous spacing and a consistent small set of colours and surfaces. Avoid assembling unrelated cards, decorative gradients or repetitive effects. Adapt the visual language to the product rather than imposing one template on every site.
- Use motion to explain orientation, selection or a meaningful change. Prefer one composed opening or a restrained response to navigation over an entrance animation on every block. Keep ordinary scrolling, keyboard operation, readable static content and a complete reduced-motion/no-script experience. Do not autoplay scientific footage or animate evidence values for decoration.
- On research pages, keep the scene, result and essential interpretation limit available together. Distinguish illustrative movement from measured or simulated results. Optional technical detail can be disclosed; the question, contribution, result and next action remain visible.
- Before release, inspect desktop and phone captures and exercise navigation, controls, loading/failure, reduced motion and no-script fallbacks. A screenshot or automated test does not establish reader comprehension. Preserve source attribution, data, scientific runtimes and existing audience/privacy constraints.

This is a shared design preference for Codex, Claude and other project agents. Project entry points should link here and retain their own functional contracts. Propagating the preference does not itself restyle an existing app or authorise changing a local/private site's audience. The portfolio's concrete acceptance rules remain in its [UX sheet](C:/Users/jason/Documents/ChatGPT/portfolio-fly-demo-20261019/demos/fly/ux-sheet.html).

## Before calling a task done
1. `npm ci`, then `npm run build`. It must pass with no link errors and stay under the budget.
2. `node --test tests/*.test.*` passes.
3. Layout tests: `$env:PORTFOLIO_SITE_ROOT='_site'; npm run test:layout`. They must pass,
   or the walkthrough must give the exact failure.
4. Serve with `node scripts/serve-static.mjs _site 4187`. Check every changed page in the browser
   at 360px and 1280px wide. Look for: no horizontal scroll, no broken images or video, alt text
   present, keyboard use working, and pages still usable without JavaScript.
5. Links: the build checks internal links. Open every external link you added or changed.
6. The walkthrough includes screenshots of each changed page at 360px and 1280px, the commands
   you ran and their results, each changed claim with its source, and anything you didn't verify.
