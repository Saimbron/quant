// Hero screenshots and quick checks of the given pages at 1440, 768 and 390 px.
// Usage: node .tools/newpages.mjs <base-url> <out-dir> <path> [path...]
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
const { Browser } = await import(pathToFileURL(join(homedir(), '.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')).href);

const [base, out, ...paths] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const b = await Browser.launch();
const report = [];
try {
  for (const [w, h, mobile] of [[1440, 900, false], [768, 1024, true], [390, 844, true]]) {
    const p = await b.newPage({ width: w, height: h, mobile, dsf: 1 });
    for (const path of paths) {
      await p.goto(base + path, { settleMs: 2600 });
      const name = `${w}-${path.replace(/[\/.]+/g, '_') || 'home'}`;
      await p.screenshot({ path: join(out, name + '.jpg') });
      const info = await p.eval(`(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        result: document.querySelector('[data-result-text]')?.textContent,
        navScroll: (() => { const n = document.querySelector('.tabs'); return n ? [n.scrollLeft, n.scrollWidth, n.clientWidth] : null; })(),
        yours: document.querySelector('.band.is-yours .big')?.textContent ?? null,
        clipped: [...document.querySelectorAll('h1 [data-line], .doc-row span, .tab strong, .tab span')]
          .filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent).slice(0, 5),
      }))()`);
      report.push({ w, path, ...info });
    }
    report.push({ w, errors: p.consoleErrors.slice() });
    await p.close();
  }
} finally {
  await b.close();
}
console.log(JSON.stringify(report, null, 1));
