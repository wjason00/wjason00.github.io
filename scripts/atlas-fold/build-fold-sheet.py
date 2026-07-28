#!/usr/bin/env python3
"""
build-fold-sheet.py — stage 2 of the hero fold-sequence build.

Turns the decoded dHCP fetal atlas surfaces into ONE greyscale WebP sprite
sheet that styles.css uses as a CSS `mask-image`.

Why a mask and not a picture of a brain
---------------------------------------
The site is themed (light / dark / auto-dark). A baked colour raster would be
wrong in at least one theme. A single-channel mask carries only *shape and
relief*; the colour comes from `background-color: var(--brain)` underneath, so
one asset is correct in every theme and re-tints for free.

Why 16 discrete cells and no interpolation
------------------------------------------
reference-series.json records
    "correspondence": "registered-template-location-not-material-particle"
i.e. vertex i matches across weeks by template registration, NOT by tracking
tissue. A smooth tween would therefore depict material motion the dataset
explicitly disclaims. Sixteen steps = sixteen real atlas timepoints, nothing
invented between them. (It is also the cheaper option.)

Why the weeks are rescaled to millimetres
-----------------------------------------
The GLB coordinates are normalised per week
    "normalisation": "centroid-and-max-radius-per-week"
so rendering them as-is would show folding at a CONSTANT brain size and hide
the growth entirely. reference-series.json carries radiusMmPerUnit per week,
so each week is scaled back to physical proportion before rendering.

Requires: vtk, numpy, pillow. No npm, no network, no ffmpeg.
Never runs at deploy time — the committed output is assets/atlas/atlas-fold.webp.

Usage:
  python scripts/atlas-fold/build-fold-sheet.py <workDir> [--cell 440]
         [--render 1200x850] [--quality 82] [--out assets/atlas/atlas-fold.webp]
         [--probe]
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np
import vtk
from PIL import Image
from vtk.util import numpy_support as ns

REPO = Path(__file__).resolve().parents[2]
ATLAS = REPO / "demos" / "morphbrain" / "atlas"

# Curvature (COLOR_0) clamp. The distribution's mode sits at 125 = flat; the
# tails beyond this range are a handful of vertices and only crush the relief.
CURV_LO, CURV_HI = 60.0, 230.0

# Mask transfer. Inside the silhouette alpha never drops below FLOOR, so the
# outline always reads as a solid shape; sulci (dark in the shaded render)
# go to full alpha, gyral crowns stay sheer. This is what makes the fold
# legible at the very low layer opacity the hero needs.
ALPHA_FLOOR = 0.20


def load(work: Path):
    shape = json.loads((work / "shape.json").read_text())
    n, f = shape["vertices"], shape["faces"]
    pos = np.fromfile(work / "pos.bin", dtype=np.float32).reshape(16, n, 3)
    col = np.fromfile(work / "col.bin", dtype=np.uint8).reshape(16, n)
    idx = np.fromfile(work / "idx.bin", dtype=np.uint32).reshape(f, 3)
    return pos, col, idx, n, f


def physical_scales() -> np.ndarray:
    meta = json.loads((ATLAS / "reference-series.json").read_text())
    rad = np.array(
        [fr["displayTransform"]["radiusMmPerUnit"] for fr in meta["frames"]],
        dtype=np.float64,
    )
    if rad.shape != (16,):
        raise SystemExit("reference-series.json: expected 16 frames")
    return rad / rad.max()


def render_frames(pos, col, idx, n, f, scales, width, height):
    """Orthographic lateral render of each week, greyscale + alpha."""
    ren = vtk.vtkRenderer()
    ren.SetBackground(0, 0, 0)
    rw = vtk.vtkRenderWindow()
    rw.SetOffScreenRendering(1)
    rw.AddRenderer(ren)
    rw.SetSize(width, height)
    rw.SetMultiSamples(8)
    rw.SetAlphaBitPlanes(1)

    cam = ren.GetActiveCamera()
    cam.ParallelProjectionOn()
    # x=Right, y=Superior, z=Anterior -> camera on +X is a right-lateral view.
    cam.SetPosition(3, 0, 0)
    cam.SetFocalPoint(0, 0, 0)
    cam.SetViewUp(0, 1, 0)

    # Fit every week in one fixed frame: the camera must not move between
    # cells or the brain would appear to drift rather than grow.
    big = pos[-1] * scales[-1]
    half_v = np.abs(big[:, 1]).max()
    half_h = np.abs(big[:, 2]).max()
    cam.SetParallelScale(max(half_v, half_h * height / width) * 1.06)

    light = vtk.vtkLight()
    light.SetLightTypeToCameraLight()
    light.SetPosition(-0.4, 0.7, 1.0)
    light.SetIntensity(1.0)
    ren.AddLight(light)

    cells = vtk.vtkCellArray()
    ca = np.empty((f, 4), dtype=np.int64)
    ca[:, 0] = 3
    ca[:, 1:] = idx
    cells.SetCells(f, ns.numpy_to_vtkIdTypeArray(ca.ravel(), deep=1))

    lut = vtk.vtkLookupTable()
    lut.SetNumberOfTableValues(256)
    for i in range(256):
        v = i / 255.0
        lut.SetTableValue(i, v, v, v, 1.0)
    lut.SetRange(CURV_LO, CURV_HI)
    lut.Build()

    frames = []
    for w in range(16):
        p = np.ascontiguousarray(pos[w] * scales[w], dtype=np.float32)
        pts = vtk.vtkPoints()
        pts.SetData(ns.numpy_to_vtk(p, deep=1))
        pd = vtk.vtkPolyData()
        pd.SetPoints(pts)
        pd.SetPolys(cells)
        s = ns.numpy_to_vtk(col[w].astype(np.float32), deep=1)
        s.SetName("curv")
        pd.GetPointData().SetScalars(s)

        nf = vtk.vtkPolyDataNormals()
        nf.SetInputData(pd)
        nf.SplittingOff()
        nf.ConsistencyOn()
        nf.AutoOrientNormalsOn()
        nf.ComputePointNormalsOn()
        nf.Update()

        mp = vtk.vtkPolyDataMapper()
        mp.SetInputData(nf.GetOutput())
        mp.SetLookupTable(lut)
        mp.SetScalarRange(CURV_LO, CURV_HI)
        mp.ScalarVisibilityOn()

        actor = vtk.vtkActor()
        actor.SetMapper(mp)
        pr = actor.GetProperty()
        pr.SetAmbient(0.32)
        pr.SetDiffuse(0.72)
        pr.SetSpecular(0.10)
        pr.SetSpecularPower(18)

        ren.RemoveAllViewProps()
        ren.AddActor(actor)
        rw.Render()

        wif = vtk.vtkWindowToImageFilter()
        wif.SetInput(rw)
        wif.SetInputBufferTypeToRGBA()
        wif.ReadFrontBufferOff()
        wif.Update()
        img = wif.GetOutput()
        d = img.GetDimensions()
        arr = ns.vtk_to_numpy(img.GetPointData().GetScalars()).reshape(d[1], d[0], 4)[::-1]
        frames.append(arr.astype(np.float32))
    return frames


def to_masks(frames, pad=6):
    """Tight-crop to the union silhouette, then convert shading -> alpha."""
    x0, y0, x1, y1 = 10**9, 10**9, -1, -1
    for a in frames:
        ys, xs = np.where(a[..., 3] > 8)
        x0, x1 = min(x0, xs.min()), max(x1, xs.max())
        y0, y1 = min(y0, ys.min()), max(y1, ys.max())
    h, w = frames[0].shape[:2]
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(w, x1 + pad), min(h, y1 + pad)

    masks = []
    for a in frames:
        c = a[y0:y1, x0:x1]
        cov = c[..., 3] / 255.0
        shade = c[..., 0] / 255.0
        m = cov * (ALPHA_FLOOR + (1.0 - ALPHA_FLOOR) * (1.0 - shade))
        masks.append(np.clip(m, 0.0, 1.0))
    return masks, (x1 - x0, y1 - y0)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("work", type=Path)
    ap.add_argument("--cell", type=int, default=440, help="sprite cell width in px")
    ap.add_argument("--render", default="1200x850")
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--out", type=Path, default=REPO / "assets" / "atlas" / "atlas-fold.webp")
    ap.add_argument("--probe", action="store_true", help="also dump per-week PNGs")
    args = ap.parse_args()

    rw_, rh_ = (int(v) for v in args.render.lower().split("x"))
    t0 = time.time()
    pos, col, idx, n, f = load(args.work)
    scales = physical_scales()
    frames = render_frames(pos, col, idx, n, f, scales, rw_, rh_)
    masks, (uw, uh) = to_masks(frames)
    print(f"rendered 16 @ {rw_}x{rh_}, union bbox {uw}x{uh} (aspect {uw/uh:.4f}) "
          f"in {time.time()-t0:.1f}s")

    cw = args.cell
    ch = max(1, int(round(cw * uh / uw)))
    plane = Image.new("L", (cw * 4, ch * 4), 0)
    for i, m in enumerate(masks):
        cell = Image.fromarray((m * 255).astype(np.uint8), "L").resize((cw, ch), Image.LANCZOS)
        plane.paste(cell, ((i % 4) * cw, (i // 4) * ch))
        if args.probe:
            d = args.work / "probe"
            d.mkdir(exist_ok=True)
            cell.save(d / f"w{21+i}.png")

    # The mask is carried in LUMINANCE, not alpha, and styles.css pairs it with
    # `mask-mode: luminance` / `-webkit-mask-source-type: luminance`.
    #
    # WebP compresses alpha with a separate, near-lossless codec, so putting a
    # continuous-tone relief in the alpha channel costs ~6x: the same sheet
    # measured 379 KiB in alpha versus 65 KiB in luminance. Luminance also
    # means the file is a plain greyscale image that is inspectable in any
    # viewer. The `@supports` gate in styles.css means a browser that honours
    # neither property simply paints no backdrop rather than a solid block.
    sheet = Image.merge("RGB", (plane, plane, plane))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    if args.probe:
        sheet.save(args.work / "sheet.png")
    sheet.save(args.out, format="WEBP", quality=args.quality, method=6)
    size = args.out.stat().st_size
    print(f"cell {cw}x{ch}  sheet {cw*4}x{ch*4}  q{args.quality}  -> {args.out} "
          f"({size} B / {size/1024:.1f} KiB)")
    print(f"CSS: aspect-ratio: {cw} / {ch};  mask-size: 400% 400%;")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
