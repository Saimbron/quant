import { SITE, ADS_ON } from '../config.js';

// Authorised sellers (IAB ads.txt). Empty until AdSense is configured.
export function GET() {
  const body = ADS_ON
    ? `google.com, ${SITE.ads.client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`
    : '# Sin vendedores autorizados todavía.\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
