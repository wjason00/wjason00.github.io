"""Export exact materialization-630 FlyWire skeletons for the existing graph.

Independent parser for the documented Neuroglancer skeleton binary format.
No fafbseg code is copied. Identity source transform and nm units are documented
by fafbseg's official get_skeletons implementation. No IDs are remapped.
"""
import argparse
import concurrent.futures
import hashlib
import json
import math
from pathlib import Path
import struct
import urllib.error
import urllib.request

BASE = "https://flyem.mrc-lmb.cam.ac.uk/flyconnectome/flywire_skeletons_630"
DOCS = "https://fafbseg-py.readthedocs.io/en/latest/_modules/fafbseg/flywire/skeletonize.html#get_skeletons"


def parse_precomputed(data):
    if len(data) < 8:
        raise ValueError("Truncated skeleton header")
    n, m = struct.unpack_from("<II", data)
    expected = 8 + n * 12 + m * 8 + n * 4
    if len(data) != expected:
        raise ValueError(f"Expected {expected} skeleton bytes, got {len(data)}")
    positions = [list(v) for v in struct.iter_unpack("<fff", data[8:8 + n * 12])]
    edges = [list(e) for e in struct.iter_unpack("<II", data[8 + n * 12:8 + n * 12 + m * 8])]
    radii = list(struct.unpack_from(f"<{n}f", data, 8 + n * 12 + m * 8))
    if any(not all(math.isfinite(v) for v in p) for p in positions):
        raise ValueError("Nonfinite source coordinates")
    if any(a >= n or b >= n or a == b for a, b in edges):
        raise ValueError("Invalid source edge index")
    return {"positions": positions, "edges": edges, "radii": radii}


def point_segment_distance(point, start, end):
    delta = [end[i] - start[i] for i in range(3)]
    norm = sum(v * v for v in delta)
    t = max(0, min(1, sum((point[i] - start[i]) * delta[i] for i in range(3)) / norm)) if norm else 0
    return math.sqrt(sum((point[i] - start[i] - t * delta[i]) ** 2 for i in range(3)))


def simplify_skeleton(positions, edges, tolerance_nm=500):
    """RDP on degree-2 chains; every branch/end and disconnected component kept."""
    adjacency = [[] for _ in positions]
    for a, b in edges:
        adjacency[a].append(b)
        adjacency[b].append(a)
    anchors = {i for i, a in enumerate(adjacency) if len(a) != 2}
    visited = set()
    chains = []
    # Deal with trees/forests first, then any closed cycle without an anchor.
    for start in list(sorted(anchors)) + list(range(len(positions))):
        for first in adjacency[start]:
            edge = tuple(sorted((start, first)))
            if edge in visited:
                continue
            chain = [start, first]
            visited.add(edge)
            prev, current = start, first
            while current not in anchors and current != start:
                choices = [v for v in adjacency[current] if v != prev]
                if not choices:
                    break
                following = choices[0]
                key = tuple(sorted((current, following)))
                if key in visited:
                    break
                visited.add(key)
                chain.append(following)
                prev, current = current, following
            chains.append(chain)
    kept = set(anchors)
    simplified_edges = []
    max_deviation = 0.0
    for chain in chains:
        local = {0, len(chain) - 1}
        stack = [(0, len(chain) - 1)]
        while stack:
            left, right = stack.pop()
            if right <= left + 1:
                continue
            distances = [(point_segment_distance(positions[chain[i]], positions[chain[left]], positions[chain[right]]), i) for i in range(left + 1, right)]
            deviation, index = max(distances)
            if deviation > tolerance_nm:
                local.add(index)
                stack.extend([(left, index), (index, right)])
        local = sorted(local)
        kept.update(chain[i] for i in local)
        for a, b in zip(local, local[1:]):
            simplified_edges.append([chain[a], chain[b]])
            for i in range(a, b + 1):
                max_deviation = max(max_deviation, point_segment_distance(positions[chain[i]], positions[chain[a]], positions[chain[b]]))
    indices = sorted(kept)
    mapping = {old: new for new, old in enumerate(indices)}
    return {
        "positions": [positions[i] for i in indices],
        "edges": [[mapping[a], mapping[b]] for a, b in simplified_edges],
        "sourceVertexIndices": indices,
        "maxDeviationNm": max_deviation,
    }


def download(root_id, raw):
    path = raw / f"{root_id}.bin"
    url = f"{BASE}/{root_id}"
    if not path.exists():
        try:
            with urllib.request.urlopen(url, timeout=40) as response:
                path.write_bytes(response.read())
        except urllib.error.HTTPError as exc:
            return root_id, {"url": url, "missing": True, "httpStatus": exc.code}
    data = path.read_bytes()
    parsed = parse_precomputed(data)
    simplified = simplify_skeleton(parsed["positions"], parsed["edges"])
    # Source positions are kept in their common frame, rounded only to 1 nm.
    positions = [[round(v) for v in p] for p in simplified["positions"]]
    neuron = {"id": root_id, "positions": [v for p in positions for v in p], "edges": [v for e in simplified["edges"] for v in e]}
    receipt = {
        "url": url, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data),
        "sourceVertices": len(parsed["positions"]), "sourceEdges": len(parsed["edges"]),
        "displayVertices": len(positions), "displayEdges": len(simplified["edges"]),
        "maxSimplificationDeviationNm": round(simplified["maxDeviationNm"], 6),
    }
    return neuron, receipt


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).parents[1]
    graph = json.loads((root / "demos/fly/network-data.json").read_text())
    nodes = graph["nodes"]
    args.raw_dir.mkdir(parents=True, exist_ok=True)
    metadata_url = BASE + "/info"
    with urllib.request.urlopen(metadata_url, timeout=30) as response:
        metadata = response.read()
    info = json.loads(metadata)
    if info.get("transform") != [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]:
        raise ValueError("Expected documented identity transform")
    neurons, receipts, missing = [], {}, []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for neuron, receipt in pool.map(lambda node: download(str(node["id"]), args.raw_dir), nodes):
            if receipt.get("missing"):
                missing.append(neuron)
                receipts[neuron] = receipt
            else:
                neuron["label"] = next(n["label"] for n in nodes if str(n["id"]) == neuron["id"])
                neurons.append(neuron)
                receipts[neuron["id"]] = receipt
    data = {
        "schema": 1, "materialization": 630, "units": "nm", "frame": "FlyWire source coordinates (identity transform)",
        "transform": info["transform"], "simplificationToleranceNm": 500, "coordinateRoundingNm": 1,
        "neurons": neurons, "missingIds": missing,
    }
    destination = root / "demos/fly/morphology-data.json"
    destination.write_text(json.dumps(data, separators=(",", ":")) + "\n", encoding="utf-8")
    provenance = {
        "schema": 1, "source": "FlyWire public materialization 630 precomputed proofread neuron skeletons",
        "sourceDocs": DOCS, "sourceBase": BASE, "metadataUrl": metadata_url,
        "metadataSha256": hashlib.sha256(metadata).hexdigest(), "metadata": info,
        "idPolicy": "Exact string IDs from network-data.json; materialization-630 endpoint only; no ID substitution or remapping.",
        "units": "nm", "coordinateFrame": "Common source coordinates; identity transform; no independent alignment to the body model.",
        "display": "Degree-2-chain Ramer-Douglas-Peucker simplification, maximum 500 nm deviation. Branch points/endpoints retained. Coordinates rounded to nearest 1 nm (additional <=0.867 nm Euclidean error). Line widths are display styling, not neurite diameter. Source radii not displayed.",
        "licence": "CC BY-NC 4.0", "licenceUrl": "https://edit.flywire.ai/principles.html",
        "attribution": "FlyWire Consortium / Schlegel et al., 2024, Nature; Dorkenwald et al., 2024, Nature. Precomputed skeletons hosted by MRC LMB, accessed via the dataset-630 endpoint documented by fafbseg.",
        "dataSha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "requestedIds": [str(n["id"]) for n in nodes], "missingIds": missing, "receipts": receipts,
    }
    (root / "demos/fly/morphology-provenance.json").write_text(json.dumps(provenance, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"neurons": len(neurons), "missingIds": missing, "bytes": destination.stat().st_size, "sourceBytes": sum(r.get("bytes", 0) for r in receipts.values()), "sourceVertices": sum(r.get("sourceVertices", 0) for r in receipts.values()), "displayVertices": sum(r.get("displayVertices", 0) for r in receipts.values())}))


if __name__ == "__main__":
    main()
