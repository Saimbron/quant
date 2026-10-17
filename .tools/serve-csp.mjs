// Serves dist/ with the same headers Cloudflare will send (from dist/_headers).
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
const port = +process.argv[2] || 4322;
const raw = readFileSync('dist/_headers', 'utf8');
const globalHeaders = {};
let inGlobal = false;
for (const line of raw.split(/\r?\n/)) {
  if (/^\S/.test(line)) inGlobal = line.trim() === '/*';
  else if (inGlobal && line.includes(':')) { const i = line.indexOf(':'); globalHeaders[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webm': 'video/webm', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
createServer((req, res) => {
  let p = join('dist', decodeURIComponent(req.url.split('?')[0].split('#')[0]));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end(readFileSync('dist/404.html')); }
  res.writeHead(200, { ...globalHeaders, 'content-type': types[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
}).listen(port, () => console.log('csp server on', port));
