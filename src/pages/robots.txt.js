import { absolute, PREVIEW } from '../lib/paths.js';

export function GET() {
  // The preview stays out of search engines; the real domain is open and lists its sitemap
  const body = PREVIEW
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${absolute('/sitemap-index.xml')}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
