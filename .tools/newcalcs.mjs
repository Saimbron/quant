// Interaction checks for the finiquito, paro and comparison calculators.
// Usage: node .tools/newcalcs.mjs [base-url]
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { Browser } = await import(pathToFileURL(join(homedir(), '.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')).href);

const BASE = process.argv[2] || 'http://localhost:4321';
const b = await Browser.launch();
const out = {};
const helpers = `
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const res = () => document.querySelector('[data-result-text]').textContent;
  const out = (k) => document.querySelector('[data-out="' + k + '"]')?.textContent;
  const set = (name, v) => { const el = document.querySelector('[name="' + name + '"]'); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
  const yours = () => document.querySelector('.band.is-yours .big')?.textContent ?? null;
`;
try {
  const p = await b.newPage({ width: 1440, height: 900 });
  await p.evalOnNewDocument?.('try { localStorage.clear() } catch {}');

  await p.goto(BASE + '/finiquito-indemnizacion/', { settleMs: 1500 });
  out.finiquito = await p.eval(`(async () => { ${helpers}
    const r = {};
    r.todayDefault = document.querySelector('[name="baja"]').value;
    set('alta', '2021-03-01'); set('baja', '2026-10-31'); set('bruto', '28000');
    r.base = res(); r.antiguedad = out('antiguedad');
    const sel = document.querySelector('[name="motivo"]'); sel.value = 'objetivo'; sel.dispatchEvent(new Event('input', { bubbles: true }));
    r.objetivo = [res(), out('indemPct'), yours()];
    sel.value = 'voluntaria'; sel.dispatchEvent(new Event('input', { bubbles: true }));
    r.voluntaria = [res(), out('indemnizacion')];
    set('alta', '1990-01-01'); sel.value = 'objetivo'; sel.dispatchEvent(new Event('input', { bubbles: true }));
    r.topeNote = !document.querySelector('[data-when="tope"]').hidden;
    document.querySelector('.band.motivos[data-mark="improcedente"] button').click(); await wait(300);
    r.useButton = [sel.value, yours()];
    document.querySelector('input[name="pagas"][value="12"]').click(); await wait(200);
    r.pagas12 = out('pagas');
    const baja = document.querySelector('[name="baja"]'); baja.focus(); set('baja', ''); baja.blur(); await wait(100);
    r.emptyDate = [baja.value, res()];
    return r;
  })()`);

  await p.goto('about:blank', { settleMs: 100 });
  await p.goto(BASE + '/finiquito-indemnizacion/#bruto=1e400&alta=2020-02-30&baja=%3Cscript%3E&motivo=x&vacaciones=999', { settleMs: 1500 });
  out.hostile = await p.eval(`(() => ({ res: document.querySelector('[data-result-text]').textContent, alta: document.querySelector('[name="alta"]').value, baja: document.querySelector('[name="baja"]').value, motivo: document.querySelector('[name="motivo"]').value, vac: document.querySelector('[name="vacaciones"]').value }))()`);

  await p.goto(BASE + '/prestacion-paro/', { settleMs: 1500 });
  out.paro = await p.eval(`(async () => { ${helpers}
    const r = { start: res(), yours: yours() };
    const plus = document.querySelector('[data-stepper="meses"] [data-step="6"]');
    for (let i = 0; i < 10; i++) plus.click();
    await wait(200);
    r.max = [document.querySelector('[name="meses"]').value, out('duracion'), yours()];
    document.querySelector('input[name="hijos"][value="2"]').click(); await wait(200);
    r.hijos2 = [res(), out('p70'), document.querySelector('[data-when="tope"]').hidden];
    set('bruto', '9000'); r.minimo = [out('p70'), !document.querySelector('[data-when="minimo"]').hidden];
    document.querySelector('.band.duracion[data-mark="120"] button').click(); await wait(300);
    r.useButton = [document.querySelector('[name="meses"]').value, document.querySelector('[name="meses-out"]').textContent, yours(), out('p60')];
    return r;
  })()`);

  await p.goto(BASE + '/asalariado-o-autonomo/', { settleMs: 1500 });
  out.comparar = await p.eval(`(async () => { ${helpers}
    const r = { start: res(), extra: out('extra') };
    document.querySelector('[name="tarifaPlana"]').click(); await wait(200);
    r.tarifa = res();
    document.querySelectorAll('.band.compara button')[0].click(); await wait(300);
    r.useButton = [document.querySelector('[name="bruto"]').value, document.querySelector('[name="tarifaPlana"]').checked, res()];
    set('bruto', '0'); r.zero = [res(), out('extra')];
    return r;
  })()`);

  await p.goto(BASE + '/cuota-autonomos/', { settleMs: 1500 });
  out.autonomos = await p.eval(`(async () => { ${helpers}
    set('ingresos', '700'); await wait(400);
    const a = [yours(), document.querySelector('[role="tab"][aria-selected="true"]').textContent];
    set('ingresos', '5000'); await wait(400);
    return { low: a, high: [yours(), document.querySelector('[role="tab"][aria-selected="true"]').textContent] };
  })()`);

  out.errors = p.consoleErrors.slice();
} finally {
  await b.close();
}
console.log(JSON.stringify(out, null, 1));
