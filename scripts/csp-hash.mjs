/*
 * Recomputes the sha256 CSP hash for the inline JSON-LD block in a page and
 * rewrites the script-src directive in place.
 *
 *   node scripts/csp-hash.mjs index.html
 *
 * The site ships a strict Content-Security-Policy with no 'unsafe-inline'.
 * Structured data has to be inline to be read by crawlers, so its exact bytes
 * are allowlisted by hash instead. Run this after any edit to the JSON-LD, or
 * the browser will silently drop the block and log a CSP violation.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const target = resolve(process.argv[2] || 'index.html');
const source = readFileSync(target, 'utf8');

const block = source.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
if (!block) throw new Error(`No inline JSON-LD block found in ${target}`);

JSON.parse(block[1]);

const digest = createHash('sha256').update(block[1], 'utf8').digest('base64');
const directive = `'sha256-${digest}'`;

const updated = source.replace(
  /(script-src 'self')(?: '(?:sha256|SHA256)-[^']*'| 'sha256-JSONLD-HASH-PLACEHOLDER')?/,
  `$1 ${directive}`,
);

if (updated === source) {
  console.log(`${target}: already up to date (${directive})`);
} else {
  writeFileSync(target, updated);
  console.log(`${target}: script-src now allows ${directive}`);
}
