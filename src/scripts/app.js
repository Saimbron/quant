import { compute, fill, split, makeFormat } from '../lib/calcs.js';
import { LIMITS } from '../lib/tax.js';

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORE = 'quant:v2:';

// Everything a page sets up (observers, timers, frames) is torn down before Astro swaps it out
let cleanups = [];
const onCleanup = (fn) => cleanups.push(fn);
document.addEventListener('astro:before-swap', () => {
  cleanups.forEach((fn) => { try { fn(); } catch {} });
  cleanups = [];
});
document.addEventListener('astro:after-swap', () => {
  document.documentElement.classList.add('js', 'swapped');
});

// Fields each calculator accepts, with their allowed values
const SCHEMA = {
  sueldo: {
    bruto: ['money'], pagas: ['enum', ['14', '12']], contrato: ['enum', ['indefinido', 'temporal']],
    hijos: ['int', 0, LIMITS.hijos], menores3: ['int', 0, LIMITS.hijos], compartidos: ['bool'], situacion: ['enum', ['3', '2', '1']],
  },
  autonomos: { ingresos: ['money'], gastos: ['money'], tarifaPlana: ['bool'], societario: ['bool'] },
  factura: { importe: ['money'], modo: ['enum', ['base', 'total']], iva: ['enum', ['21', '10', '4', '0']], irpf: ['enum', ['15', '7', '0']] },
  hora: { netoMes: ['money'], gastosMes: ['money'], horasSemana: ['int', 5, 60], semanasLibres: ['int', 0, 20], tarifaPlana: ['bool'] },
};

// Accepts Spanish format ("30.000,50", "30.000") and plain numbers ("30000.5")
export function parseMoney(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').trim().replace(/[\s€ ]/g, '');
  if (!s) return 0;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

const toBool = (v) => v === true || v === 'true' || v === '1' || v === 1 || v === 'on';

function sanitize(calc, raw) {
  const schema = SCHEMA[calc];
  const out = {};
  if (!schema || !raw || typeof raw !== 'object') return out;
  for (const [key, [type, a, b]] of Object.entries(schema)) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (type === 'money') out[key] = Math.round(Math.min(LIMITS.money, Math.max(0, parseMoney(v))) * 100) / 100;
    else if (type === 'int') { const n = Math.trunc(Number(v)); if (Number.isFinite(n)) out[key] = Math.min(b, Math.max(a, n)); }
    else if (type === 'enum') { if (a.includes(String(v))) out[key] = String(v); }
    else if (type === 'bool') out[key] = toBool(v);
  }
  if ('menores3' in out) out.menores3 = Math.min(out.menores3, out.hijos ?? 0);
  return out;
}

function setPct(range) {
  const min = +range.min || 0;
  const max = +range.max || 100;
  const pct = ((+range.value - min) / (max - min)) * 100;
  range.style.setProperty('--pct', `${Math.max(0, Math.min(100, pct))}%`);
}

function readStore(calc) {
  try { return JSON.parse(localStorage.getItem(STORE + calc) || 'null'); } catch { return null; }
}
function writeStore(calc, state) {
  try { localStorage.setItem(STORE + calc, JSON.stringify(state)); } catch {}
}

// Shared links carry the figures after "#", so they never reach the server
function readShared() {
  const raw = {};
  const hash = location.hash.slice(1);
  if (hash.includes('=')) new URLSearchParams(hash).forEach((v, k) => { raw[k] = v; });
  new URLSearchParams(location.search).forEach((v, k) => { if (!(k in raw)) raw[k] = v; });
  return raw;
}

function swapText(el, text, animate) {
  if (!el) return;
  clearTimeout(el._t);
  if (el._pending === text || (!el._pending && el.textContent === text)) return;
  if (!animate || reduce()) {
    el._pending = null;
    el.classList.remove('is-swapping');
    el.textContent = text;
    return;
  }
  el._pending = text;
  el.classList.add('is-swapping');
  el._t = setTimeout(() => { el.textContent = text; el._pending = null; el.classList.remove('is-swapping'); }, 180);
}

// Odometer: each digit is a column of 0-9 that slides to its value
function rollTo(el, text, { from0 = false } = {}) {
  const shape = text.replace(/\d/g, '0');
  if (el._shape !== shape) {
    el.innerHTML = [...text].map((ch, i) => (/\d/.test(ch)
      ? `<span class="dg"><span class="dg-col" style="--d:${text.length - i};transform:translateY(-${from0 ? 0 : ch}0%)"></span></span>`
      : `<span class="dg-sep">${ch}</span>`)).join('');
    el._shape = shape;
    if (!from0) return;
  }
  const cols = el.querySelectorAll('.dg-col');
  const digits = text.replace(/\D/g, '');
  const apply = () => cols.forEach((col, i) => { col.style.transform = `translateY(-${digits[i]}0%)`; });
  if (from0) requestAnimationFrame(() => requestAnimationFrame(apply));
  else apply();
}

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

const whenIdle = (fn, timeout = 1200) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 500));

export function boot() {
  initLoops();
  initReveal();
  initClock();
  initFaq();
  initTabs();
  const hero = document.querySelector('[data-calc]');
  let coinsApi = null;

  // Scroll choreography loads after the page is usable, and never under reduced motion
  if (!reduce()) {
    whenIdle(() => {
      import('./motion.js').then(({ initMotion }) => {
        if (!document.body.contains(hero ?? document.body)) return;
        const off = initMotion({
          hero,
          coins: () => coinsApi,
          onStage: (i) => {
            const range = document.querySelector('[data-st-range]');
            if (!range || +range.value === i) return;
            range.value = i;
            range.dispatchEvent(new Event('input', { bubbles: true }));
          },
        });
        onCleanup(off);
      }).catch(() => {});
    });
  }
  if (!hero) return;

  const calc = hero.dataset.calc;
  const locale = hero.dataset.locale;
  const f = makeFormat(locale);
  const form = hero.querySelector('form.calc');
  const doc = hero.querySelector('.doc');
  const resultEl = hero.querySelector('[data-result]');
  const resultText = hero.querySelector('[data-result-text]');
  const rollEl = hero.querySelector('[data-roll]');
  const bignum = hero.querySelector('[data-bignum]');
  const announcer = hero.querySelector('[data-announce]');
  const dock = document.querySelector('[data-dock]');
  const dockValue = document.querySelector('[data-dock-value]');
  const fmt0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: 'always' });
  const unit = calc === 'hora' ? '/h' : '';
  const label = doc.getAttribute('aria-label');
  let sharedPending = false;
  let lastCoins = null;
  let coinsReady = false;

  // Build the roll structure once: integer digits, then cents in the smaller size
  rollEl.innerHTML = '<span data-roll-int></span><small><span data-roll-dec></span><span class="dg-sep">&nbsp;€</span></small>';
  const rollInt = rollEl.querySelector('[data-roll-int]');
  const rollDec = rollEl.querySelector('[data-roll-dec]');

  // ---------- State ----------
  function readForm() {
    const raw = {};
    for (const el of form.elements) {
      if (!el.name || el.name.endsWith('-out')) continue;
      if (el.type === 'radio') { if (el.checked) raw[el.name] = el.value; }
      else if (el.type === 'checkbox') raw[el.name] = el.checked;
      else raw[el.name] = el.value;
    }
    return sanitize(calc, raw);
  }

  function writeForm(state) {
    for (const [k, v] of Object.entries(state)) {
      form.querySelectorAll(`[name="${k}"]`).forEach((el) => {
        if (el.type === 'radio') el.checked = String(el.value) === String(v);
        else if (el.type === 'checkbox') el.checked = !!v;
        else if (el.dataset.money !== undefined) el.value = fmt0.format(+v || 0);
        else el.value = v;
      });
      const range = form.querySelector(`[data-sync="${k}"]`);
      if (range) { range.value = v; setPct(range); }
      const out = form.querySelector(`output[name="${k}-out"]`);
      if (out) out.textContent = v;
    }
  }

  const shared = sanitize(calc, readShared());
  if (Object.keys(shared).length) { writeForm(shared); sharedPending = true; }
  else { const stored = sanitize(calc, readStore(calc)); if (Object.keys(stored).length) writeForm(stored); }
  form.querySelectorAll('[data-sync]').forEach(setPct);

  // ---------- Render ----------
  function paintResult(value, opts) {
    const { int, dec } = split(value, locale);
    rollTo(rollInt, int, opts);
    rollTo(rollDec, dec, opts);
    resultEl.classList.toggle('is-long', int.length > 7 && int.length <= 10);
    resultEl.classList.toggle('is-huge', int.length > 10);
    resultText.textContent = f.eur(value) + unit;
    if (bignum) bignum.textContent = int;
  }

  let announceT = 0;
  function announce(value) {
    clearTimeout(announceT);
    announceT = setTimeout(() => { if (announcer) announcer.textContent = `${label}: ${f.eur(value)}${unit}`; }, 800);
  }
  onCleanup(() => clearTimeout(announceT));

  function render({ announce: say = true, from0 = false } = {}) {
    const s = readForm();
    // Keep the "under 3" stepper within the number of children
    const m3 = form.querySelector('input[name="menores3"]');
    if (m3 && +m3.value !== (s.menores3 ?? 0)) writeForm({ menores3: s.menores3 ?? 0 });

    const r = compute(calc, s, locale);
    const changedRows = [];
    for (const [k, v] of Object.entries(r.out)) {
      hero.querySelectorAll(`[data-out="${k}"]`).forEach((el) => {
        if (el.textContent === v) return;
        el.textContent = v;
        const row = el.closest('.doc-row');
        if (row) changedRows.push(row);
      });
    }
    if (!reduce() && !from0) {
      for (const row of new Set(changedRows)) {
        row.animate([{ backgroundColor: 'rgba(214, 224, 178, 0.9)' }, { backgroundColor: 'rgba(214, 224, 178, 0)' }], { duration: 700, easing: 'ease-out' });
      }
    }

    paintResult(r.result, { from0 });
    lastCoins = r.coins;
    if (coinsReady) coinsApi?.setValues(r.coins);
    if (dockValue) dockValue.textContent = f.eur(r.result) + unit;
    if (say) announce(r.result);

    hero.querySelectorAll('[data-when="hijos"]').forEach((el) => { el.hidden = !(s.hijos > 0); });
    hero.querySelectorAll('[data-when="extra"]').forEach((el) => { el.hidden = s.pagas !== '14'; });
    hero.querySelectorAll('[data-when="solidaridad"]').forEach((el) => { el.hidden = !(r.raw.lineas?.solidaridad > 0); });

    if (r.stages) renderStages(r);
    if (calc === 'autonomos') markTramo(r.tramo);
    syncFigure(s);
    writeStore(calc, s);
    return { s, r };
  }

  // A shared link is applied once; as soon as the visitor edits, the address drops the old figures
  function consumeShared() {
    if (!sharedPending) return;
    sharedPending = false;
    history.replaceState(history.state, '', location.pathname);
  }

  // ---------- Inputs ----------
  form.addEventListener('input', (e) => {
    const el = e.target;
    consumeShared();
    if (el.dataset.sync) {
      const money = form.querySelector(`[name="${el.dataset.sync}"]`);
      money.value = fmt0.format(+el.value);
      setPct(el);
    } else if (el.dataset.money !== undefined) {
      const range = form.querySelector(`[data-sync="${el.name}"]`);
      if (range) { range.value = parseMoney(el.value); setPct(range); }
    }
    render();
  });

  form.addEventListener('focusout', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.money !== undefined) el.value = fmt0.format(Math.min(LIMITS.money, parseMoney(el.value)));
  });

  form.querySelectorAll('[data-money]').forEach((el) => {
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      const range = form.querySelector(`[data-sync="${el.name}"]`);
      const stepSize = range ? +range.step : 100;
      const next = Math.min(LIMITS.money, Math.max(0, parseMoney(el.value) + (e.key === 'ArrowUp' ? 1 : -1) * stepSize * (e.shiftKey ? 10 : 1)));
      el.value = fmt0.format(next);
      if (range) { range.value = next; setPct(range); }
      consumeShared();
      render();
    });
  });

  form.querySelectorAll('[data-stepper]').forEach((box) => {
    const hidden = box.querySelector('input[type="hidden"]');
    const out = box.querySelector('output');
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]');
      if (!b) return;
      const min = +hidden.dataset.min;
      let max = +hidden.dataset.max;
      if (hidden.name === 'menores3') max = Math.min(max, +(form.querySelector('input[name="hijos"]')?.value || 0));
      const v = Math.max(min, Math.min(max, +hidden.value + +b.dataset.step));
      hidden.value = v;
      out.textContent = v;
      consumeShared();
      render();
    });
  });

  // ---------- Share ----------
  const toast = document.querySelector('[data-toast]');
  let toastT = 0;
  const showToast = (msg) => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-on');
    clearTimeout(toastT);
    toastT = setTimeout(() => toast.classList.remove('is-on'), 2400);
  };
  onCleanup(() => clearTimeout(toastT));
  form.querySelector('[data-share]')?.addEventListener('click', async () => {
    const s = readForm();
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(s)) params.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    const url = `${location.origin}${location.pathname}#${params}`;
    const copiedMsg = document.documentElement.lang === 'ca' ? 'Enllaç copiat' : 'Enlace copiado';
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      try { await navigator.share({ title: document.title, url }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); showToast(copiedMsg); }
    catch { showToast(url); }
  });

  // ---------- Dock (phone): visible only while the result is below the screen ----------
  if (dock && 'IntersectionObserver' in window) {
    const setDock = (on) => {
      dock.classList.toggle('is-on', on);
      dock.setAttribute('aria-hidden', on ? 'false' : 'true');
      dock.inert = !on;
    };
    const io = new IntersectionObserver(([entry]) => {
      setDock(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    }, { threshold: 0.15 });
    io.observe(doc.querySelector('.doc-foot'));
    onCleanup(() => io.disconnect());
  }

  // ---------- Tilt: the sheet follows the pointer with a little lag ----------
  const tilt = hero.querySelector('[data-tilt]');
  if (tilt && matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce()) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      tilt.style.transform = `perspective(1400px) rotateY(${(cx * 7).toFixed(3)}deg) rotateX(${(-cy * 5).toFixed(3)}deg)`;
      raf = Math.abs(tx - cx) > 0.0005 || Math.abs(ty - cy) > 0.0005 ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width - 0.5;
      ty = (e.clientY - r.top) / r.height - 0.5;
      coinsApi?.setPointer(tx, ty);
      kick();
    });
    hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; coinsApi?.setPointer(0, 0); kick(); });
    onCleanup(() => cancelAnimationFrame(raf));
  }

  // ---------- Stages ----------
  const stagesEl = document.querySelector('[data-stages]');
  let stI18n = null;
  let lastStages = null;
  let stage = 0;
  if (stagesEl) {
    stI18n = JSON.parse(stagesEl.querySelector('[data-st-i18n]').textContent);
    const range = stagesEl.querySelector('[data-st-range]');
    range.addEventListener('input', () => {
      stage = Math.max(0, Math.min(3, +range.value));
      range.style.setProperty('--pct', `${(stage / 3) * 100}%`);
      range.setAttribute('aria-valuetext', stI18n.names[stage]);
      paintStage(true);
    });
  }

  function paintStage(animate) {
    if (!stagesEl || !lastStages) return;
    const st = lastStages;
    swapText(stagesEl.querySelector('[data-st-clause]'), fill(stI18n.clauses[stage], st.vars), animate);
    swapText(stagesEl.querySelector('[data-st-note]'), fill(stI18n.notes[stage], st.vars), animate);
    swapText(stagesEl.querySelector('[data-st-amount]'), st.amounts[stage], animate);
    stagesEl.querySelector('[data-st-label]').textContent = stI18n.labels[stage];
    const focus = st.focus[stage];
    const total = st.segs.reduce((a, x) => a + x.v, 0) || 1;
    stagesEl.querySelectorAll('.meter-bar span').forEach((el, i) => {
      el.style.flexGrow = String(st.segs[i].v / total);
      el.classList.toggle('dim', focus !== -1 && focus !== i);
    });
    stagesEl.querySelectorAll('.meter-list li').forEach((li, i) => li.classList.toggle('is-on', focus === -1 || focus === i));
    stagesEl.querySelectorAll('[data-st-row]').forEach((el, i) => { el.textContent = st.rows[i]; });
    stagesEl.querySelectorAll('.stages-names li').forEach((li, i) => li.classList.toggle('is-on', i === stage));
  }

  function renderStages(r) {
    lastStages = r.stages;
    paintStage(false);
  }

  // ---------- Figure (days for taxes) ----------
  const fig = document.querySelector('[data-fig]');
  let figTouched = false;
  function paintFigure(state, bruto) {
    const r = compute('sueldo', { ...state, bruto }, locale);
    const days = r.raw.diasHacienda;
    document.querySelector('[data-fig-days]').textContent = days;
    document.querySelector('[data-fig-out]').textContent = f.eur0(bruto);
    const weeks = Math.round(days / 7);
    document.querySelectorAll('.figure-year i').forEach((el, i) => el.classList.toggle('on', i < weeks));
  }
  function syncFigure(s) {
    if (!fig || s.bruto == null) return;
    if (!figTouched) { fig.value = Math.max(+fig.min, Math.min(+fig.max, s.bruto)); setPct(fig); }
    paintFigure(s, figTouched ? +fig.value : s.bruto);
  }
  if (fig) {
    setPct(fig);
    fig.addEventListener('input', () => { figTouched = true; setPct(fig); paintFigure(readForm(), +fig.value); });
  }

  // ---------- Table "use" buttons: load the row with the table's own assumptions ----------
  document.querySelectorAll('[data-use]').forEach((b) => {
    b.addEventListener('click', () => {
      writeForm({ bruto: b.dataset.use, pagas: b.dataset.pagas, contrato: 'indefinido', hijos: 0, menores3: 0, situacion: '3', compartidos: true });
      figTouched = false;
      consumeShared();
      render();
      hero.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth' });
      form.querySelector('[name="bruto"]')?.focus({ preventScroll: true });
    });
  });

  function markTramo(idx) {
    const yours = document.documentElement.lang === 'ca' ? 'El teu tram' : 'Tu tramo';
    document.querySelectorAll('[data-tramo]').forEach((b) => {
      const on = +b.dataset.tramo === idx;
      b.classList.toggle('is-yours', on);
      const tag = b.querySelector('.tag');
      if (tag) tag.textContent = on ? yours : '';
    });
    const want = idx < 3 ? 0 : 1;
    const tabsBox = document.querySelector('[data-tabs]');
    if (tabsBox && tabsBox._select && tabsBox._current !== want) tabsBox._select(want, false);
  }

  // ---------- 3D coins: loaded on idle, only where WebGL works ----------
  const coinCanvas = hero.querySelector('[data-coins]');
  if (coinCanvas && webglOK()) {
    whenIdle(() => {
      import('./coins.js').then(({ mountCoins }) => {
        if (!coinCanvas.isConnected) return;
        coinsApi = mountCoins(coinCanvas, { reduced: reduce() });
        hero.classList.add('has-coins');
        onCleanup(() => { coinsApi?.destroy(); coinsApi = null; });
        const t = setTimeout(() => { coinsReady = true; if (lastCoins) coinsApi?.setValues(lastCoins); }, reduce() ? 0 : 1400);
        onCleanup(() => clearTimeout(t));
      }).catch(() => {});
    }, 900);
  }

  // First paint: digits roll up from zero while the sheet prints, unless we arrived by navigation
  const swapped = document.documentElement.classList.contains('swapped');
  render({ announce: false, from0: !swapped && !reduce() });
}

// ---------- Generic: tabs ----------
function initTabs() {
  document.querySelectorAll('[data-tabs]').forEach((box) => {
    const tabs = [...box.querySelectorAll('[role="tab"]')];
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
    box._current = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
    box._select = (i, focus = true) => {
      tabs.forEach((t, j) => {
        t.setAttribute('aria-selected', j === i ? 'true' : 'false');
        t.tabIndex = j === i ? 0 : -1;
        panels[j].hidden = j !== i;
      });
      box._current = i;
      if (focus) tabs[i].focus();
      if (!reduce()) {
        panels[i].querySelectorAll('.band').forEach((row, k) => {
          row.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 360, delay: k * 25, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'backwards' });
        });
      }
    };
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => box._select(i, false));
      t.addEventListener('keydown', (e) => {
        const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        box._select((i + d + tabs.length) % tabs.length);
      });
    });
  });
}

// ---------- Generic: FAQ ----------
function initFaq() {
  const faq = document.querySelector('[data-faq]');
  if (!faq) return;
  const qs = [...faq.querySelectorAll('[data-faq-q]')];
  const answers = [...faq.querySelectorAll('[data-faq-a]')];
  const pane = faq.querySelector('[data-faq-pane]');
  const wide = () => matchMedia('(min-width: 1024px)').matches;
  let current = 0;
  const select = (i, toggle = false) => {
    if (!wide() && toggle && i === current && qs[i].getAttribute('aria-expanded') === 'true') {
      qs[i].setAttribute('aria-expanded', 'false');
      answers[i].hidden = true;
      return;
    }
    current = i;
    qs.forEach((q, j) => q.setAttribute('aria-expanded', j === i ? 'true' : 'false'));
    answers.forEach((a, j) => { a.hidden = j !== i; });
    if (pane) swapText(pane, answers[i].textContent, true);
  };
  qs.forEach((q, i) => {
    q.addEventListener('click', () => select(i, true));
    q.addEventListener('focus', () => { if (wide()) select(i); });
    q.addEventListener('mouseenter', () => { if (wide() && matchMedia('(hover: hover)').matches) select(i); });
  });
}

// ---------- Generic: muted loops play only when visible ----------
function initLoops() {
  const vids = document.querySelectorAll('video[data-loop]');
  if (!vids.length || reduce() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); }
      else v.pause();
    }
  }, { threshold: 0.25 });
  vids.forEach((v) => io.observe(v));
  onCleanup(() => io.disconnect());
}

// ---------- Generic: reveal on scroll ----------
function initReveal() {
  const els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
  els.forEach((el) => io.observe(el));
  onCleanup(() => io.disconnect());
}

// ---------- Generic: clock ----------
function initClock() {
  const el = document.querySelector('[data-clock]');
  if (!el) return;
  const fmt = new Intl.DateTimeFormat(document.documentElement.lang === 'ca' ? 'ca-ES' : 'es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  const tick = () => { el.textContent = fmt.format(new Date()); };
  tick();
  const t = setInterval(tick, 15000);
  onCleanup(() => clearInterval(t));
}
