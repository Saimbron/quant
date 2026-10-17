import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { Browser, sleep } = await import(pathToFileURL(join(homedir(), '.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')).href);
const [url, out, w = 1440, h = 900] = process.argv.slice(2);
const b = await Browser.launch({ width: +w, height: +h });
const p = await b.newPage({ width: +w, height: +h, mobile: +w < 800 });
await p.goto(url, { settleMs: 500 });
for (const t of [900, 2600, 4500]) { await sleep(t === 900 ? 900 : t - 900); }
await p.screenshot({ path: out + '-a.jpg', quality: 70 });
// change the salary and capture the split mid-hop and settled
await p.eval(`(() => { const i = document.querySelector('[name=bruto],[name=ingresos],[name=importe],[name=netoMes]'); i.value = '60000'; i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await sleep(350);
await p.screenshot({ path: out + '-b.jpg', quality: 70 });
await sleep(2200);
await p.screenshot({ path: out + '-c.jpg', quality: 70 });
console.log('errors', JSON.stringify(p.consoleErrors), await p.eval(`document.querySelector('.hero').className`));
await b.close();
