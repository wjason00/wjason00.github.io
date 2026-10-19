# Timing pilot evidence contract, version 1

`data.json` is the only production evidence input. Pending data may contain only `schema_version: 1` and `metadata: { stage: "pending", audited: false }`. The UI displays no values unless the complete verified contract passes validation.

For verified data:

```json
{
  "schema_version": 1,
  "metadata": {
    "stage": "verified", "audited": true,
    "model": "Full published model", "model_commit": "pinned source commit",
    "gain": 1, "dt_ms": 0.1, "run_ms": 1500, "warmup_ms": 500,
    "analysis_start_ms": 500, "analysis_end_ms": 1000, "period_ms": 500, "input_time_reference": "absolute_run", "scheduled_events_per_grn_period": 50,
    "input_note": "Scheduled candidate pulses; not applied pulses or GRN spikes"
  },
  "templates": [{ "id": "1001", "label": "Template 1" }],
  "input_events": [{ "template_id": "1001", "pattern": "aligned", "neuron_id": "string ID", "time_ms": 501.2 }],
  "cells": [{ "template_id": "1001", "pattern": "aligned", "condition": "intact", "mn9_count": 0 }],
  "paired_contrasts": [{ "template_id": "1001", "e_aligned": 0, "e_staggered": 0, "interaction": 0 }],
  "sources": [{ "label": "Raw evidence", "url": "https://example.org/evidence" }],
  "audit": { "label": "Independent audit", "url": "https://example.org/audit" }
}
```

The example above illustrates fields only; its values are not findings. Exactly five unique string template IDs, 30 unique cells (5 × 2 × 3), and five paired contrasts are required. Patterns are `aligned` and `staggered`; the latter is displayed as “Circularly shifted copies”. Conditions are `intact`, `direct_edge`, `all_outgoing`. Spike counts are nonnegative integers. Each template/pattern raster must include 21 distinct string neuron IDs; timestamps use absolute run milliseconds within `[500,1000)`. All groups must use the same 21 IDs. Contrasts are checked against cells: E = direct_edge − all_outgoing, I = E_staggered − E_aligned. IDs remain strings throughout JavaScript.

Source and audit links may be HTTPS URLs or relative public files. Local filesystem paths and executable URL schemes are rejected. Metadata fixes the experiment window and model settings; the original raw evidence remains authoritative.

Optional integer cell fields: scheduled_count, applied_count, grn_spike_count. Each sums all 21 GRNs within the same [500,1000) ms analysis window. When supplied for all three selected conditions, the UI displays them together. Full raw NPZ files remain local; public sources should be named according to what the linked export contains.

Verified protocol requires scheduled_events_per_grn_period=50. Every template/pattern raster must contain exactly 50 pulses for each of the same 21 string GRN IDs (1,050 per measurement window). Each supplied cell scheduled_count must equal its shared raster total; all three intervention conditions use that same raster. Per-GRN counts must match across the two patterns. Source URLs are trimmed and limited to HTTP(S) or relative public paths; executable schemes and local paths are rejected.
