"""Package the retained replay, with lossless mesh compression and source hashes.

No simulation, geometry, motor/contact policy or event-selection changes.
Run with Python's standard library from the repository root.
"""
from pathlib import Path
import gzip
import hashlib
import json
import re
import shutil

REPO = Path(__file__).resolve().parents[1]
SOURCE = Path(r'C:/Users/jason/Documents/ChatGPT/fly-perturbation-pilot/feeding-demo-2026-10-15')
BODY = REPO / 'demos/fly/body'
VENDOR = BODY.parent / 'vendor'
MESH = 'review-2026-10-17/motor-outputs/mesh-package-20261017T191357313556Z'
ADAPTER = 'review-2026-10-17/motor-outputs/transform-adapter'
COUPLING = 'review-2026-10-17/motor-outputs/native-coupling'
EVENTS = 'review-2026-10-17/motor-outputs/native-replay-20261017T191631933066Z/native-feeding-events.js'
BODY.mkdir(parents=True, exist_ok=True)
VENDOR.mkdir(parents=True, exist_ok=True)
(BODY / 'licenses').mkdir(exist_ok=True)
files = []

def digest(b):
    return hashlib.sha256(b).hexdigest()

def record(target, source, preserved=False, transform=None):
    b = target.read_bytes()
    item = {'file': target.relative_to(BODY).as_posix() if target.is_relative_to(BODY) else '../vendor/' + target.name,
            'source': source, 'bytes': len(b), 'sha256': digest(b), 'preserved': preserved}
    if transform:
        item['transform'] = transform
    files.append(item)

def copy(source, dest):
    target = BODY / dest
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE / source, target)
    record(target, source, True)

for name in ['native-app.js', 'style.css', 'native-style.css', 'event-time.js', 'sensory-cues.js', 'droplet-callout.js', 'motor-navigation.js']:
    copy(name, name)
for name in ['native-body-rig.js', 'packed-mesh-loader.js']:
    copy(ADAPTER + '/' + name, name)
for name in ['native-policy.js', 'native-motor-replay.js', 'geometric-contact.js']:
    copy(COUPLING + '/' + name, name)
copy(EVENTS, 'native-feeding-events.js')
copy(MESH + '/LICENSE', 'licenses/FlyBody-APACHE-2.0.txt')
shutil.copyfile(REPO / 'licenses/fly-model-MIT.txt', BODY / 'licenses/fly-model-MIT.txt')
record(BODY / 'licenses/fly-model-MIT.txt', 'published Drosophila brain model MIT license', False)
for name in ['three.min.js', 'THREE-LICENSE.txt']:
    shutil.copyfile(SOURCE / 'vendor' / name, VENDOR / name)
    record(VENDOR / name, 'vendor/' + name, True)

raw = (SOURCE / MESH / 'meshes.bin').read_bytes()
assert digest(raw) == '7082f88db83d93799aff4fc932366c0d4eebe3d7288f883ac743aeadaac094cb'
compressed = gzip.compress(raw, compresslevel=9, mtime=0)
(BODY / 'meshes.bin.gz').write_bytes(compressed)
record(BODY / 'meshes.bin.gz', MESH + '/meshes.bin', False, 'Lossless gzip; decoded source SHA-256 in geometry_decoded_sha256.')
asset_text = (SOURCE / MESH / 'native-flybody-asset.js').read_text(encoding='utf-8')
asset = json.loads(asset_text[asset_text.index('{'):].rstrip(';\r\n '))
metadata = {key: value for key, value in asset.items() if key != 'base64'}
(BODY / 'asset-metadata.json').write_text(json.dumps(metadata, separators=(',', ':')), encoding='utf-8')
record(BODY / 'asset-metadata.json', MESH + '/native-flybody-asset.js', False, 'Retain every non-base64 JSON property; geometry transported separately as gzip.')

shared = (SOURCE / 'shared-packed-body-rig.js').read_text(encoding='utf-8')
shared = shared.replace("require('./review-2026-10-17/motor-outputs/transform-adapter/native-body-rig.js')", "require('./native-body-rig.js')")
shared = shared.replace("require('./review-2026-10-17/motor-outputs/transform-adapter/packed-mesh-loader.js')", "require('./packed-mesh-loader.js')")
shared = shared.replace('let encoded=asset.base64,geometries=null', 'let encoded=asset.base64,packed=asset.buffer,geometries=null')
shared = shared.replace('released=true;encoded=null;', 'released=true;encoded=null;packed=null;')
shared = shared.replace('geometries=loader.decode(THREE,bytes(encoded),manifest);\n    encoded=null;', 'geometries=loader.decode(THREE,packed || bytes(encoded),manifest);\n    encoded=null;packed=null;')
shared = shared.replace('dispose(){closed=true;encoded=null;release();}', 'dispose(){closed=true;encoded=null;packed=null;release();}')
(BODY / 'shared-packed-body-rig.js').write_text(shared, encoding='utf-8')
record(BODY / 'shared-packed-body-rig.js', 'shared-packed-body-rig.js', False, 'Relative CommonJS paths; accept already-decoded exact ArrayBuffer, release reference after mesh decode.')

html = (SOURCE / 'index.html').read_text(encoding='utf-8')
html = re.sub(r'<header class="masthead">.*?</header>', '', html, flags=re.S)
html = re.sub(r'<nav class="view-navigation".*?</nav>', '', html, flags=re.S)
html = html.replace('<title>Fly feeding · neural replay</title>', '<title>Fly body · saved motor replay</title>')
html = html.replace('<link rel="stylesheet" href="native-style.css">', '<link rel="stylesheet" href="native-style.css"><link rel="stylesheet" href="embed.css">')
html = html.replace('<body><main>', '<body><main><p class="archive-boundary"><strong>Body illustration.</strong> This separate author archive is not the paired Roundup experiment. Saved motor spikes drive an assumed, uncalibrated movement mapping.</p><p id="load-status" role="status">Loading the fly geometry…</p>')
html = html.replace(' <section class="sensory-flow"', ' <details class="signal-detail"><summary>Follow sensory input and motor activity</summary><section class="sensory-flow"')
html = html.replace(' </section>\n <div id="scene-error"', ' </section></details>\n <div id="scene-error"')
html = html.replace(' <section class="signal">', ' <details class="signal-detail"><summary>Inspect exact saved motor spikes</summary><section class="signal">')
html = html.replace('</span></div></section>\n</section>', '</span></div></section></details>\n</section>')
html = html.replace('<a href="sensitivity.html">Explore exact input events and connection weights in the paired test.</a>', 'The paired experiment above uses a separate dataset.')
start = html.index('<section class="notes" id="methods">')
end = html.index('</main>', start)
notes = '''<details class="body-methods" id="methods"><summary>Sources, movement assumptions and reuse terms</summary>
<p>The <a target="_blank" rel="noopener" href="https://www.nature.com/articles/s41586-024-07763-9">Shiu et al. (2024)</a> author simulation archive supplies sugar (100 Hz) or water (200 Hz), three circuit conditions and 30 repeats per case. MN9 and MN6 come from the same saved file and trial. Matching repeat numbers across conditions do not establish paired inputs.</p>
<p>MN9 is mapped to the main reach and head coupling; left and right MN6 signals drive the respective distal source joints. The source calls those parts <code>labrum_left</code> and <code>labrum_right</code>; their correspondence to feeding anatomy remains unqualified. No movement parameters were fitted to animal videos. The neural interval is 0–1 s, followed by assumed actuator relaxation.</p>
<p>Geometric mouth–droplet contact gates an illustrative volume change. This is not fluid physics, pumping, swallowing or a closed sensory loop. The body is not registered to the FlyWire neuron coordinates shown in the anatomy view.</p>
<p><a target="_blank" rel="noopener" href="https://github.com/TuragaLab/flybody/tree/d015e9bfe441bd90ae431bac24c55cb74bdbce26">FlyBody geometry</a> is redistributed under <a href="licenses/FlyBody-APACHE-2.0.txt">Apache 2.0</a>; <a href="../vendor/THREE-LICENSE.txt">Three.js</a> and the <a href="licenses/fly-model-MIT.txt">source neural model</a> retain their MIT licenses. Geometry is losslessly gzip-compressed; motor events and motor/contact policies are unchanged. <a href="provenance.json">Package provenance</a>.</p></details>
<footer>Source anatomy: FlyBody · source neural archive: Shiu et al. · body mapping and contact: illustrative</footer>'''
html = html[:start] + notes + html[end:]
script_start = html.index('<script src="vendor/three.min.js">')
html = html[:script_start] + '''<script src="../vendor/three.min.js"></script>
<script src="native-feeding-events.js"></script>
<script src="native-body-rig.js"></script>
<script src="packed-mesh-loader.js"></script>
<script src="native-policy.js"></script>
<script src="native-motor-replay.js"></script>
<script src="geometric-contact.js"></script>
<script src="shared-packed-body-rig.js"></script>
<script src="event-time.js"></script>
<script src="sensory-cues.js"></script>
<script src="droplet-callout.js"></script>
<script src="motor-navigation.js"></script>
<script src="boot.js"></script>
</body></html>'''
(BODY / 'index.html').write_text(html, encoding='utf-8')
record(BODY / 'index.html', 'index.html', False, 'Standalone body embed; remove external local navigation; collapse supporting traces; replace stale methods with explicit current boundaries.')

for name in ['boot.js', 'embed.css']:
    if (BODY / name).exists():
        record(BODY / name, 'new portfolio packaging', False)

manifest = {
    'format': 'fly-body-portfolio-package-v1',
    'entry': 'index.html',
    'original_source_root': 'fly-perturbation-pilot/feeding-demo-2026-10-15/',
    'source_geometry_repository': 'https://github.com/TuragaLab/flybody',
    'source_geometry_commit': 'd015e9bfe441bd90ae431bac24c55cb74bdbce26',
    'source_model_repository': 'https://github.com/philshiu/Drosophila_brain_model',
    'source_model_commit': '91bdd1e7dcf193f3e7ca5a8933497fcef63b7960',
    'three_version': '0.160.0',
    'geometry_decoded_bytes': len(raw),
    'geometry_decoded_sha256': digest(raw),
    'geometry_compressed_bytes': len(compressed),
    'geometry_compressed_sha256': digest(compressed),
    'geometry_transform': 'Lossless gzip only; no changed mesh values or source transforms.',
    'neural_data': 'Separate retained author simulation archive; not the paired gain/input experiment.',
    'movement': 'Uncalibrated illustrative mapping; no animal-motion fit, fluid physics, swallowing or sensory feedback.',
    'files': files,
}
(BODY / 'provenance.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'runtime_files': len(files), 'bytes_including_shared_vendor': sum(i['bytes'] for i in files), 'gzip_bytes': len(compressed)}))
