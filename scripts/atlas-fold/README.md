# atlas-fold — hero cortical-folding backdrop

Builds `assets/atlas/atlas-fold.webp`, the greyscale sprite sheet the hero
backdrop uses as a CSS `mask-image`.

**Nothing here runs at deploy time.** The CI workflow copies a fixed file list
and never invokes these scripts; the committed `.webp` is the shipped artefact.
This exists so the asset is reproducible rather than a mystery binary.

## Run

```sh
node   scripts/atlas-fold/decode-atlas.mjs   .work
python scripts/atlas-fold/build-fold-sheet.py .work --cell 400 --quality 78
```

About 5 s end to end (1 s decode, 2 s render, 2 s encode). `--probe` also dumps
the per-week PNGs and the pre-compression sheet for inspection.

Requires `vtk`, `numpy`, `pillow` and Node. **No npm install, no network, no
ffmpeg.** Draco decoding reuses `demos/morphbrain/draco/draco_decoder.js`, which
the repo already ships for the demo.

## What the two stages do

**`decode-atlas.mjs`** — every `week-*.glb` lists `KHR_draco_mesh_compression`
in `extensionsRequired`, so the geometry cannot be read without a Draco
decoder. It writes `pos.bin` / `col.bin` / `idx.bin` and asserts that all
sixteen weeks share one topology (64 984 verts / 129 960 faces), which the
sprite sheet depends on.

> Do not substitute `trimesh` here. It reads the accessor metadata, reports the
> correct vertex and face counts, and silently returns **every vertex at
> (0, 0, 0)**. It cannot decode Draco and does not raise.

**`build-fold-sheet.py`** — renders each week orthographically from a fixed
right-lateral camera, converts shading to mask coverage, tight-crops the union
silhouette, and tiles the sixteen frames into one 4×4 sheet.

## Three decisions worth keeping

**Physical rescaling.** GLB coordinates are normalised per week
(`"normalisation": "centroid-and-max-radius-per-week"`), so rendering them raw
would show folding at a *constant brain size* and hide the growth completely.
Each week is scaled by `radiusMmPerUnit / max`, taken from
`demos/morphbrain/atlas/reference-series.json`. Projected area then grows 2.67×
across GW21→36 — the visible half of the story whose other half is the surface
area added by folding.

**No interpolation.** The same manifest records
`"correspondence": "registered-template-location-not-material-particle"` —
vertex *i* matches across weeks by template registration, not by tracking
tissue. Tweening between weeks would therefore animate material motion the
dataset explicitly disclaims. Sixteen cells, sixteen real timepoints.

**Mask in luminance, not alpha.** WebP compresses alpha with a separate,
near-lossless codec: the identical sheet measures **379 KiB** with the relief in
alpha versus **65 KiB** in luminance. `styles.css` therefore sets
`mask-mode: luminance` explicitly (the `match-source` default reads *alpha* for
a raster and would mask to a solid block) behind an `@supports` gate, so a
browser honouring neither property paints no backdrop rather than a tinted
rectangle over the hero copy.

Verified in-browser: CSS luminance masking maps the sRGB value straight to
coverage (`v/255`, error ≤ 1/255) with no linearisation, so the sheet needs no
gamma pre-compensation.

## Changing the output

`--cell` sets the sprite cell width; the height and the CSS `aspect-ratio`
follow from the union bounding box and are printed on completion. **If you
change `--cell`, update `aspect-ratio` in the `.hero__fold-frames` rule** — the
element is sized from one length so that each cell lands undistorted, and a
stale ratio would stretch the brain.

Measured cost at quality 78: cell 360 → 50 KiB, 400 → 65 KiB, 440 → 71 KiB.
Quality barely matters at the shipped 0.12 layer opacity (q70 versus q84 differ
by ≤ 5.6/255 in the final composite), so prefer the smaller file if in doubt.

`ALPHA_FLOOR` keeps the silhouette readable as a solid shape; `CURV_LO/HI`
clamp the curvature range that becomes relief.

Contrast is the binding constraint on `opacity`, not taste — see the note in the
`.hero__fold-frames` rule before raising it.
