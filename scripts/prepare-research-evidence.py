"""Export only aggregate presentation evidence; never read or copy raw subject data."""
import csv
import hashlib
import io
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets/portfolio/research-20261015'
FLY = Path('C:/Users/jason/Documents/ChatGPT/fly-perturbation-pilot/paired-2026-10-13')
FLY_RESULT = FLY / 'combined-verification-r2-20261014T1735'
EEG = Path('C:/Users/jason/Desktop/projects/eeg-track2-baseline/docs/experiments/normalization_control_2026-10-14')
IDENTITY = FLY/'attempts/continuation-v4-r2-20261014T1730/identity.json'
SOURCES = [FLY/'README.md', FLY_RESULT/'paired-results-v4.csv', FLY_RESULT/'combined-verification.json', IDENTITY, EEG/'README.md', EEG/'verification-summary.json']

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

DEST.mkdir(parents=True, exist_ok=True)
fly_verification = json.loads((FLY_RESULT/'combined-verification.json').read_text())
assert fly_verification['passed'] is True
assert sha(IDENTITY) == fly_verification['continuation_files_sha256']['identity.json']
assert sha(FLY_RESULT/'paired-results-v4.csv') == fly_verification['table_sha256']
neuron_count = json.loads(IDENTITY.read_text())['neuron_count']
assert neuron_count == 127400
pairs = list(csv.DictReader(io.StringIO((FLY_RESULT/'paired-results-v4.csv').read_text())))
assert len(pairs) == 15 and all(float(row['difference']) < 0 for row in pairs)
with (DEST/'fly-summary.csv').open('w', newline='', encoding='utf-8') as handle:
    writer = csv.writer(handle)
    writer.writerow(['recurrent_gain', 'input_seeds', 'intact_mean_spikes_per_1s', 'disconnected_mean_spikes_per_1s', 'mean_paired_difference_spikes_per_1s', 'ratio_of_means'])
    for gain in (0.8, 1.0, 1.2):
        selected = [row for row in pairs if float(row['gain']) == gain]
        assert len(selected) == 5
        intact = sum(float(row['intact']) for row in selected)/5
        disconnected = sum(float(row['silenced']) for row in selected)/5
        writer.writerow([gain, 5, intact, disconnected, round(disconnected-intact, 1), round(disconnected/intact, 6)])

eeg_verification = json.loads((EEG/'verification-summary.json').read_text())
assert eeg_verification['status'] == 'passed'
with (DEST/'eeg-summary.csv').open('w', newline='', encoding='utf-8') as handle:
    writer = csv.writer(handle)
    writer.writerow(['normalization', 'representation', 'pooled_balanced_accuracy_percent', 'equal_person_balanced_accuracy_percent'])
    for mode in ('per_recording', 'session0'):
        for representation in ('lag_0', 'duplicated_current', 'lag_4'):
            scores = eeg_verification['reconstructed'][mode][representation]
            writer.writerow([mode, representation, 100*scores['pooled_balanced_accuracy'], 100*scores['equal_person_balanced_accuracy']])

images = [(FLY_RESULT/'figures-v4/paired-mn9-gain-v4.png', DEST/'fly-circuit.png'), (EEG/'figures/normalization-control.png', DEST/'eeg-normalization.png')]
for source, destination in images:
    shutil.copyfile(source, destination)
    assert sha(source) == sha(destination)

public = {
    'prepared_date': '2026-10-15',
    'scope': 'Aggregate presentation of completed exploratory studies. No raw recordings, trial-level EEG predictions or participant identifiers are included in the downloadable tables.',
    'fly': {
        'source': 'Shiu et al. (2024), https://pmc.ncbi.nlm.nih.gov/articles/PMC11446845/',
        'model_commit': '91bdd1e7dcf193f3e7ca5a8933497fcef63b7960',
        'implemented_neuron_count': neuron_count,
        'run_identity_sha256': sha(IDENTITY),
        'independent_saved_output_verification_passed': True,
        'verification_sha256': sha(FLY_RESULT/'combined-verification.json'),
        'paired_results_sha256': sha(FLY_RESULT/'paired-results-v4.csv'),
        'method': 'Roundup outgoing weights set to zero; three recurrent gains, five paired input seeds, one second per run. Shared exogenous candidates with state-dependent refractory acceptance. Both candidate coupling and an execution correction were post-failure amendments, not preregistered.',
        'limits': 'Five input seeds are not animals. One model, neuron intervention, endpoint and input regime at three selected gains. No statistical significance, biological validation, novelty or full source-paper replication claimed. Source hemisphere naming discrepancy unresolved.'
    },
    'eeg': {
        'source': 'Scherer et al. (2015), https://doi.org/10.1371/journal.pone.0123727; BNCI2015-004, selected numeric classes 1, 2, 4.',
        'independent_saved_output_verification_passed': True,
        'verification_sha256': sha(EEG/'verification-summary.json'),
        'method': 'Nine participants, 1080 earlier-session training trials and 1050 later-session evaluation trials. Three representations with fitted classifiers held fixed across two normalization modes. Verification passed after a verifier-metadata correction; no model was refitted. CSV accuracies are percentages.',
        'limits': 'Previously inspected evaluation sessions. Descriptive exploratory result; no untouched-test, new-person, online, neural-mechanism, significance, novelty or competition-performance claim.'
    },
    'public_files': {path.name: {'sha256': sha(path), 'bytes': path.stat().st_size} for path in sorted(DEST.iterdir()) if path.name != 'evidence.json'}
}
(DEST/'evidence.json').write_text(json.dumps(public, indent=2)+'\n', encoding='utf-8')
internal = ROOT/'output/research-20261015'
internal.mkdir(parents=True, exist_ok=True)
(internal/'source-provenance.json').write_text(json.dumps({
    'scope': 'Publication draft only; no new science run. Figure bytes copied unchanged; CSV aggregates derived from verified saved outputs.',
    'contribution': 'Printed wording follows the Claude-reviewed 15 October master CV: Jason proposed and directed the studies. Original owners preserve AI-assisted implementation, review attribution and unassessed personal understanding. No sole manual authorship inferred.',
    'sources': {str(path): sha(path) for path in SOURCES},
    'images': {str(source): {'sha256': sha(source), 'destination': str(destination)} for source, destination in images}
}, indent=2)+'\n', encoding='utf-8')
print(f'Prepared {len(list(DEST.iterdir()))} public files from verified outputs; private provenance excluded from site.')
