import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { Browser, sleep } = await import(pathToFileURL(join(homedir(), '.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')).href);
const b = await Browser.launch();
const p = await b.newPage({ width: 1440, height: 900 });
await p.goto('http://localhost:4321/', { settleMs: 3500 });
const top = await p.eval(`document.querySelector('[data-stages]').getBoundingClientRect().top + scrollY`);
const out = [];
for (const [k, dy] of [['h', 450], ['s0', top + 20], ['s1', top + 520], ['s2', top + 1000], ['s3', top + 1420], ['after', top + 1900]]) {
  await p.eval(`scrollTo(0, ${dy})`);
  await sleep(1400);
  await p.screenshot({ path: `.tools/shots/sc-${k}.jpg`, quality: 60 });
  out.push(k + ': ' + await p.eval(`(document.querySelector('[data-st-clause]')?.textContent || '') + ' | pinned=' + (document.querySelector('.pin-spacer') ? 'y' : 'n')`));
}
console.log(out.join('\n'), '\nerrors', JSON.stringify(p.consoleErrors));
await b.close();
