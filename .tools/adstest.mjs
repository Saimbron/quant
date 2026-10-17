import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { Browser, sleep } = await import(pathToFileURL(join(homedir(), '.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')).href);
const b = await Browser.launch();
const p = await b.newPage({ width: 1440, height: 900 });
await p.send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI))" });
await p.goto('http://localhost:4322/', { settleMs: 6000 });
const r1 = await p.eval(`({
  loaderLoaded: !!window.adsbygoogle && typeof window.adsbygoogle.loaded !== 'undefined',
  slots: [...document.querySelectorAll('ins.adsbygoogle')].map(i => i.dataset.adsbygoogleStatus + '/' + (i.dataset.adStatus || '-') + '/' + i.offsetHeight),
  csp: window.__csp.slice(0, 10), coins: document.querySelector('.hero').classList.contains('has-coins'),
})`);
await p.eval(`document.querySelector('.tab[href="/factura-iva-irpf/"]').click()`); await sleep(4000);
const r2 = await p.eval(`({ path: location.pathname, slots: [...document.querySelectorAll('ins.adsbygoogle')].map(i => i.dataset.adsbygoogleStatus), csp: window.__csp.slice(0, 10), scripts: [...document.querySelectorAll('script[src*="adsbygoogle"]')].length })`);
console.log(JSON.stringify({ r1, r2, errors: p.consoleErrors.slice(0, 5) }, null, 1));
await b.close();
