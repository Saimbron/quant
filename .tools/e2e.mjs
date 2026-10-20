// Browser checks: renders each page in light and dark, exercises the calculators, collects errors.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { Browser, sleep } = await import(pathToFileURL(join(homedir(), '.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')).href);
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:4321';
const OUT = new URL('./shots/', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
mkdirSync(OUT, { recursive: true });
const pages = ['/', '/finiquito-indemnizacion/', '/prestacion-paro/', '/cuota-autonomos/', '/factura-iva-irpf/', '/precio-hora-freelance/', '/asalariado-o-autonomo/', '/ca/', '/ca/quitanca-indemnitzacio/', '/ca/prestacio-atur/', '/ca/preu-hora-freelance/', '/ca/assalariat-o-autonom/', '/legal/'];
const b = await Browser.launch();
const results = [];
const res = () => document.querySelector('[data-result-text]')?.textContent;
try {
  for (const scheme of ['light', 'dark']) {
    for (const [w, h, mobile] of [[1440, 900, false], [768, 1024, true], [390, 844, true]]) {
      const p = await b.newPage({ width: w, height: h, mobile, dsf: 1 });
      await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
      for (const path of pages) {
        await p.goto(BASE + path, { settleMs: 2400 });
        const name = `${scheme}-${w}-${path.replace(/[\/.]+/g, '_') || 'home'}`;
        if (scheme === 'light' || path === '/') await p.screenshot({ path: OUT + name + '.jpg' });
        const info = await p.eval(`(() => ({
          overflow: document.documentElement.scrollWidth > innerWidth,
          result: document.querySelector('[data-result-text]')?.textContent,
          roll: document.querySelector('[data-roll]')?.innerText.replace(/\\s+/g, ''),
        }))()`);
        results.push({ scheme, w, path, ...info });
      }
      results.push({ errors: p.consoleErrors.slice() });
      await p.close();
    }
  }

  const p = await b.newPage({ width: 1440, height: 900 });
  // Hostile shared link must not hang and must be sanitised
  await p.goto(BASE + '/#bruto=45000&pagas=x&hijos=1e309&menores3=9&situacion=%22x', { settleMs: 1500 });
  results.push({ hostile: await p.eval(`(() => ({ result: document.querySelector('[data-result-text]').textContent, hijos: document.querySelector('[name=hijos]').value, menores3: document.querySelector('[name=menores3]').value, url: location.href }))()`) });

  await p.goto(BASE + '/', { settleMs: 1500 });
  const check = await p.eval(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const res = () => document.querySelector('[data-result-text]').textContent;
    const out = {};
    const input = document.querySelector('[name="bruto"]');
    out.start = res();
    input.value = '45000'; input.dispatchEvent(new Event('input', { bubbles: true }));
    out.after45k = res();
    input.value = '30000.50'; input.dispatchEvent(new Event('input', { bubbles: true }));
    out.dotDecimal = res();
    input.value = '45.000'; input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('input[name="pagas"][value="12"]').click(); await wait(400);
    out.after12 = res();
    out.extraHidden = document.querySelector('[data-when="extra"]').hidden;
    out.hijosFieldsHidden = [...document.querySelectorAll('[data-when="hijos"]')].every((e) => getComputedStyle(e).display === 'none');
    const st = document.querySelector('[data-st-range]'); st.value = 2; st.dispatchEvent(new Event('input', { bubbles: true }));
    st.value = 0; st.dispatchEvent(new Event('input', { bubbles: true }));
    st.value = 1; st.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(400);
    out.stage1 = document.querySelector('[data-st-clause]').textContent + ' | ' + document.querySelector('[data-st-label]').textContent;
    out.figDays = document.querySelector('[data-fig-days]').textContent;
    document.querySelectorAll('[data-faq-q]')[2].click(); await wait(300);
    out.faqA11y = getComputedStyle(document.querySelector('[data-faq-a="2"]')).display !== 'none';
    [...document.querySelectorAll('[data-use]')].find((b) => JSON.parse(b.dataset.use).bruto === 20000).click(); await wait(600);
    out.afterUse = res() + ' / ' + document.querySelector('[name="bruto"]').value + ' / focus:' + document.activeElement.name;
    out.dockInert = document.querySelector('[data-dock]').inert;
    await wait(1200);
    out.announce = document.querySelector('[data-announce]').textContent;
    const big = document.querySelector('[name="bruto"]'); big.value = '9999999'; big.dispatchEvent(new Event('input', { bubbles: true }));
    out.bigClass = document.querySelector('[data-result]').className;
    return out;
  })()`);
  results.push({ interaction: 'sueldo', ...check });

  await p.goto(BASE + '/cuota-autonomos/', { settleMs: 1500 });
  const aut = await p.eval(`(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const i = document.querySelector('[name="ingresos"]');
    i.value = '800'; i.dispatchEvent(new Event('input', { bubbles: true })); await wait(300);
    const yours = document.querySelector('.band.is-yours')?.dataset.mark;
    document.querySelector('[name="tarifaPlana"]').click(); await wait(400);
    const plana = document.querySelector('[data-result-text]').textContent;
    document.querySelector('.tab[href="/factura-iva-irpf/"]').click(); await wait(1800);
    const after = { url: location.pathname, h1: document.querySelector('h1').textContent.trim(), stage: document.querySelector('.hero').dataset.stage };
    const imp = document.querySelector('[name="importe"]');
    imp.value = '100,03'; imp.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(300);
    after.factura = [...document.querySelectorAll('.doc [data-out]')].map((e) => e.dataset.out + '=' + e.textContent).join(' ') + ' total=' + document.querySelector('[data-result-text]').textContent;
    return { yours, plana, ...after };
  })()`);
  results.push({ interaction: 'autonomos+nav+factura', ...aut });
  results.push({ errors: p.consoleErrors });
  await p.close();
} finally {
  await b.close();
}
console.log(JSON.stringify(results.filter((r) => r.interaction || r.hostile || r.errors?.length || r.overflow || !('scheme' in r)), null, 1));
console.log('pages checked:', results.filter((r) => r.scheme).length, 'overflow:', results.filter((r) => r.overflow).map((r) => `${r.scheme}-${r.w}${r.path}`));
