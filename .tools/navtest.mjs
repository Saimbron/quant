import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { Browser, sleep } = await import(pathToFileURL(join(homedir(), '.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')).href);
const b = await Browser.launch();
const p = await b.newPage({ width: 1440, height: 900 });
await p.goto('http://localhost:4321/', { settleMs: 3500 });
const out = [];
for (const href of ['/cuota-autonomos/', '/factura-iva-irpf/', '/precio-hora-freelance/', '/', '/cuota-autonomos/']) {
  await p.eval(`document.querySelector('.tab[href="${href}"]').click()`);
  await sleep(3200);
  out.push(await p.eval(`(() => ({ path: location.pathname, coins: document.querySelector('.hero').classList.contains('has-coins'), canvases: document.querySelectorAll('canvas').length, pins: document.querySelectorAll('.pin-spacer').length, result: document.querySelector('[data-result-text]').textContent }))()`));
}
// frame timing while the coins move
const fps = await p.eval(`new Promise((res) => { const i = document.querySelector('[name=ingresos]'); i.value = '4000'; i.dispatchEvent(new Event('input', { bubbles: true })); let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(Math.round(n / 1.5)); }; requestAnimationFrame(f); })`);
console.log(JSON.stringify(out, null, 1), '\nfps', fps, '\nerrors', JSON.stringify(p.consoleErrors));
await b.close();
