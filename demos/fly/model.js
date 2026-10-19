export function selectPair(trials, gain, seed) {
  const find = condition => trials.find(t => t.gain === Number(gain) && t.seed === Number(seed) && t.condition === condition);
  const intact = find('intact'), cut = find('silenced');
  if (!intact || !cut) throw new Error('This saved pair is unavailable.');
  return { intact, cut };
}
export function countThrough(spikes, time) {
  let low = 0, high = spikes.length;
  while (low < high) { const mid = (low + high) >>> 1; if (spikes[mid] <= time + 1e-12) low = mid + 1; else high = mid; }
  return low;
}
