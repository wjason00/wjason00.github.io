#!/usr/bin/env python
"""Bounded, opt-in capture of the unchanged Model Morpher CUDA pipeline.

Default: stdlib-only preflight; never imports Torch or performs a capture.
--run: supervisor starts its own worker under a Windows kill-on-close job.
--render-from RUN_DIR: render hash-checked saved VTPs without Torch/morph imports.
--mode reduced-64x20 is an explicit lower-quality alternative, never automatic.
"""
from __future__ import annotations

import argparse
import ast
import csv
import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import sysconfig
import time
import traceback

EXPECTED_HEAD = "f14ee067ae183318c033a88ad313b0e36b03d445"
DEFAULT_SOURCE = Path(r"C:\Users\jason\Desktop\MM")
DEFAULT_ATLAS = Path(r"C:\Users\jason\.brainglobe\allen_mouse_25um_v1.2")
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "output" / "recapture-20261030"
GIB = 1024 ** 3
MIN_FREE = 4 * GIB
THREAD_ENV = ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS",
              "NUMEXPR_NUM_THREADS", "VTK_SMP_MAX_THREADS", "ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS")
LIMITATIONS = [
    "A geometric SDF interpolation demonstration, not anatomical correspondence, registration, growth or development.",
    "Original cleaning/repair, centring and diagonal scale matching are applied. Native atlas coordinates and physical relative sizes are not retained.",
    "Atlas metadata says ASR, 25 micrometres, version 1.2. Camera is a fixed numerical view; anatomical orientation has not been independently validated.",
    "Topology, connectivity, normals and shape may change through the original extraction/postprocessing. Successful output does not validate anatomy.",
    "Original production code filters failed extractions. Requested interpolation indices are only recoverable from its returned list when all requested frames return.",
    "Production CUDA code contains an existing CPU marching-cubes fallback. This harness does not replace, disable or claim to exclude that original behavior; there is no alternative CPU morphing algorithm.",
    "Endpoint pauses are video repetitions only. There are no invented intermediate meshes, temporal interpolation or inferred anatomical pairings.",
]


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def command(args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True, encoding="utf-8", errors="replace", timeout=20).strip()


def windows_memory():
    if os.name != "nt":
        raise RuntimeError("This capture harness requires Windows resource guards.")
    class PerformanceInfo(ctypes.Structure):
        _fields_ = [("cb", wintypes.DWORD)] + [(name, ctypes.c_size_t) for name in (
            "CommitTotal", "CommitLimit", "CommitPeak", "PhysicalTotal", "PhysicalAvailable",
            "SystemCache", "KernelTotal", "KernelPaged", "KernelNonpaged", "PageSize"
        )] + [(name, wintypes.DWORD) for name in ("HandleCount", "ProcessCount", "ThreadCount")]
    info = PerformanceInfo()
    info.cb = ctypes.sizeof(info)
    if not ctypes.windll.psapi.GetPerformanceInfo(ctypes.byref(info), info.cb):
        raise ctypes.WinError()
    return {
        "available_commit_bytes": (info.CommitLimit - info.CommitTotal) * info.PageSize,
        "commit_total_bytes": info.CommitTotal * info.PageSize,
        "commit_limit_bytes": info.CommitLimit * info.PageSize,
        "physical_available_bytes": info.PhysicalAvailable * info.PageSize,
        "required_available_commit_bytes": MIN_FREE,
    }


def gpu_memory():
    executable = shutil.which("nvidia-smi")
    if not executable:
        raise RuntimeError("nvidia-smi is required before any heavy imports.")
    rows = command([executable, "--query-gpu=index,name,memory.free,memory.total", "--format=csv,noheader,nounits"])
    devices = []
    for row in csv.reader(rows.splitlines()):
        devices.append({"index": int(row[0]), "name": row[1].strip(),
                        "free_bytes": int(row[2]) * 1024 ** 2, "total_bytes": int(row[3]) * 1024 ** 2})
    if not devices:
        raise RuntimeError("No NVIDIA GPU found.")
    return devices


def find_ffmpeg():
    candidates = [shutil.which("ffmpeg"), str(Path(sys.prefix) / "Library/bin/ffmpeg.exe"),
                  str(Path(sys.prefix) / "Scripts/ffmpeg.exe")]
    candidates.extend(str(p) for p in (Path(sysconfig.get_path("purelib")) / "imageio_ffmpeg/binaries").glob("ffmpeg*.exe"))
    return next((str(Path(p).resolve()) for p in candidates if p and Path(p).is_file()), None)


def parsed_config(source):
    values = {}
    for node in ast.parse((source / "config.py").read_text(encoding="utf-8")).body:
        if isinstance(node, ast.Assign):
            try:
                value = ast.literal_eval(node.value)
            except (ValueError, TypeError):
                continue
            for target in node.targets:
                if isinstance(target, ast.Name):
                    values[target.id] = value
    return values


def preflight(args):
    report = {"created_utc": utc_now(), "status": "blocked", "capture_performed": False,
              "heavy_imports_attempted": False, "heavy_imports_completed": False,
              "heavy_imports_performed": False, "interpreter": sys.executable,
              "mode": args.mode, "max_seconds": args.max_seconds, "issues": [], "limitations": LIMITATIONS}
    try:
        report["memory"] = windows_memory()
        report["gpus"] = gpu_memory()
        gpu = next((g for g in report["gpus"] if g["index"] == args.gpu), None)
        if gpu is None:
            report["issues"].append(f"GPU index {args.gpu} unavailable")
        elif gpu["free_bytes"] < MIN_FREE:
            report["issues"].append("GPU free memory is below 4 GiB")
        if report["memory"]["available_commit_bytes"] < MIN_FREE:
            report["issues"].append("Windows available commit is below 4 GiB")
        report["source_root"] = str(args.source_root)
        report["source_head"] = command(["git", "rev-parse", "HEAD"], args.source_root)
        report["source_status_porcelain"] = command(["git", "status", "--porcelain"], args.source_root)
        if report["source_head"] != EXPECTED_HEAD or report["source_status_porcelain"]:
            report["issues"].append("Source must be clean at the pinned production commit")
        tracked = command(["git", "ls-files"], args.source_root).splitlines()
        report["source_sha256"] = {name: sha256(args.source_root / name) for name in tracked
                                    if name.endswith((".py", ".toml", ".yaml", ".yml", ".txt"))}
        report["harness_sha256"] = sha256(__file__)
        report["original_config"] = parsed_config(args.source_root)
        report["config"] = {"resolution": 128 if args.mode == "production" else 64,
                            "frames_per_transition": 30 if args.mode == "production" else 20,
                            "target_faces": 15000, "device": "cuda", "gpu_index": args.gpu,
                            "cpu_core_limit": 2, "cpu_thread_environment": 2, "fps": 12,
                            "endpoint_pause_seconds": 1.5, "window_size": [1440, 1080]}
        report["config_sha256"] = hashlib.sha256(json.dumps(report["config"], sort_keys=True,
            separators=(",", ":")).encode("utf-8")).hexdigest()
        report["cpu_limit_note"] = ("Two CPU cores via process affinity and two-thread native/Torch limits. "
            "The unchanged original extraction retains its default four Python postprocess workers; "
            "these can execute on at most the two assigned CPU cores.")
        metadata_path = args.atlas_root / "metadata.json"
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        report["atlas"] = {"root": str(args.atlas_root), "metadata": metadata,
                           "metadata_sha256": sha256(metadata_path),
                           "structures_csv_sha256": sha256(args.atlas_root / "structures.csv")}
        if metadata.get("version") != "1.2" or metadata.get("orientation") != "asr" or metadata.get("resolution") != [25, 25, 25]:
            report["issues"].append("Atlas metadata differs from expected v1.2 / 25um / ASR")
        with (args.atlas_root / "structures.csv").open(encoding="utf-8", newline="") as stream:
            labels = {row["id"]: row for row in csv.DictReader(stream) if row["id"] in ("726", "997")}
        report["inputs"] = [{"id": identity, "structure": labels[identity],
                            "path": str(args.atlas_root / "meshes" / f"{identity}.obj"),
                            "bytes": (args.atlas_root / "meshes" / f"{identity}.obj").stat().st_size,
                            "sha256": sha256(args.atlas_root / "meshes" / f"{identity}.obj")}
                           for identity in ("726", "997")]
        if labels["726"]["acronym"] != "DG" or labels["997"]["acronym"].lower() != "root":
            report["issues"].append("Atlas input IDs do not match DG and root")
        report["dependencies_present_without_import"] = {name: importlib.util.find_spec(name) is not None
            for name in ("torch", "numpy", "pyvista", "trimesh", "pytorch3d", "pytorch_volumetric")}
        if not all(report["dependencies_present_without_import"].values()):
            report["issues"].append("Required existing environment dependencies are missing; no installation attempted")
        report["ffmpeg"] = find_ffmpeg()
        if not report["ffmpeg"]:
            report["issues"].append("Existing ffmpeg executable not found; no download attempted")
    except Exception as exc:
        report["issues"].append(f"{type(exc).__name__}: {exc}")
    report["status"] = "ready" if not report["issues"] else "blocked"
    return report


def render_preflight(args):
    """Read-only verification of an existing returned sequence, using only stdlib."""
    report = {"created_utc": utc_now(), "status": "blocked", "render_only": True,
              "capture_performed": False, "heavy_imports_attempted": False,
              "heavy_imports_completed": False, "heavy_imports_performed": False,
              "torch_import_attempted": False, "interpreter": sys.executable,
              "max_seconds": args.max_seconds, "issues": [], "limitations": LIMITATIONS}
    try:
        report["memory"] = windows_memory()
        report["gpus"] = gpu_memory()
        gpu = next((g for g in report["gpus"] if g["index"] == args.gpu), None)
        if gpu is None or gpu["free_bytes"] < MIN_FREE:
            report["issues"].append("Selected GPU must have at least 4 GiB free")
        if report["memory"]["available_commit_bytes"] < MIN_FREE:
            report["issues"].append("Windows available commit is below 4 GiB")
        source_dir = args.render_from.resolve()
        manifest_path = source_dir / "manifest.json"
        source = json.loads(manifest_path.read_text(encoding="utf-8"))
        report["source_capture_run_dir"] = str(source_dir)
        report["source_capture_manifest_sha256"] = sha256(manifest_path)
        report["render_harness_sha256"] = sha256(__file__)
        report["mesh_hash_checks"] = []
        frames = source["frames"]
        if not frames or len(frames) != source["actual_returned_count"] or len(frames) != source["requested_count"]:
            raise RuntimeError("Saved sequence is incomplete; re-rendering refused")
        if not source.get("requested_index_mapping_available"):
            raise RuntimeError("Saved requested-index mapping is unavailable")
        for index, frame in enumerate(frames):
            path = (source_dir / frame["path"]).resolve()
            if not path.is_relative_to(source_dir) or path.suffix.lower() != ".vtp":
                raise RuntimeError("Saved mesh path must be a VTP inside the source run")
            actual_hash = sha256(path)
            passed = actual_hash == frame["sha256"] and frame["returned_index"] == index
            report["mesh_hash_checks"].append({"returned_index": index, "path": str(path),
                "expected_sha256": frame["sha256"], "actual_sha256": actual_hash, "passed": passed})
            if not passed:
                report["issues"].append(f"Saved mesh hash/order mismatch at returned index {index}")
        report["mode"] = source["mode"]
        report["ffmpeg"] = find_ffmpeg()
        if not report["ffmpeg"]:
            report["issues"].append("Existing ffmpeg executable not found")
        for name in ("numpy", "pyvista"):
            if importlib.util.find_spec(name) is None:
                report["issues"].append(f"Existing dependency missing: {name}")
    except Exception as exc:
        report["issues"].append(f"{type(exc).__name__}: {exc}")
    report["status"] = "ready" if not report["issues"] else "blocked"
    return report


def render_only_worker(args, check, run_dir):
    """Inherit the original scientific provenance; change presentation only."""
    source_dir = Path(check["source_capture_run_dir"])
    source_manifest = source_dir / "manifest.json"
    if sha256(source_manifest) != check["source_capture_manifest_sha256"]:
        raise RuntimeError("Source manifest changed after verification")
    report = json.loads(source_manifest.read_text(encoding="utf-8"))
    report.pop("artifacts", None)
    report.pop("render", None)
    report["source_frames"] = report["frames"]
    report["frames"] = [dict(frame, path=check["mesh_hash_checks"][index]["path"])
                        for index, frame in enumerate(report["source_frames"])]
    report.update({"status": "rendering-saved-meshes", "capture_performed": False,
        "render_only": True, "morph_recomputed": False, "geometry_edited_or_resampled": False,
        "render_preflight": check, "source_capture_run_dir": str(source_dir),
        "source_capture_manifest_sha256": check["source_capture_manifest_sha256"],
        "render_harness_sha256": sha256(__file__), "render_started_utc": utc_now(),
        "heavy_imports_attempted": False, "heavy_imports_performed": False,
        "heavy_imports_completed": False, "torch_import_attempted": False})
    manifest = run_dir / "manifest.json"
    try:
        report["affinity_mask"] = limit_worker_cpu()
        for name in THREAD_ENV:
            os.environ[name] = "2"
        os.environ["PYVISTA_OFF_SCREEN"] = "true"
        sys.dont_write_bytecode = True
        report["heavy_imports_attempted"] = True
        report["heavy_imports_performed"] = True
        write_json(manifest, report)
        import numpy as np
        import pyvista as pv
        report["heavy_imports_completed"] = True
        frames = [pv.read(item["path"]) for item in check["mesh_hash_checks"]]
        if any(mesh.n_points != item["points"] or mesh.n_cells != item["cells"]
               for mesh, item in zip(frames, report["frames"])):
            raise RuntimeError("Loaded VTP counts differ from saved source manifest")
        args.mode = report["mode"]
        report["ffmpeg"] = check["ffmpeg"]
        render_frames(args, report, frames, pv, np, run_dir)
        report.update({"status": "captured-unreviewed", "capture_performed": True,
            "finished_utc": utc_now(), "torch_loaded_in_render_worker": "torch" in sys.modules,
            "visual_review": "Not performed by harness; inspect MP4/posters before publication."})
        report["artifacts"] = {str(p.relative_to(run_dir)): sha256(p) for p in run_dir.rglob("*")
            if p.is_file() and p.name != "manifest.json"}
        write_json(manifest, report)
        return 0
    except BaseException as exc:
        report.update({"status": "failed", "error": f"{type(exc).__name__}: {exc}", "finished_utc": utc_now()})
        write_json(manifest, report)
        raise


def limit_worker_cpu():
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    kernel.GetProcessAffinityMask.argtypes = [wintypes.HANDLE, ctypes.POINTER(ctypes.c_size_t), ctypes.POINTER(ctypes.c_size_t)]
    kernel.SetProcessAffinityMask.argtypes = [wintypes.HANDLE, ctypes.c_size_t]
    process_mask, system_mask = ctypes.c_size_t(), ctypes.c_size_t()
    handle = kernel.GetCurrentProcess()
    if not kernel.GetProcessAffinityMask(handle, ctypes.byref(process_mask), ctypes.byref(system_mask)):
        raise ctypes.WinError(ctypes.get_last_error())
    bits = [1 << i for i in range(ctypes.sizeof(ctypes.c_size_t) * 8) if process_mask.value & (1 << i)]
    selected = sum(bits[:2])
    if not selected or not kernel.SetProcessAffinityMask(handle, selected):
        raise ctypes.WinError(ctypes.get_last_error())
    return selected


def create_kill_job():
    """The job contains only this harness's worker and its own ffmpeg child."""
    class Basic(ctypes.Structure):
        _fields_ = [("PerProcessUserTimeLimit", ctypes.c_longlong), ("PerJobUserTimeLimit", ctypes.c_longlong),
                    ("LimitFlags", wintypes.DWORD), ("MinimumWorkingSetSize", ctypes.c_size_t),
                    ("MaximumWorkingSetSize", ctypes.c_size_t), ("ActiveProcessLimit", wintypes.DWORD),
                    ("Affinity", ctypes.c_size_t), ("PriorityClass", wintypes.DWORD), ("SchedulingClass", wintypes.DWORD)]
    class IO(ctypes.Structure):
        _fields_ = [(name, ctypes.c_ulonglong) for name in ("ReadOperationCount", "WriteOperationCount",
                    "OtherOperationCount", "ReadTransferCount", "WriteTransferCount", "OtherTransferCount")]
    class Extended(ctypes.Structure):
        _fields_ = [("BasicLimitInformation", Basic), ("IoInfo", IO),
                    ("ProcessMemoryLimit", ctypes.c_size_t), ("JobMemoryLimit", ctypes.c_size_t),
                    ("PeakProcessMemoryUsed", ctypes.c_size_t), ("PeakJobMemoryUsed", ctypes.c_size_t)]
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
    kernel.CreateJobObjectW.restype = wintypes.HANDLE
    kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
    kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
    job = kernel.CreateJobObjectW(None, None)
    if not job:
        raise ctypes.WinError(ctypes.get_last_error())
    info = Extended()
    info.BasicLimitInformation.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
    if not kernel.SetInformationJobObject(job, 9, ctypes.byref(info), ctypes.sizeof(info)):
        kernel.CloseHandle(job)
        raise ctypes.WinError(ctypes.get_last_error())
    return kernel, job


def worker(args):
    run_dir = Path(os.environ["MM_CAPTURE_RUN_DIR"])
    # The supervisor must attach this process to its owned job before imports.
    deadline = time.monotonic() + 10
    while not (run_dir / "job-ready").exists():
        if time.monotonic() >= deadline:
            raise RuntimeError("Supervisor job attachment was not confirmed; refusing heavy imports")
        time.sleep(0.05)
    report = render_preflight(args) if args.render_from else preflight(args)
    manifest = run_dir / "manifest.json"
    report.update({"capture_performed": False, "status": "starting", "worker_started_utc": utc_now()})
    write_json(manifest, report)
    if report["issues"]:
        raise RuntimeError("Worker preflight blocked: " + "; ".join(report["issues"]))
    if args.render_from:
        return render_only_worker(args, report, run_dir)
    try:
        report["affinity_mask"] = limit_worker_cpu()
        for name in THREAD_ENV:
            os.environ[name] = "2"
        os.environ["CUDA_VISIBLE_DEVICES"] = str(args.gpu)
        os.environ["PYVISTA_OFF_SCREEN"] = "true"
        sys.dont_write_bytecode = True
        sys.path.insert(0, str(args.source_root))
        report["heavy_imports_attempted"] = True
        report["heavy_imports_performed"] = True  # Attempt began; completion is recorded separately.
        report["status"] = "importing-heavy-dependencies"
        write_json(manifest, report)
        import torch
        torch.set_num_threads(2)
        torch.set_num_interop_threads(2)
        if not torch.cuda.is_available():
            raise RuntimeError("CUDA unavailable; refusing to select the application's alternative CPU morph pipeline")
        import numpy as np
        import pyvista as pv
        from mesh_tools import load_and_clean_mesh, pyvista_to_trimesh, repair_mesh, normalise_meshes
        from morphing.framer import morph_mesh_sequence_torch
        report["heavy_imports_completed"] = True
        report["versions"] = {"torch": torch.__version__, "numpy": np.__version__, "pyvista": pv.__version__}
        report["gpu_runtime"] = torch.cuda.get_device_name(0)
        trimeshes = []
        report["preprocessing"] = []
        for item in report["inputs"]:
            mesh = load_and_clean_mesh(item["path"], target_faces=15000)
            tri = pyvista_to_trimesh(mesh)
            repaired = repair_mesh(tri)
            report["preprocessing"].append({"input_id": item["id"], "vertices": len(tri.vertices),
                "faces": len(tri.faces), "repair_returned_watertight": bool(repaired),
                "centroid_before_normalise": tri.centroid.tolist(), "bounds_before_normalise": tri.bounds.tolist()})
            trimeshes.append(tri)
        trimeshes = normalise_meshes(trimeshes)
        for index, tri in enumerate(trimeshes):
            tri.export(run_dir / f"normalised-input-{index}.ply")
            report["preprocessing"][index]["bounds_after_normalise"] = tri.bounds.tolist()
        report["status"] = "morphing"
        write_json(manifest, report)
        cfg = report["config"]
        with torch.no_grad():
            frames = morph_mesh_sequence_torch(trimeshes, resolution=cfg["resolution"],
                frames_per_transition=cfg["frames_per_transition"], device="cuda")
        requested = cfg["frames_per_transition"]
        report["actual_returned_count"] = len(frames)
        report["requested_count"] = requested
        report["requested_index_mapping_available"] = len(frames) == requested
        report["continuity_claim"] = "No anatomical or continuous-deformation claim. Count and returned order only."
        report["frames"] = []
        meshes_dir = run_dir / "meshes"
        meshes_dir.mkdir()
        # Preserve every actual returned mesh BEFORE opening any render window.
        for index, mesh in enumerate(frames):
            path = meshes_dir / f"returned-{index:03d}.vtp"
            mesh.save(path)
            report["frames"].append({"returned_index": index,
                "requested_index": index if len(frames) == requested else None,
                "interpolation_t": index / (requested - 1) if len(frames) == requested else None,
                "path": str(path.relative_to(run_dir)), "sha256": sha256(path),
                "points": int(mesh.n_points), "cells": int(mesh.n_cells), "bounds": list(mesh.bounds)})
        report["status"] = "meshes-saved"
        write_json(manifest, report)
        if len(frames) != requested:
            raise RuntimeError(f"Returned {len(frames)}/{requested} frames. Saved actual meshes; missing request indices are unknown, so video capture is blocked.")
        if not frames or any(m.n_points == 0 or m.n_cells == 0 for m in frames):
            raise RuntimeError("Empty returned mesh; video capture blocked")
        render_frames(args, report, frames, pv, np, run_dir)
        report.update({"status": "captured-unreviewed", "capture_performed": True, "finished_utc": utc_now(),
                       "visual_review": "Not performed by harness; inspect MP4/poster before publication."})
        report["artifacts"] = {str(p.relative_to(run_dir)): sha256(p) for p in run_dir.rglob("*")
            if p.is_file() and p.name != "manifest.json"}
        write_json(manifest, report)
        return 0
    except BaseException as exc:
        report.update({"status": "failed", "error": f"{type(exc).__name__}: {exc}", "finished_utc": utc_now()})
        write_json(manifest, report)
        raise


def render_frames(args, report, frames, pv, np, run_dir):
    cfg = report["config"]
    bounds = np.asarray([list(m.bounds) for m in frames], dtype=float)
    low = bounds[:, [0, 2, 4]].min(axis=0)
    high = bounds[:, [1, 3, 5]].max(axis=0)
    radius = float(np.linalg.norm(high - low) / 2)
    if not math.isfinite(radius) or radius <= 0:
        raise RuntimeError("Invalid returned mesh bounds")
    width, height = cfg["window_size"]
    if not math.isclose(width / height, 4 / 3):
        raise RuntimeError("Fixed sequence framing requires a 4:3 render canvas")
    direction = np.array([0.7, -1.0, 2.8], dtype=float)
    direction /= np.linalg.norm(direction)
    forward = -direction
    right = np.cross(forward, np.array([0.0, -1.0, 0.0]))
    right /= np.linalg.norm(right)
    screen_up = np.cross(right, forward)
    # Every actual vertex contributes; no per-frame camera fitting or mesh edits.
    basis = np.column_stack((right, screen_up, direction))
    projected_low = np.full(3, np.inf)
    projected_high = np.full(3, -np.inf)
    vertex_count = 0
    for mesh in frames:
        points = np.asarray(mesh.points, dtype=float)
        if not len(points) or not np.isfinite(points).all():
            raise RuntimeError("Cannot frame empty or non-finite returned vertices")
        projected = points @ basis
        projected_low = np.minimum(projected_low, projected.min(axis=0))
        projected_high = np.maximum(projected_high, projected.max(axis=0))
        vertex_count += len(points)
    projected_midpoint = (projected_low + projected_high) / 2
    centre = basis @ projected_midpoint
    projected_span = projected_high - projected_low
    margin_each_side = 0.12
    padded_span = projected_span[:2] * (1 + 2 * margin_each_side)
    parallel_scale = float(max(padded_span[1], padded_span[0] / (width / height)) / 2)
    if not math.isfinite(parallel_scale) or parallel_scale <= 0:
        raise RuntimeError("Invalid projected sequence extent")
    position = centre + direction * radius * 4
    camera = [position.tolist(), centre.tolist(), [0, -1, 0]]
    report["render"] = {"camera_position": camera, "projection": "parallel",
        "parallel_scale": parallel_scale, "union_bounds": [low.tolist(), high.tolist()],
        "framing": {"method": "All actual vertices of all returned frames, one shared camera",
            "frame_count": len(frames), "vertex_count_including_all_frames": vertex_count,
            "camera_right": right.tolist(), "camera_screen_up": screen_up.tolist(),
            "camera_outward_direction": direction.tolist(),
            "projected_union_min_uv_depth": projected_low.tolist(),
            "projected_union_max_uv_depth": projected_high.tolist(),
            "projected_padded_bounds_uv": [(projected_low[:2] - projected_span[:2] * margin_each_side).tolist(),
                                            (projected_high[:2] + projected_span[:2] * margin_each_side).tolist()],
            "margin_fraction_each_side": margin_each_side, "aspect_ratio": width / height,
            "projection_formula": "u=dot(vertex,right); v=dot(vertex,screen_up); d=dot(vertex,outward_direction)",
            "scale_formula": "parallel_scale=0.5*max((v_max-v_min)*1.24,(u_max-u_min)*1.24/aspect)",
            "centre_formula": "right*(u_min+u_max)/2 + screen_up*(v_min+v_max)/2 + outward_direction*(d_min+d_max)/2",
            "fixed_camera_centre_all_frames": centre.tolist(), "per_frame_fit_or_crop": False},
        "background": "#f2f6f5", "clay_color": "#7a929b", "anatomical_view_label": None,
        "no_UI_or_pointer": True, "geometry_smoothing_for_capture": False}
    png_dir = run_dir / "rendered"
    png_dir.mkdir()
    plotter = pv.Plotter(off_screen=True, window_size=(width, height), lighting="three lights")
    plotter.set_background("#f2f6f5")
    try:
        for index, mesh in enumerate(frames):
            plotter.clear_actors()
            plotter.add_mesh(mesh, color="#7a929b", smooth_shading=True, show_edges=False,
                ambient=0.22, diffuse=0.75, specular=0.18, specular_power=25,
                reset_camera=False)
            plotter.camera_position = camera
            plotter.enable_parallel_projection()
            plotter.camera.parallel_scale = parallel_scale
            plotter.reset_camera_clipping_range()
            plotter.screenshot(str(png_dir / f"returned-{index:03d}.png"), return_img=False)
    finally:
        plotter.close()
    poster_indices = {"poster-start.png": 0, "poster-mid.png": len(frames) // 2,
                      "poster-end.png": len(frames) - 1, "poster.png": len(frames) - 1}
    for name, index in poster_indices.items():
        shutil.copyfile(png_dir / f"returned-{index:03d}.png", run_dir / name)
    report["render"]["poster_returned_indices"] = poster_indices
    pause = round(cfg["fps"] * cfg["endpoint_pause_seconds"])
    indices = [0] * pause + list(range(len(frames))) + [len(frames) - 1] * pause
    report["render"]["video_frame_to_returned_index"] = indices
    report["render"]["video_duration_seconds"] = len(indices) / cfg["fps"]
    movie = run_dir / ("model-morpher-production-128x30.mp4" if args.mode == "production" else "model-morpher-reduced-64x20.mp4")
    ffargs = [report["ffmpeg"], "-hide_banner", "-loglevel", "error", "-y", "-threads", "2",
        "-f", "image2pipe", "-vcodec", "png", "-framerate", str(cfg["fps"]), "-i", "pipe:0",
        "-an", "-c:v", "libx264", "-threads", "2", "-pix_fmt", "yuv420p", "-crf", "18",
        "-movflags", "+faststart", str(movie)]
    with (run_dir / "ffmpeg.log").open("wb") as log:
        process = subprocess.Popen(ffargs, stdin=subprocess.PIPE, stdout=log, stderr=log,
                                   creationflags=subprocess.CREATE_NO_WINDOW)
        try:
            for index in indices:
                process.stdin.write((png_dir / f"returned-{index:03d}.png").read_bytes())
            process.stdin.close()
            if process.wait(timeout=120):
                raise RuntimeError("ffmpeg failed; see ffmpeg.log")
        finally:
            if process.poll() is None:
                process.kill()
                process.wait()


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    action = result.add_mutually_exclusive_group()
    action.add_argument("--preflight", action="store_true", help="Stdlib-only checks; this is the default")
    action.add_argument("--run", action="store_true", help="Opt in to one bounded GPU capture")
    action.add_argument("--render-from", type=Path, help="Opt in to rendering verified saved VTPs in an existing run; no Torch/morph imports")
    result.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE)
    result.add_argument("--atlas-root", type=Path, default=DEFAULT_ATLAS)
    result.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    result.add_argument("--mode", choices=("production", "reduced-64x20"), default="production")
    result.add_argument("--max-seconds", type=int, default=1800, help="Worker wall-clock bound, 60..1800 seconds")
    result.add_argument("--gpu", type=int, default=0)
    return result


def main():
    argparser = parser()
    args = argparser.parse_args()
    if not 60 <= args.max_seconds <= 1800:
        argparser.error("--max-seconds must be in 60..1800")
    if os.environ.get("MM_CAPTURE_RUN_DIR"):
        if not args.run and not args.render_from:
            argparser.error("Internal worker requires --run or --render-from")
        return worker(args)
    report = render_preflight(args) if args.render_from else preflight(args)
    args.output.mkdir(parents=True, exist_ok=True)
    write_json(args.output / ("render-preflight.json" if args.render_from else "preflight.json"), report)
    print(json.dumps(report, indent=2))
    if not args.run and not args.render_from:
        return 0 if report["status"] == "ready" else 2
    if report["status"] != "ready":
        return 2
    run_dir = args.output / (datetime.now(timezone.utc).strftime("run-%Y%m%dT%H%M%S%fZ-") +
                            ("render-saved-" + report["mode"] if args.render_from else args.mode))
    run_dir.mkdir()
    environment = os.environ.copy()
    environment["MM_CAPTURE_RUN_DIR"] = str(run_dir.resolve())
    environment["PYTHONDONTWRITEBYTECODE"] = "1"
    for name in THREAD_ENV:
        environment[name] = "2"
    kernel, job = create_kill_job()
    started = time.monotonic()
    process = None
    result = {"created_utc": utc_now(), "run_dir": str(run_dir), "max_seconds": args.max_seconds}
    try:
        with (run_dir / "run.log").open("w", encoding="utf-8") as log:
            process = subprocess.Popen([sys.executable, "-u", str(Path(__file__).resolve()), *sys.argv[1:]],
                env=environment, stdout=log, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
            if not kernel.AssignProcessToJobObject(job, wintypes.HANDLE(process._handle)):
                process.kill()
                process.wait()
                raise ctypes.WinError(ctypes.get_last_error())
            (run_dir / "job-ready").write_text("Owned Windows job attached\n", encoding="utf-8")
            try:
                code = process.wait(timeout=max(0.1, args.max_seconds - (time.monotonic() - started)))
                result.update({"status": "worker-exited", "exit_code": code})
            except subprocess.TimeoutExpired:
                result.update({"status": "timeout", "exit_code": 124,
                               "reason": "Worker wall-clock cap reached; only owned job processes terminated"})
    finally:
        kernel.CloseHandle(job)  # Ends the worker/its children on timeout or interruption.
        if process is not None:
            process.wait(timeout=20)
        result["elapsed_seconds"] = time.monotonic() - started
        write_json(run_dir / "supervisor.json", result)
    print(f"Run evidence: {run_dir}")
    return result["exit_code"]


if __name__ == "__main__":
    sys.exit(main())
