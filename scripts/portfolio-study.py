"""Build the portfolio's presentation data from the frozen synthetic study.

Usage: python scripts/portfolio-study.py PATH_TO_RARE_ERRORS_OUTPUT
No simulation, fitting, or source-study files are changed.
"""
from pathlib import Path
import csv
import hashlib
import json
import shutil
import statistics
import sys

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
target = root / 'assets/portfolio/rare-errors'
manifest = json.loads((source / 'manifest.json').read_text())
assert manifest['status'] == 'complete', manifest['status']
target.mkdir(parents=True, exist_ok=True)
hashes = {}
for name in ['metrics.csv', 'config.json', 'rare_errors.png', 'rare_errors.svg']:
    digest = hashlib.sha256((source / name).read_bytes()).hexdigest()
    assert digest == manifest['artifacts'][name], name
    hashes[name] = digest
    shutil.copy2(source / name, target / name)
rows = list(csv.DictReader((source / 'metrics.csv').open()))
assert len(rows) == 120
data = {}
for count in [0, 1, 2, 5, 10, 20]:
    result = {'errors': count, 'correct': 40-count, 'rank': 2 if count == 0 else 4}
    for condition, fields in {
        'choice_present': ['choice_intended_purity', 'choice_branch_target_nmse'],
        'no_pure_choice': ['choice_branch_truth_energy_fraction', 'choice_branch_total_nmse'],
    }.items():
        selected = sorted([r for r in rows if r['condition'] == condition and r['model'] == 'dPCA' and int(r['errors_per_stimulus']) == count], key=lambda r: int(r['noise_seed']))
        assert [int(r['noise_seed']) for r in selected] == list(range(5))
        for field in fields:
            values = [float(r[field]) for r in selected] if count else []
            result[field] = {'values': values, 'mean': statistics.mean(values), 'min': min(values), 'max': max(values)} if values else None
    data[count] = result
(target / 'data.js').write_text('/* Generated from hash-verified frozen synthetic results; see provenance.json. */\nwindow.rareErrorResults = '+json.dumps(data, indent=2)+';\n', encoding='utf-8')
(target / 'provenance.json').write_text(json.dumps({
    'description': 'Frozen synthetic rare-error study, presentation copy. No biological data.',
    'source_commit': manifest['git_commit'],
    'source_created_utc': manifest['created_utc'],
    'source_status': manifest['status'],
    'scope': 'Frozen synthetic results for inspection. Downloads contain results and configuration; the study analysis code is not included.',
    'rows': 120, 'fitted_rows': 100, 'noise_seeds': list(range(5)),
    'uncertainty': 'Full range over five noise seeds, not a confidence interval.',
    'sha256': hashes,
}, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'rows': len(rows), 'counts': list(data), 'verified_hashes': hashes}, indent=2))
