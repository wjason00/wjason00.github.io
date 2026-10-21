import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = new URL('../', import.meta.url);
const sourcePath = 'demos/fly/network-data.json';
const svgPath = 'assets/portfolio/fly-network-focus.svg';
const provenancePath = 'assets/portfolio/fly-network-focus.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const canonicalNetworkSource = value => String(value).replaceAll('\r\n', '\n');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const descending = (a, b) => b.synapses - a.synapses || a.row - b.row;

export function selectNetwork(data) {
  // Selection is within this existing bounded export, not the complete connectome.
  const incoming = data.edges.filter(edge => edge.target === data.roundup).sort(descending).slice(0, 2);
  const outgoing = data.edges.filter(edge => edge.source === data.roundup).sort(descending).slice(0, 3);
  const otherReadout = data.edges.filter(edge => edge.target === data.mn9 && edge.source !== data.roundup).sort(descending).slice(0, 1);
  if (incoming.length !== 2 || outgoing.length !== 3 || otherReadout.length !== 1 || !outgoing.some(edge => edge.target === data.mn9)) {
    throw new Error('The frozen export no longer matches the focused figure design. Review the selection and layout.');
  }
  const edges = [...incoming, ...outgoing, ...otherReadout];
  const ids = new Set(edges.flatMap(edge => [edge.source, edge.target]));
  return { incoming, outgoing, otherReadout, edges, nodes: data.nodes.filter(node => ids.has(node.id)) };
}

export function renderNetwork(data) {
  const selection = selectNetwork(data);
  const otherTargets = selection.outgoing.filter(edge => edge.target !== data.mn9);
  const positions = new Map([
    [data.roundup, { x: 250, y: 202, r: 33 }],
    [data.mn9, { x: 500, y: 283, r: 27 }],
    [selection.incoming[0].source, { x: 72, y: 145, r: 14 }],
    [selection.incoming[1].source, { x: 72, y: 265, r: 14 }],
    [otherTargets[0].target, { x: 500, y: 122, r: 14 }],
    [otherTargets[1].target, { x: 500, y: 202, r: 14 }],
    [selection.otherReadout[0].source, { x: 352, y: 319, r: 14 }],
  ]);
  if (positions.size !== selection.nodes.length) throw new Error('Layout contains overlapping node identities.');
  const paths = selection.edges.map(edge => {
    const start = positions.get(edge.source);
    const end = positions.get(edge.target);
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const ux = (end.x - start.x) / distance;
    const uy = (end.y - start.y) / distance;
    const cut = edge.source === data.roundup;
    const d = `M ${(start.x + ux * (start.r + 5)).toFixed(2)} ${(start.y + uy * (start.r + 5)).toFixed(2)} L ${(end.x - ux * (end.r + 10)).toFixed(2)} ${(end.y - uy * (end.r + 10)).toFixed(2)}`;
    return `  <path data-edge-row="${edge.row}" data-source="${edge.source}" data-target="${edge.target}" data-intervention="${cut ? 'zeroed' : 'unchanged'}" class="edge ${cut ? 'cut' : 'unchanged'}" d="${d}" marker-end="url(#${cut ? 'cut-arrow' : 'arrow'})"><title>${escape(`${edge.source} → ${edge.target}; ${cut ? 'outgoing model connection zeroed in cut condition' : 'connection unchanged by the intervention'}`)}</title></path>`;
  });
  const circles = selection.nodes.map(node => {
    const position = positions.get(node.id);
    const role = node.id === data.roundup ? 'roundup' : node.id === data.mn9 ? 'readout' : 'other';
    return `  <circle data-node-id="${node.id}" class="node ${role}" cx="${position.x}" cy="${position.y}" r="${position.r}"><title>${escape(`${node.label}; source ID ${node.id}`)}</title></circle>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="430" viewBox="0 0 600 430" role="img" aria-labelledby="network-title network-desc">
  <title id="network-title">Selected model connections around Roundup and MN9</title>
  <desc id="network-desc">Schematic of seven neurons and six directed connections selected from a bounded FlyWire model export. Two selected inputs to Roundup remain unchanged. Three selected Roundup outputs, including its connection to the motor neuron MN9, the simulation readout, are dashed to mark connections zeroed in the cut condition. One other input to MN9 remains unchanged. Other model connections are omitted; all Roundup outgoing connections were zeroed in the experiment. This is connectivity, not neural activity, anatomy, or proof of a causal signal route. Line widths do not encode strength or sign.</desc>
  <metadata>Source: demos/fly/network-data.json. Selection and attribution: fly-network-focus.json. Rebuild: node scripts/render-fly-network.mjs.</metadata>
  <style>
    text { font-family: 'Source Sans 3', Arial, sans-serif; fill: #243446; }
    .edge { fill: none; stroke-width: 3; }
    .unchanged { stroke: #788799; }
    .cut { stroke: #b95726; stroke-dasharray: 8 7; }
    .node { stroke-width: 2; }
    .other { fill: #e4eaf0; stroke: #788799; }
    .roundup { fill: #b95726; stroke: #b95726; }
    .readout { fill: #126b68; stroke: #126b68; }
    .label { font-size: 26px; font-weight: 600; }
    .legend { font-size: 21px; }
    .role { font-size: 21px; fill: #526574; }
    .scope { font-size: 20px; fill: #526574; }
  </style>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#788799"/></marker>
    <marker id="cut-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#b95726"/></marker>
  </defs>
  <rect width="600" height="430" fill="#fff"/>
  <text class="label" x="28" y="34">Roundup output intervention</text>
  <text class="scope" x="28" y="62">Selected connections · schematic; others omitted</text>
  <text class="role" x="72" y="108" text-anchor="middle">Inputs</text>
  <text class="role" x="500" y="86" text-anchor="middle">Other targets</text>
${paths.join('\n')}
${circles.join('\n')}
  <text class="label" x="250" y="259" text-anchor="middle">Roundup</text>
  <text class="role" x="250" y="284" text-anchor="middle">outputs cut</text>
  <text class="role" x="352" y="354" text-anchor="middle">Other input</text>
  <text class="label" x="500" y="334" text-anchor="middle">MN9</text>
  <text class="role" x="500" y="358" text-anchor="middle">readout</text>
  <line class="edge unchanged" x1="28" y1="388" x2="70" y2="388" marker-end="url(#arrow)"/>
  <text class="legend" x="88" y="395">Unchanged</text>
  <line class="edge cut" x1="292" y1="388" x2="334" y2="388" marker-end="url(#cut-arrow)"/>
  <text class="legend" x="352" y="395">Roundup outputs zeroed</text>
  <text class="scope" x="28" y="423">Arrows show direction; sign and strength not encoded.</text>
</svg>
`;
  return { svg, selection };
}

export async function buildNetwork() {
  const bytes = await readFile(new URL(sourcePath, root));
  const canonicalSource = canonicalNetworkSource(bytes);
  const data = JSON.parse(canonicalSource);
  const { svg, selection } = renderNetwork(data);
  const provenance = {
    format: 'fly-network-focus-1',
    source: { path: sourcePath, sha256: sha256(canonicalSource), fingerprint: 'UTF-8 with LF line endings; CRLF is normalized without changing JSON values.', upstream: data.source },
    selectionRule: 'Within the existing bounded export: two largest synapse-count inputs to Roundup, three largest synapse-count outputs from Roundup, and largest other input to MN9. Ties resolve by ascending source parquet row. Other connections are omitted.',
    scope: 'Selected model connections; schematic layout. Not anatomical coordinates, activity, or a causal signal route. Uniform line widths do not encode model sign or connection strength.',
    intervention: 'All Roundup outgoing connections were zeroed in the cut condition; incoming connections were preserved. The diagram shows three selected outgoing connections only.',
    nodes: selection.nodes.map(({ id, label }) => ({ id, label })),
    edges: selection.edges.map(edge => ({ ...edge, intervention: edge.source === data.roundup ? 'zeroed' : 'unchanged' })),
    output: { path: svgPath, sha256: sha256(svg), width: 600, height: 430 },
    rebuild: 'node scripts/render-fly-network.mjs',
  };
  await writeFile(new URL(svgPath, root), svg);
  await writeFile(new URL(provenancePath, root), `${JSON.stringify(provenance, null, 2)}\n`);
  return { nodes: selection.nodes.length, edges: selection.edges.length, svg: svgPath };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  console.log(JSON.stringify(await buildNetwork()));
}
