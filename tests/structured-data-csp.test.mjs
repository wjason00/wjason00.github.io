import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

for (const file of ['index.html', 'work.html']) {
  test(`${file} allows its LF-normalized JSON-LD in the CSP`, () => {
    const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\r\n?/g, '\n');
    const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    const policy = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
    assert.ok(jsonLd, 'inline JSON-LD is present');
    assert.ok(policy, 'the page declares a CSP');
    const digest = createHash('sha256').update(jsonLd[1], 'utf8').digest('base64');
    const sources = policy[1].match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1].split(/\s+/) ?? [];
    assert.ok(sources.includes(`'sha256-${digest}'`), 'script-src allows the exact script text');
  });
}
