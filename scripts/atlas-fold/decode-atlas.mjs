/**
 * decode-atlas.mjs — stage 1 of the hero fold-sequence build.
 *
 * Decodes demos/morphbrain/atlas/week-{21..36}.glb into flat binaries that the
 * Python renderer can mmap. Every GLB declares KHR_draco_mesh_compression in
 * `extensionsRequired`, so the payload is unreadable without a Draco decoder.
 *
 * This deliberately uses the decoder ALREADY SHIPPED at
 * demos/morphbrain/draco/draco_decoder.js rather than adding a dependency:
 * the file is an Emscripten UMD bundle that exports CommonJS, so a plain
 * `require()` through createRequire loads it. No npm install, no network,
 * and no `eval`/`new Function` on file contents.
 *
 * Note for anyone tempted to reach for trimesh here: it reads the accessor
 * metadata, reports the correct 64984 verts / 129960 faces, and silently
 * returns every vertex at (0,0,0). It cannot decode Draco and does not say so.
 *
 * Usage:  node scripts/atlas-fold/decode-atlas.mjs <outDir>
 * Writes: pos.bin  float32  [16][64984][3]  display-space positions
 *         col.bin  uint8    [16][64984]     COLOR_0 red channel (curvature; R==G==B)
 *         idx.bin  uint32   [129960][3]     triangle indices (shared topology)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ATLAS = join(REPO, 'demos', 'morphbrain', 'atlas');

const outDir = resolve(process.argv[2] ?? join(REPO, 'scripts', 'atlas-fold', '.work'));
mkdirSync(outDir, { recursive: true });

// The Emscripten bundle expects a browser-ish global before it is loaded.
globalThis.self = globalThis;
const loaded = require(join(REPO, 'demos', 'morphbrain', 'draco', 'draco_decoder.js'));
const factory =
  typeof loaded === 'function' ? loaded : loaded.DracoDecoderModule || globalThis.DracoDecoderModule;
const draco = await new Promise((res) => factory({ onModuleLoaded: (m) => res(m) }));

function parseGLB(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`not a GLB: ${path}`);
  const total = buf.readUInt32LE(8);
  let off = 12;
  let json = null;
  let bin = null;
  while (off < total) {
    const clen = buf.readUInt32LE(off);
    const ctype = buf.toString('utf8', off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + clen);
    if (ctype.startsWith('JSON')) json = JSON.parse(body.toString('utf8'));
    else bin = body;
    off += 8 + clen;
  }
  return { json, bin };
}

const WEEKS = Array.from({ length: 16 }, (_, i) => 21 + i);
let N = 0;
let F = 0;
let pos = null;
let col = null;
let indices = null;

for (const [i, week] of WEEKS.entries()) {
  const { json, bin } = parseGLB(join(ATLAS, `week-${week}.glb`));
  const ext = json.meshes[0].primitives[0].extensions?.KHR_draco_mesh_compression;
  if (!ext) throw new Error(`week-${week}.glb: expected KHR_draco_mesh_compression`);
  const bv = json.bufferViews[ext.bufferView];
  const start = bv.byteOffset || 0;
  const slice = bin.subarray(start, start + bv.byteLength);

  const decoder = new draco.Decoder();
  const dbuf = new draco.DecoderBuffer();
  dbuf.Init(new Int8Array(slice), slice.length);
  const mesh = new draco.Mesh();
  const status = decoder.DecodeBufferToMesh(dbuf, mesh);
  if (!status.ok()) throw new Error(`week-${week}: draco decode failed`);

  const nv = mesh.num_points();
  const nf = mesh.num_faces();
  if (i === 0) {
    N = nv;
    F = nf;
    pos = new Float32Array(16 * N * 3);
    col = new Uint8Array(16 * N);
    indices = new Uint32Array(F * 3);
  } else if (nv !== N || nf !== F) {
    // Shared topology is the property the whole sequence depends on.
    throw new Error(`week-${week}: topology drift (${nv}/${nf} vs ${N}/${F})`);
    }

  const pa = decoder.GetAttributeByUniqueId(mesh, ext.attributes.POSITION);
  const pf = new draco.DracoFloat32Array();
  decoder.GetAttributeFloatForAllPoints(mesh, pa, pf);
  for (let k = 0; k < N * 3; k++) pos[i * N * 3 + k] = pf.GetValue(k);

  // COLOR_0 is per-week curvature and is greyscale (R==G==B); keep one channel.
  const ca = decoder.GetAttributeByUniqueId(mesh, ext.attributes.COLOR_0);
  const nc = ca.num_components();
  const cu = new draco.DracoUInt8Array();
  decoder.GetAttributeUInt8ForAllPoints(mesh, ca, cu);
  for (let k = 0; k < N; k++) col[i * N + k] = cu.GetValue(k * nc);

  if (i === 0) {
    const ia = new draco.DracoUInt32Array();
    for (let f = 0; f < F; f++) {
      decoder.GetFaceFromMesh(mesh, f, ia);
      indices[f * 3] = ia.GetValue(0);
      indices[f * 3 + 1] = ia.GetValue(1);
      indices[f * 3 + 2] = ia.GetValue(2);
    }
  }

  draco.destroy(mesh);
  draco.destroy(dbuf);
  draco.destroy(decoder);
  process.stdout.write(`${week} `);
}

writeFileSync(join(outDir, 'pos.bin'), Buffer.from(pos.buffer));
writeFileSync(join(outDir, 'col.bin'), Buffer.from(col.buffer));
writeFileSync(join(outDir, 'idx.bin'), Buffer.from(indices.buffer));
writeFileSync(
  join(outDir, 'shape.json'),
  JSON.stringify({ weeks: WEEKS, vertices: N, faces: F }, null, 2),
);
console.log(`\ndecoded 16 weeks — ${N} verts / ${F} faces each -> ${outDir}`);
