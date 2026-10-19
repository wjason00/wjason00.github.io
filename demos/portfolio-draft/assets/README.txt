Portfolio design draft assets
=============================

Caveat handwriting font
-----------------------
File: caveat-latin.woff2
Family: Caveat, normal style, variable weight 400-700; Latin subset.
Copyright 2014 The Caveat Project Authors
https://github.com/googlefonts/caveat

Official Google Fonts family source:
https://github.com/google/fonts/tree/main/ofl/caveat

Official stylesheet used to obtain the self-hosted Latin font:
https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap

Actual unmodified WOFF2 download:
https://fonts.gstatic.com/s/caveat/v23/Wnz6HAc5bAfYB2Q7ZjYY.woff2

The complete SIL Open Font License 1.1 and copyright are retained in OFL.txt,
downloaded from the official source:
https://raw.githubusercontent.com/google/fonts/main/ofl/caveat/OFL.txt

Font SHA-256:
891951df5e8b5b0f0bc760d31375405e795c666b5add70437de12d4a6482b33f

Fly specimen still
-----------------
File: fly-specimen.png
Dimensions: 1500 x 1000 pixels, transparent PNG.

Rendered from the existing verified FlyBody source geometry and source rig
under demos/fly/body/. The source is TuragaLab/flybody at commit
d015e9bfe441bd90ae431bac24c55cb74bdbce26, Apache License 2.0.
Source and processing attribution: ../../fly/body/provenance.json
Full licence: ../../fly/body/licenses/FlyBody-APACHE-2.0.txt

The source rig is cloned at its initial neutral pose. Source vertices,
hierarchy, transforms and materials are retained. The still contains no
droplet, labels, neural output or assumed movement mapping.

An orthographic camera frames the neutral source bounds with 4% margin.
It looks at the bound centre from direction (0.28, 0.9, 0.34), normalised,
at a distance of three times the bound diagonal. Camera up is (0, 0, 1).
The calculated camera position is approximately
(5.502705, 19.040231, 6.802027) in source millimetres.
Lighting and tone mapping match the existing replay's presentation:
hemisphere light plus key and rim lights, ACES filmic tone mapping,
exposure 1.2. The canvas has a transparent background.

This asset is decorative source anatomy for the portfolio design draft,
not a scientific figure, anatomical registration or new simulation.
Ghost opacity, greyscale and brightness are CSS presentation styling.

The other project previews reuse existing files under assets/portfolio/.
Source Sans 3 and Spectral reuse the existing self-hosted font files.
See the portfolio's third-party-notices.html and complete licence notices.

Matching ghost fallback
-----------------------
File: fly-ghost.png, 1500 x 1000 pixels, transparent RGBA PNG.
This is a static frame of the exact ghost-fly.js renderer at progress 0.45,
using its silver materials, projected source-bounds camera fit and neutral
source rig. It keeps the same presentation during model download or when
WebGL is unavailable. All FlyBody terms and source boundaries above apply.
SHA-256: 58f9c5e55f6e563d52f7fd6e2cb98937b465c5cc5f6d290fd45909e9fc7f3ad2
