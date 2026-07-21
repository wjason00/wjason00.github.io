import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const projectRoot = resolve(process.argv[2] || '.');
const outputPath = resolve(process.argv[3] || 'THIRD_PARTY_NOTICES.txt');
const npmCli = [
  process.env.npm_execpath,
  join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
].find((candidate) => candidate && existsSync(candidate));

if (!npmCli) throw new Error('Could not locate npm-cli.js beside the current Node.js runtime.');

const listed = execFileSync(process.execPath, [npmCli, 'ls', '--omit=dev', '--all', '--parseable'], {
  cwd: projectRoot,
  encoding: 'utf8',
})
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && line !== projectRoot);

const extras = [
  '@fontsource/source-sans-3',
  '@fontsource/dm-mono',
  '@fontsource/spectral',
  'draco3dgltf',
].map((name) => join(projectRoot, 'node_modules', ...name.split('/')));

const packageRoots = [...new Set([...listed, ...extras])].filter((path) => existsSync(join(path, 'package.json')));
const licenceNames = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING'];

function repositoryUrl(repository) {
  if (typeof repository === 'string') return repository;
  return repository?.url || '';
}

const packages = packageRoots.map((packageRoot) => {
  const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
  const licencePath = licenceNames.map((name) => join(packageRoot, name)).find(existsSync);
  const licenceText = licencePath ? readFileSync(licencePath, 'utf8').trim() : '';
  return {
    id: `${manifest.name || basename(packageRoot)}@${manifest.version || 'unknown'}`,
    licence: typeof manifest.license === 'string' ? manifest.license : 'See package metadata',
    repository: repositoryUrl(manifest.repository),
    licenceText,
  };
}).sort((a, b) => a.id.localeCompare(b.id));

const groups = new Map();
for (const packageInfo of packages) {
  const key = packageInfo.licenceText
    ? createHash('sha256').update(packageInfo.licenceText).digest('hex')
    : `missing:${packageInfo.id}`;
  const group = groups.get(key) || { packages: [], text: packageInfo.licenceText };
  group.packages.push(packageInfo);
  groups.set(key, group);
}

const lines = [
  'THIRD-PARTY SOFTWARE AND FONT NOTICES',
  '=====================================',
  '',
  'Generated from the installed production dependency tree used to build the MorphBrain web demonstration,',
  'plus the three bundled Fontsource packages and Draco decoder package. Data-source terms are documented in',
  'third-party-notices.html.',
  '',
];

for (const group of groups.values()) {
  lines.push('------------------------------------------------------------------------', 'Packages:');
  for (const packageInfo of group.packages) {
    const repository = packageInfo.repository ? ` — ${packageInfo.repository}` : '';
    lines.push(`- ${packageInfo.id} — ${packageInfo.licence}${repository}`);
  }
  lines.push('', group.text || 'No standalone licence file was present in the installed package; see the package metadata above.', '');
}

while (lines.at(-1) === '') lines.pop();
writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Wrote ${packages.length} package notices to ${outputPath}`);
