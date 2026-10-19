const modelPaper = { title: 'Shiu et al. (2024)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11446845/' };
const feedingPaper = { title: 'Shiu et al. (2022)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9292995/' };
const atlasPaper = { title: 'Sterne et al. (2021)', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8445619/' };

export function neuronExplanation(node) {
  if (node.role === 'roundup') return {
    summary: 'A premotor neuron: it sits upstream of motor output. The source study identified Roundup as the premotor neuron with the strongest predicted silencing effect on MN9.',
    evidence: 'Why this target? It gives an established feeding-circuit result to reproduce and test under controlled changes to input and connection strength.',
    limit: 'Our cut removes all Roundup outputs. Incoming connections remain, so Roundup can still receive input and fire. This does not isolate its direct connection to MN9.',
    sources: [modelPaper, feedingPaper]
  };
  if (node.role === 'mn9') return {
    summary: 'A motor neuron controlling rostrum lifting: movement of the main part of the proboscis during extension towards food.',
    evidence: 'Why this readout? The source study used MN9 to connect sugar-sensory input with a defined motor output. The chart measures its simulated spikes.',
    limit: 'The exact relationship between firing rate and movement is unknown. Fewer simulated spikes do not specify how much a real fly moves or feeds.',
    sources: [modelPaper]
  };
  if (node.role === 'sensory') return {
    summary: 'A sugar gustatory receptor neuron (GRN): one of the sensory input neurons stimulated in this model.',
    evidence: 'Prescribed external spike events activate sensory neurons. Their outgoing synapses then participate in the same signed network as other connections.',
    limit: 'Global gain scales internal connections, including sensory-neuron outputs. It does not change the prescribed external input in these saved comparisons.',
    sources: [modelPaper]
  };
  const label = String(node.types?.[0] || node.label || '').toLowerCase();
  if (label === 'bract') return {
    summary: 'A third-order descending neuron projecting to the ventral nerve cord, identified in a feeding sensorimotor circuit.',
    evidence: 'Earlier work studied how this circuit combines taste and hunger. The later model paper also tested Bract in water-evoked feeding initiation.',
    limit: 'This demo does not manipulate Bract or establish that it explains the Roundup-cut result.',
    sources: [feedingPaper, modelPaper]
  };
  if (label === 'tentacular') return {
    summary: 'A named neuron type whose outputs are assigned inhibitory weights in the source model.',
    evidence: 'The model paper reports a mismatch between its prediction and behavioural experiments for Tentacular. It is a useful example of where wiring-based simulation has limits.',
    limit: 'A negative model weight is not a verified behavioural role. Baseline activity, neuromodulation and neurotransmitter assignments can affect predictions.',
    sources: [modelPaper]
  };
  if (['buddy', 'cradle', 'horntail'].includes(label)) return {
    summary: `${label[0].toUpperCase() + label.slice(1)} is a source cell-type label. The name identifies a neuron type rather than describing a feeding action.`,
    evidence: label === 'buddy' ? 'Several graph neurons share this type label. Their full IDs distinguish the individual cells.' : 'Its presence here follows the source-connectivity neighbourhood selection, rather than a demonstrated causal role in this experiment.',
    limit: 'A specific feeding function was not verified in the primary material checked for this demo. Its assigned sign describes its model outputs; it does not establish whether the whole circuit promotes or suppresses feeding.',
    sources: label === 'horntail' ? [] : [atlasPaper]
  };
  return {
    summary: 'This export does not provide a cell-type annotation for this neuron. Its source ID and displayed connections are retained.',
    evidence: 'It was selected by its structural position around Roundup and MN9. Source identity and anatomy can still be inspected.',
    limit: 'Unannotated does not mean unimportant. A function cannot be assigned from the label, shape or connection sign alone.',
    sources: []
  };
}
