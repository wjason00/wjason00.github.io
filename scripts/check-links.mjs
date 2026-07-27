/*
 * Fails the build if any internal link or asset reference in the assembled
 * site does not resolve, including in-page fragment targets.
 *
 *   node scripts/check-links.mjs _site
 *
 * External URLs (http, https, mailto, data) are out of scope on purpose: the
 * deploy must not depend on someone else's uptime. This only guarantees that
 * the site does not link to itself incorrectly.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const siteRoot = resolve(process.argv[2] || '_site');

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

const allFiles = walk(siteRoot);
const htmlFiles = allFiles.filter((file) => file.endsWith('.html'));

function exists(path) {
  try {
    const stats = statSync(path);
    return stats.isDirectory() ? statSync(join(path, 'index.html')).isFile() : stats.isFile();
  } catch (error) {
    return false;
  }
}

/* Good enough for hand-authored static pages: id="..." and name="..." only. */
function fragmentsOf(html) {
  const ids = new Set();
  for (const match of html.matchAll(/\b(?:id|name)\s*=\s*"([^"]+)"/g)) ids.add(match[1]);
  return ids;
}

const fragmentCache = new Map();
function fragmentsForFile(file) {
  if (!fragmentCache.has(file)) {
    fragmentCache.set(file, exists(file) ? fragmentsOf(readFileSync(file, 'utf8')) : null);
  }
  return fragmentCache.get(file);
}

const problems = [];

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  const here = relative(siteRoot, file).split(sep).join('/');
  const references = new Set();

  for (const match of html.matchAll(/\b(?:href|src|poster)\s*=\s*"([^"]*)"/g)) references.add(match[1]);

  for (const raw of references) {
    const value = raw.replace(/&amp;/g, '&').trim();
    if (!value) continue;
    if (/^(?:https?:|mailto:|tel:|data:|blob:|javascript:|#!)/i.test(value)) continue;

    const [pathPart, fragment] = value.split('#');

    let targetFile;
    if (!pathPart) {
      targetFile = file;
    } else if (pathPart.startsWith('/')) {
      targetFile = join(siteRoot, pathPart);
    } else {
      targetFile = resolve(dirname(file), pathPart.split('?')[0]);
    }

    if (!exists(targetFile)) {
      problems.push(`${here} → ${value} (missing file)`);
      continue;
    }

    if (!fragment) continue;

    let fragmentHost = targetFile;
    try {
      if (statSync(fragmentHost).isDirectory()) fragmentHost = join(fragmentHost, 'index.html');
    } catch (error) {
      continue;
    }
    if (!fragmentHost.endsWith('.html')) continue;

    const ids = fragmentsForFile(fragmentHost);
    if (ids && !ids.has(fragment)) {
      problems.push(`${here} → ${value} (no #${fragment} in ${relative(siteRoot, fragmentHost).split(sep).join('/')})`);
    }
  }
}

if (problems.length) {
  console.error(`Broken internal references (${problems.length}):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`Checked ${htmlFiles.length} HTML files in ${relative(process.cwd(), siteRoot) || '.'} — all internal references resolve.`);
