"""Draw the portfolio overview from verified saved fly outputs; no simulation is run.

Example:
  python scripts/plot-fly-portfolio.py --input PATH/paired-results-v4.csv
Requires matplotlib. The primary CSV must match the frozen public evidence hash.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "assets/portfolio/research-20261015/evidence.json"
SUMMARY = ROOT / "assets/portfolio/research-20261015/fly-summary.csv"
ARCHIVE = ROOT / "demos/fly/archive.js"
OUTPUT = ROOT / "assets/portfolio/fly-paired-comparison.svg"
RECEIPT = ROOT / "output/fly-figure-20261020/plot-receipt.json"
GAINS = (0.8, 1.0, 1.2)
INK, MUTED, GRID = "#24333d", "#5e6d77", "#e1e6e8"
INTACT, CUT = "#176c72", "#b95726"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", "--paired-csv", dest="paired_csv", type=Path, required=True)
    args = parser.parse_args()
    primary = args.paired_csv.resolve()
    evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
    assert sha(primary) == evidence["fly"]["paired_results_sha256"], "Primary CSV does not match the frozen evidence."
    assert sha(SUMMARY) == evidence["public_files"][SUMMARY.name]["sha256"]
    rows = list(csv.DictReader(primary.open(encoding="utf-8", newline="")))
    assert len(rows) == 15
    points = {(float(r["gain"]), int(r["seed"])): (int(r["intact"]), int(r["silenced"])) for r in rows}
    assert set(points) == {(g, s) for g in GAINS for s in range(5)}
    archive = json.loads(re.fullmatch(r"window\.FEEDING_DATA=(.*);\s*", ARCHIVE.read_text(encoding="utf-8")).group(1))
    for trial in archive["trials"]:
        field = 0 if trial["condition"] == "intact" else 1
        assert points[(float(trial["gain"]), int(trial["seed"]))][field] == trial["count"] == len(trial["spikes"])
    for row in csv.DictReader(SUMMARY.open(encoding="utf-8", newline="")):
        group = [points[(float(row["recurrent_gain"]), seed)] for seed in range(5)]
        assert sum(p[0] for p in group) / 5 == float(row["intact_mean_spikes_per_1s"])
        assert sum(p[1] for p in group) / 5 == float(row["disconnected_mean_spikes_per_1s"])

    # At 420 CSS px, 10.8 pt becomes 15 px. Shape distinguishes conditions
    # independently of colour; row position preserves the original seed identity.
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10.8,
                         "text.color": INK, "axes.labelcolor": INK,
                         "xtick.color": MUTED, "ytick.color": MUTED,
                         "svg.fonttype": "none", "svg.hashsalt": "fly-paired-portfolio-v1"})
    fig, axes = plt.subplots(3, 1, figsize=(4.2, 5), dpi=100, sharex=True)
    fig.patch.set_facecolor("#ffffff")
    fig.subplots_adjust(left=.17, right=.965, top=.735, bottom=.125, hspace=.66)
    fig.text(.045, .952, "Does cutting Roundup change MN9?", fontsize=12.3, weight="semibold")
    fig.text(.045, .899, "Saved model output · 5 input seeds", fontsize=10.8, color=MUTED)
    legend_handles = [plt.Line2D([], [], marker="o", linestyle="none", color=INTACT, markersize=5.6),
                      plt.Line2D([], [], marker="s", linestyle="none", color=CUT, markersize=5.1)]
    fig.legend(legend_handles, ["Intact", "Outgoing weights cut"], loc="upper left",
               bbox_to_anchor=(.031, .878), frameon=False, ncol=1, borderaxespad=0,
               handletextpad=.45, labelspacing=.35, fontsize=10.8)
    plotted = []
    for ax, gain in zip(axes, GAINS):
        ax.set_xlim(0, 90)
        ax.set_ylim(-.55, 4.55)
        ax.invert_yaxis()
        ax.set_yticks(range(5), labels=[str(s) for s in range(5)])
        ax.set_xticks([0, 30, 60, 90])
        ax.grid(axis="x", color=GRID, linewidth=.7)
        ax.set_axisbelow(True)
        ax.tick_params(axis="y", length=0, pad=7)
        ax.tick_params(axis="x", length=0, pad=7)
        for spine in ax.spines.values():
            spine.set_visible(False)
        ax.axvline(0, color="#bbc7cc", linewidth=.8)
        ax.text(0, 1.14, f"Recurrent gain {gain:.1f}×", transform=ax.transAxes,
                fontsize=10.8, weight="semibold")
        for seed in range(5):
            intact, cut = points[(gain, seed)]
            gid = f"pair-g{str(gain).replace('.', 'p')}-s{seed}"
            ax.plot([cut, intact], [seed, seed], color="#a7b5bb", linewidth=1.25, zorder=2, gid=gid)
            ax.scatter([intact], [seed], s=29, marker="o", color=INTACT, edgecolors="white", linewidths=.45, zorder=3, gid=gid+"-intact")
            ax.scatter([cut], [seed], s=25, marker="s", color=CUT, edgecolors="white", linewidths=.45, zorder=4, gid=gid+"-cut")
            plotted.append({"gain": gain, "seed": seed, "intact": intact, "silenced": cut, "svg_pair_id": gid})
    fig.text(.025, .457, "Input seed", rotation=90, va="center", color=MUTED, fontsize=10.8)
    axes[-1].set_xlabel("MN9 spikes in one second", labelpad=9, fontsize=10.8)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(OUTPUT, format="svg", metadata={"Date": None,
                "Title": "Does cutting Roundup change MN9?",
                "Description": "Saved exploratory simulations: five paired input seeds at each of three recurrent gains. Teal circles show intact counts; orange squares show Roundup outgoing-weight cuts. Each connector joins one input seed. Seeds are inputs, not animals; no biological validation or significance is claimed."})
    RECEIPT.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(RECEIPT.parent / "plot-preview.png", dpi=200, facecolor="white")
    plt.close(fig)
    svg = OUTPUT.read_text(encoding="utf-8")
    # Keep Matplotlib's measured geometry while providing a browser-safe sans
    # fallback on systems without Matplotlib's bundled DejaVu font installed.
    svg = svg.replace("font-family: 'DejaVu Sans'", "font-family: Arial, 'DejaVu Sans', sans-serif")
    for point in plotted:
        gid = point["svg_pair_id"]
        token = f'id="{gid}"'
        assert svg.count(token) == 1
        svg = svg.replace(token, token + f' data-gain="{point["gain"]}" data-seed="{point["seed"]}" data-intact="{point["intact"]}" data-cut="{point["silenced"]}"')
    svg = "\n".join(line.rstrip() for line in svg.splitlines()) + "\n"
    OUTPUT.write_text(svg, encoding="utf-8", newline="\n")
    # Verify each emitted artist's intended count via the receipt and retain
    # explicit values for a separate source-to-render audit.
    assert len(plotted) == 15 and len({(p["gain"], p["seed"]) for p in plotted}) == 15
    parsed = ET.parse(OUTPUT)
    text_elements = [el for el in parsed.iter() if el.tag.endswith("text")]
    assert len(text_elements) >= 20
    assert all("font-family: Arial, 'DejaVu Sans', sans-serif" in el.attrib.get("style", "") for el in text_elements)
    receipt = {"format": "fly-portfolio-plot-v1", "source_csv": str(primary),
               "source_csv_sha256": sha(primary), "evidence_sha256": sha(EVIDENCE),
               "summary_sha256": sha(SUMMARY), "archive_sha256": sha(ARCHIVE),
               "output": str(OUTPUT.relative_to(ROOT)), "output_sha256": sha(OUTPUT),
               "dimensions_css_px": [420, 500], "smallest_essential_font_px_at_420": 15,
               "x_axis_count_domain": [0, 90], "all_pairs": plotted,
               "checks": {"frozen_primary_hash": True, "all_30_counts_equal_archive": True,
                          "all_6_group_means_equal_saved_summary": True,
                          "15_pairs_no_selection": True},
               "claim_boundary": "Presentation of existing saved outputs only; no new simulation, inferential statistic or biological result."}
    RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}; 15 pairs / 30 counts verified against primary CSV, replay archive and saved means.")


if __name__ == "__main__":
    main()
