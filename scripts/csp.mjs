// After the build: allow only the inline scripts we actually ship, by hash, in the CSP.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const dist = 'dist';
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : [];
});

const hashes = new Set();
const inline = /<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g;
for (const file of walk(dist)) {
  for (const m of readFileSync(file, 'utf8').matchAll(inline)) {
    hashes.add(`'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  }
}

const headersPath = join(dist, '_headers');
const headers = readFileSync(headersPath, 'utf8');
if (!headers.includes('__INLINE_SCRIPT_HASHES__')) throw new Error('CSP placeholder missing in _headers');
writeFileSync(headersPath, headers.replace('__INLINE_SCRIPT_HASHES__', [...hashes].join(' ')));
console.log(`CSP: ${hashes.size} inline script hash(es)`);
