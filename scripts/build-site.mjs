// Build exactly the same public artifact locally and in GitHub Pages.
// Source files are validated before the generated _site directory is replaced.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = realpathSync(resolve(import.meta.dirname, '..'));
const destination = resolve(root, '_site');
const shell = ['index.html', 'rare-errors.html', '404.html', 'styles.css', 'theme.js', 'script.js', 'favicon.svg', 'robots.txt', 'sitemap.xml', 'third-party-notices.html', 'THIRD_PARTY_NOTICES.txt', '.nojekyll'];
const directories = ['assets', 'demos', 'licenses'];
const files = [];
function collect(path) {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) throw new Error(`Publication source must not be a symlink: ${relative(root, path)}`);
  if (stat.isDirectory()) {
    for (const child of readdirSync(path).sort()) collect(join(path, child));
  } else if (stat.isFile()) {
    const name = relative(root, path).split(sep).join('/');
    // Withheld from public promotion at Jason's request, 17 October 2026.
    if (['assets/portfolio/research-20261015/eeg-normalization.png',
         'assets/portfolio/research-20261015/eeg-summary.csv'].includes(name)) return;
    files.push(path);
  }
}
for (const name of [...shell, ...directories]) collect(join(root, name));
const manifest = {};
let bytes = 0;
for (const path of files) {
  const name = relative(root, path).split(sep).join('/');
  if (/\.(?:modes\.bin|map|nii(?:\.gz)?|mgz|mgh|dcm|gii|trk|bval|bvec)$/i.test(name) ||
      /(?:^|\/)[^/]*(?:cv|resume)[^/]*\.pdf$/i.test(name)) {
    throw new Error(`Prohibited publication file: ${name}`);
  }
  const content = readFileSync(path);
  bytes += content.byteLength;
  manifest[name] = { bytes: content.byteLength, sha256: createHash('sha256').update(content).digest('hex') };
}
if (bytes >= 12 * 1024 * 1024) throw new Error(`Publication artifact exceeds 12 MiB: ${bytes} bytes`);

// Only this exact, generated child directory may be removed. Never follow a link.
if (relative(root, destination) !== '_site') throw new Error('Unsafe artifact destination');
if (existsSync(destination)) {
  if (lstatSync(destination).isSymbolicLink() || realpathSync(destination) !== destination) throw new Error('Artifact destination is redirected');
  rmSync(destination, { recursive: true });
}
mkdirSync(destination);
for (const path of files) {
  const name = relative(root, path);
  const target = join(destination, name);
  mkdirSync(resolve(target, '..'), { recursive: true });
  cpSync(path, target);
}
// Detect a concurrent source write or failed copy before accepting the candidate.
for (const [name, receipt] of Object.entries(manifest)) {
  const copied = readFileSync(join(destination, name));
  if (createHash('sha256').update(copied).digest('hex') !== receipt.sha256) throw new Error(`Artifact changed during assembly: ${name}`);
}
execFileSync(process.execPath, [join(root, 'scripts/check-links.mjs'), destination], { stdio: 'inherit' });
mkdirSync(join(root, 'output'), { recursive: true });
writeFileSync(join(root, 'output/release-manifest.json'), JSON.stringify({ files: files.length, bytes, manifest }, null, 2) + '\n');
console.log(`Built ${files.length} public files (${bytes.toLocaleString('en-GB')} bytes) in ${destination}`);
