// Checks the three ways to give a salary on the net pay calculator. Usage: node .tools/entrada.mjs [base-url]
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { Browser } = await import(pathToFileURL(join(homedir(), '.agents/skills/design-taste-frontend/scripts/lib/cdp.mjs')).href);
const BASE = process.argv[2] || 'http://localhost:4321';
const b = await Browser.launch();
const p = await b.newPage({ width: 1440, height: 900 });
await p.goto(BASE + '/', { settleMs: 1500 });
const out = await p.eval(`(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const q = (s) => document.querySelector(s);
  const state = () => ({
    input: q('[name="bruto"]').value, label: q('[data-entrada-label]').textContent, hint: q('[data-entrada-hint]').textContent,
    result: q('[data-result-text]').textContent, foot: q('[data-out="footLabel"]').textContent, dock: q('[data-dock-label]').textContent,
    range: [q('[data-sync="bruto"]').min, q('[data-sync="bruto"]').max],
    liquido: !q('[data-when="liquidoSub"]').hidden, brutoSub: !q('[data-when="brutoSub"]').hidden,
  });
  const pick = async (v) => { q('input[name="entrada"][value="' + v + '"]').click(); await wait(250); };
  const r = { start: state() };
  await pick('neto'); r.neto = state();
  const i = q('[name="bruto"]'); i.value = '1.900'; i.dispatchEvent(new Event('input', { bubbles: true })); await wait(200);
  r.neto1900 = state();
  await pick('mes'); r.mes = state();
  await pick('anual'); r.anual = state();
  await pick('neto'); await pick('anual'); r.roundTrip = state().input;
  return r;
})()`);
await p.goto('about:blank', { settleMs: 50 });
await p.goto(BASE + '/#entrada=neto&bruto=1500&pagas=12', { settleMs: 1500 });
out.shared = await p.eval(`({ input: document.querySelector('[name="bruto"]').value, result: document.querySelector('[data-result-text]').textContent, label: document.querySelector('[data-entrada-label]').textContent, checked: document.querySelector('input[name="entrada"]:checked').value })`);
out.errors = p.consoleErrors;
console.log(JSON.stringify(out, null, 1));
await b.close();
