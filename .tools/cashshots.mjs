// Hero shots once the money has settled. Usage: node .tools/cashshots.mjs <base-url> <out-dir> <path> [path...]
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
const { Browser, sleep } = await import(pathToFileURL(join(homedir(), '.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')).href);

const [base, out, ...paths] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const widths = (process.env.WIDTHS || '1440,768,390').split(',').map(Number);
const b = await Browser.launch();
const report = [];
try {
  for (const w of widths) {
    const h = w >= 1024 ? 900 : w >= 768 ? 1024 : 844;
    const p = await b.newPage({ width: w, height: h, mobile: w < 1024, dsf: w < 1024 ? 2 : 1 });
    for (const path of paths) {
      await p.goto(base + path, { settleMs: 9000 });
      if (process.env.SCROLL === 'box') { await p.eval(`scrollTo(0, document.querySelector('.coins-box').getBoundingClientRect().top + scrollY - 60)`); await sleep(3500); }
      else if (process.env.SCROLL) { await p.eval(`scrollTo(0, ${process.env.SCROLL})`); await sleep(800); }
      const name = `${w}-${path.replace(/[\/.#=&]+/g, '_') || 'home'}`;
      await p.screenshot({ path: join(out, name + '.jpg'), quality: 85 });
      const box = await p.eval(`(() => { const r = document.querySelector('.coins-box')?.getBoundingClientRect(); return r && [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; })()`);
      const labels = await p.eval(`[...document.querySelectorAll('[data-pile]')].map((l) => { const r = l.getBoundingClientRect(); return l.textContent.trim() + ' @' + Math.round(r.x) + ',' + Math.round(r.y); })`);
      report.push({ w, path, box, labels });
    }
    report.push({ w, errors: p.consoleErrors.slice() });
    await p.close();
  }
} finally {
  await b.close();
}
console.log(JSON.stringify(report));
