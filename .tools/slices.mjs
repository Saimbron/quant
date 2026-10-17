import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { Browser, sleep } = await import(pathToFileURL(join(homedir(), '.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')).href);
const [url, prefix, w = 390, scheme = 'light', n = 6] = process.argv.slice(2);
const b = await Browser.launch();
const p = await b.newPage({ width: +w, height: 844, mobile: +w < 800 });
await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
await p.goto(url, { settleMs: 1800 });
for (let i = 0; i < +n; i++) {
  await p.eval(`scrollTo(0, ${i} * 800)`);
  await sleep(1300);
  await p.screenshot({ path: `${prefix}-${i}.jpg`, quality: 60 });
}
await b.close();
