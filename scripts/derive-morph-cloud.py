"""Sample saved production surfaces for a local interactive figure; no morph run."""
import base64
import hashlib
import json
import math
import struct
import sys
import zlib
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
RUN = ROOT / 'output/recapture-20261030/run-20261030T110747527271Z-production'
CAPTURE = ROOT / 'assets/portfolio/model-morpher-capture.json'
OUT = ROOT / 'assets/model-morpher'
SAMPLES = 2048
sha = lambda data: hashlib.sha256(data).hexdigest()


def read_points(path):
    raw = path.read_bytes()
    root = ET.fromstring(raw)
    if root.get('byte_order') != 'LittleEndian' or root.get('header_type') != 'UInt32':
        raise ValueError('Unexpected VTP byte/header encoding')
    if root.get('compressor') != 'vtkZLibDataCompressor':
        raise ValueError('Unexpected VTP compressor')
    piece = root.find('./PolyData/Piece')
    node = piece.find('./Points/DataArray')
    if node.get('type') != 'Float32' or node.get('NumberOfComponents') != '3':
        raise ValueError('Unexpected point type')
    # InformationKey children contain numeric range metadata, not point bytes.
    encoded = ''.join((node.text or '').split())
    blocks = struct.unpack('<I', base64.b64decode(encoded[:8])[:4])[0]
    header_bytes = 4 * (3 + blocks)
    header_chars = 4 * math.ceil(header_bytes / 3)
    header = struct.unpack('<' + 'I' * (3 + blocks), base64.b64decode(encoded[:header_chars]))
    compressed = base64.b64decode(encoded[header_chars:])
    chunks, offset = [], 0
    for size in header[3:]:
        chunks.append(zlib.decompress(compressed[offset:offset + size]))
        offset += size
    if offset != len(compressed):
        raise ValueError('Compressed point bytes were not consumed exactly')
    payload = b''.join(chunks)
    count = int(piece.get('NumberOfPoints'))
    if len(payload) != count * 12:
        raise ValueError('Decoded point count mismatch')
    return raw, count, list(struct.iter_unpack('<fff', payload))


def main():
    manifest_bytes = (RUN / 'manifest.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    capture = json.loads(CAPTURE.read_text(encoding='utf-8'))
    if sha(manifest_bytes) != capture['sourceCaptureManifestSha256']:
        raise ValueError('Source capture manifest does not match public provenance')
    if manifest['actual_returned_count'] != 30 or len(manifest['frames']) != 30:
        raise ValueError('All thirty actual surfaces are required')
    fit = capture['render']['framing']
    basis = [fit['camera_right'], fit['camera_screen_up'], fit['camera_outward_direction']]
    mins, maxs = fit['projected_union_min_uv_depth'], fit['projected_union_max_uv_depth']
    centre = [(lo + hi) / 2 for lo, hi in zip(mins, maxs)]
    scale = max(hi - lo for lo, hi in zip(mins, maxs)) / 2
    actual_min = [math.inf] * 3
    actual_max = [-math.inf] * 3
    packed, records = [], []
    radius = 0.0
    for i, frame in enumerate(manifest['frames']):
        if frame['returned_index'] != i or frame['requested_index'] != i:
            raise ValueError('Requested/returned frame mapping changed')
        if abs(frame['interpolation_t'] - i / 29) > 1e-12:
            raise ValueError('Unexpected morph parameter')
        path = RUN / Path(frame['path'].replace('\\', '/'))
        raw, count, points = read_points(path)
        if sha(raw) != frame['sha256'] or count != frame['points']:
            raise ValueError('Saved source surface hash/count changed')
        # Verify the shared approved display bounds from ALL original vertices.
        for point in points:
            for axis, vector in enumerate(basis):
                value = sum(a * b for a, b in zip(point, vector))
                actual_min[axis] = min(actual_min[axis], value)
                actual_max[axis] = max(actual_max[axis], value)
        for n in range(SAMPLES):
            source_index = math.floor(n * (count - 1) / (SAMPLES - 1))
            point = points[source_index]
            display = [(sum(a * b for a, b in zip(point, vector)) - centre[axis]) / scale
                       for axis, vector in enumerate(basis)]
            radius = max(radius, math.sqrt(sum(v * v for v in display)))
            if any(not math.isfinite(v) or abs(v) > 1.000001 for v in display):
                raise ValueError('Display coordinate outside verified shared fit')
            packed.extend(round(max(-1, min(1, v)) * 32767) for v in display)
        records.append({'index': i, 't': i / 29, 'sourcePoints': count,
                        'sourceMeshSha256': frame['sha256']})
    if any(abs(a - b) > 1e-8 for a, b in zip(actual_min + actual_max, mins + maxs)):
        raise ValueError('All-vertex bounds do not match approved shared camera')
    data = struct.pack('<' + 'h' * len(packed), *packed)
    metadata = {
        'title': 'Model Morpher saved-surface study', 'frameCount': 30,
        'pointsPerFrame': SAMPLES, 'sourceManifestSha256': sha(manifest_bytes),
        'sourceCapture': 'assets/portfolio/model-morpher-capture.json',
        'sourceRepository': capture['sourceRepository'], 'sourceCommit': capture['sourceCommit'],
        'atlas': capture['atlas'], 'inputs': capture['inputs'], 'frames': records,
        'sampling': 'Independent vertex index floor(i*(N-1)/(2048-1)) in each saved surface; not uniform area sampling',
        'encoding': 'Little-endian Int16 XYZ, normalized by 32767, frames contiguous',
        'encodedBytesSha256': sha(data), 'encodedBytes': len(data),
        'displayTransform': {'basis': basis, 'projectedCentre': centre, 'isotropicScale': scale,
                             'sharedAllFrames': True, 'anatomicalViewLabel': None},
        'maxSampleRadius': radius + math.sqrt(3) / 32767,
        'maximumCoordinateQuantizationError': 0.5 / 32767 + 2 ** -24,
        'errorUnits': 'Normalized display coordinates; bound includes Int16 rounding and Float32 decode, not millimetres',
        'limits': [
            'Thirty actual saved production surfaces; no new geometry or SDF computation.',
            'Surface topology and vertex counts change. Sample indices do not establish point correspondence.',
            'The viewer may opacity-crossfade adjacent saved point sets; this is display blending, not an extra computed surface or point trajectory.',
            'Geometric interpolation after independent centring/scaling of inputs; not anatomical correspondence, registration, growth or development.',
            'Native physical relative sizes and atlas coordinates are not retained; display orientation is numerical, not anatomically validated.',
        ],
        'reuseScope': 'User-authorised local prototype; original Allen/BrainGlobe source terms and citation apply; no CC0 claim and no publication authorised',
    }
    OUT.mkdir(exist_ok=True)
    module = ('// Generated by scripts/derive-morph-cloud.py from actual saved surfaces.\n'
              + 'export const metadata = Object.freeze(' + json.dumps(metadata, separators=(',', ':')) + ');\n'
              + "const encoded='" + base64.b64encode(data).decode('ascii') + "';\n"
              + 'const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));\n'
              + 'const integers=new Int16Array(bytes.buffer);\n'
              + 'export const positions=Float32Array.from(integers,v=>v/32767);\n'
              + 'export const frames=Array.from({length:metadata.frameCount},(_,i)=>positions.subarray(i*metadata.pointsPerFrame*3,(i+1)*metadata.pointsPerFrame*3));\n')
    (OUT / 'morph-cloud-data.js').write_text(module, encoding='utf-8')
    (OUT / 'morph-cloud-source.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'frames': 30, 'pointsPerFrame': SAMPLES, 'packedBytes': len(data),
                      'moduleBytes': len(module.encode()), 'sourceBoundsMatch': True,
                      'sourceManifestSha256': metadata['sourceManifestSha256']}))


if __name__ == '__main__':
    main()
