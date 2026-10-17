// After the build: write the Content-Security-Policy into dist/_headers.
// Only the inline scripts we actually ship are allowed (by hash); Google Ads and
// Cloudflare Web Analytics hosts are added only when they are switched on in src/config.js.
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { SITE, ADS_ON } from '../src/config.js';

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

const GOOGLE_ADS = {
  script: ['https://pagead2.googlesyndication.com', 'https://*.googlesyndication.com', 'https://*.doubleclick.net',
    'https://www.googletagservices.com', 'https://adservice.google.com', 'https://fundingchoicesmessages.google.com',
    'https://*.adtrafficquality.google', 'https://www.google.com', 'https://www.gstatic.com'],
  frame: ['https://*.googlesyndication.com', 'https://*.doubleclick.net', 'https://www.google.com',
    'https://fundingchoicesmessages.google.com', 'https://*.adtrafficquality.google'],
  connect: ['https://*.googlesyndication.com', 'https://*.doubleclick.net', 'https://*.google.com',
    'https://fundingchoicesmessages.google.com', 'https://*.adtrafficquality.google'],
  img: ['https:'],
};
const CF_ANALYTICS = { script: ['https://static.cloudflareinsights.com'], connect: ['https://cloudflareinsights.com'] };

const add = (base, key) => [
  ...base,
  ...(ADS_ON ? GOOGLE_ADS[key] ?? [] : []),
  ...(SITE.cloudflareAnalytics ? CF_ANALYTICS[key] ?? [] : []),
].join(' ');

const csp = [
  "default-src 'self'",
  `script-src ${add(["'self'", ...hashes], 'script')}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src ${add(["'self'", 'data:'], 'img')}`,
  "media-src 'self'",
  "font-src 'self'",
  `connect-src ${add(["'self'"], 'connect')}`,
  `frame-src ${ADS_ON ? GOOGLE_ADS.frame.join(' ') : "'none'"}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const headersPath = join(dist, '_headers');
let headers = readFileSync(headersPath, 'utf8');
if (!/^\s*Content-Security-Policy:.*$/m.test(headers)) throw new Error('CSP line missing in _headers');
headers = headers.replace(/^(\s*)Content-Security-Policy:.*$/m, (_, indent) => `${indent}Content-Security-Policy: ${csp}`);
// Ad clicks open the advertiser in a popup that must keep working
if (ADS_ON) headers = headers.replace('Cross-Origin-Opener-Policy: same-origin', 'Cross-Origin-Opener-Policy: same-origin-allow-popups');
writeFileSync(headersPath, headers);
console.log(`CSP: ${hashes.size} inline script hash(es)${ADS_ON ? ', Google Ads on' : ''}${SITE.cloudflareAnalytics ? ', Cloudflare Analytics on' : ''}`);
