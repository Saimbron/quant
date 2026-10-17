import { sueldoNeto, cuotaAutonomo, factura, precioHora, TIPO_AUTONOMOS } from './tax.js';

export const DEFAULTS = {
  sueldo: { bruto: 30000, pagas: 14, contrato: 'indefinido', hijos: 0, menores3: 0, compartidos: true, situacion: 3 },
  autonomos: { ingresos: 2500, gastos: 400, tarifaPlana: false, societario: false },
  factura: { importe: 1000, modo: 'base', iva: 21, irpf: 15 },
  hora: { netoMes: 2000, gastosMes: 250, horasSemana: 30, semanasLibres: 6, tarifaPlana: false },
};

export function makeFormat(locale) {
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
  const money0 = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' });
  const num0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: 'always' });
  const num2 = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
  const pct = (n, d = 2) => `${new Intl.NumberFormat(locale, { minimumFractionDigits: d, maximumFractionDigits: d }).format(n)} %`;
  return {
    eur: (n) => money.format(n || 0),
    eur0: (n) => money0.format(n || 0),
    neg: (n) => (n > 0.004 ? '−' + money.format(n) : money.format(0)),
    num0: (n) => num0.format(n || 0),
    num2: (n) => num2.format(n || 0),
    pct,
  };
}

// Big number split for display: integer part and cents
export function split(n, locale) {
  const s = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }).format(n || 0);
  const sep = locale.startsWith('es') || locale.startsWith('ca') ? ',' : '.';
  const i = s.lastIndexOf(sep);
  return { int: s.slice(0, i), dec: s.slice(i) };
}

export function compute(calc, s, locale) {
  const f = makeFormat(locale);
  if (calc === 'sueldo') {
    const r = sueldoNeto({
      bruto: s.bruto, pagas: +s.pagas, temporal: s.contrato === 'temporal',
      hijos: +s.hijos, menores3: +s.menores3, compartidos: !!s.compartidos, situacion: +s.situacion,
    });
    const deducciones = r.ssMes + r.irpfPaga;
    return {
      raw: r,
      result: r.netoMes,
      coins: [r.netoMes, r.irpfPaga, r.ssMes],
      out: {
        salario: f.eur(r.brutoPaga),
        comunes: f.neg(r.lineas.comunes),
        desempleo: f.neg(r.lineas.desempleo),
        desempleoPct: f.pct(s.contrato === 'temporal' ? 1.6 : 1.55),
        fp: f.neg(r.lineas.fp),
        mei: f.neg(r.lineas.mei),
        solidaridad: f.neg(r.lineas.solidaridad),
        irpf: f.neg(r.irpfPaga),
        irpfPct: f.pct(r.tipoIRPF),
        total: f.neg(deducciones),
        extra: r.netoExtra != null ? f.eur(r.netoExtra) : '—',
        anual: f.eur(r.netoAnual),
        dias: String(r.diasHacienda),
      },
      stages: {
        vars: {
          bruto: f.eur0(r.brutoPaga), ss: f.eur0(r.ssMes), irpf: f.eur0(r.irpfPaga), neto: f.eur0(r.netoMes),
          tipoSS: f.pct(r.tipoSS * 100), tipoIRPF: f.pct(r.tipoIRPF),
        },
        amounts: [r.brutoPaga, r.brutoPaga - r.ssMes, r.netoMes, r.netoMes].map(f.eur),
        segs: [
          { v: r.netoMes, c: 'var(--accent)' },
          { v: r.irpfPaga, c: 'var(--paper-ink)' },
          { v: r.ssMes, c: 'var(--paper-muted)' },
        ],
        rows: [f.eur(r.netoMes), f.eur(r.irpfPaga), f.eur(r.ssMes)],
        focus: [-1, 2, 1, 0],
      },
    };
  }
  if (calc === 'autonomos') {
    const r = cuotaAutonomo({ ingresos: s.ingresos, gastos: s.gastos, tarifaPlana: !!s.tarifaPlana, societario: !!s.societario });
    return {
      raw: r,
      result: r.cuota,
      coins: [Math.max(0, (+s.ingresos || 0) - (+s.gastos || 0) - r.cuota), +s.gastos || 0, r.cuota],
      out: {
        ingresos: f.eur(s.ingresos),
        gastos: f.neg(s.gastos),
        deduccion: f.neg(r.deduccion),
        deduccionPct: f.pct(s.societario ? 3 : 7, 0),
        computable: f.eur(r.computable),
        tramo: `${r.tramo + 1} / 15`,
        base: f.eur(r.base),
        tipo: s.tarifaPlana ? '—' : f.pct(TIPO_AUTONOMOS * 100, 1),
        anual: f.eur(r.anual),
        cuotaTabla: f.eur(r.cuotaTabla),
      },
      tramo: r.tramo,
    };
  }
  if (calc === 'factura') {
    const r = factura({ importe: s.importe, modo: s.modo, iva: +s.iva / 100, irpf: +s.irpf / 100 });
    return {
      raw: r,
      result: r.total,
      coins: [r.base - r.retencion, r.retencion, r.cuotaIVA],
      out: {
        base: f.eur(r.base),
        ivaPct: f.pct(+s.iva, 0),
        iva: f.eur(r.cuotaIVA),
        irpfPct: f.pct(+s.irpf, 0),
        irpf: f.neg(r.retencion),
        tuyo: f.eur(r.tuyo),
      },
      stages: {
        vars: { base: f.eur0(r.base), iva: f.eur0(r.cuotaIVA), irpf: f.eur0(r.retencion), total: f.eur0(r.total) },
        amounts: [r.base, r.base + r.cuotaIVA, r.total, r.total].map(f.eur),
        segs: [
          { v: r.base - r.retencion, c: 'var(--accent)' },
          { v: r.retencion, c: 'var(--paper-muted)' },
          { v: r.cuotaIVA, c: 'var(--paper-ink)' },
        ],
        rows: [f.eur(r.base - r.retencion), f.eur(r.retencion), f.eur(r.cuotaIVA)],
        focus: [0, 2, 1, -1],
      },
    };
  }
  // hora
  const r = precioHora({ netoMes: s.netoMes, gastosMes: s.gastosMes, horasSemana: +s.horasSemana, semanasLibres: +s.semanasLibres, tarifaPlana: !!s.tarifaPlana });
  const impuestos = r.cuotaAnual + r.irpf;
  return {
    raw: r,
    result: r.hora,
    coins: [r.neto, r.gastosAnual, r.cuotaAnual + r.irpf],
    out: {
      neto: f.eur0(r.neto),
      gastos: f.eur0(r.gastosAnual),
      cuota: f.eur0(r.cuotaAnual),
      irpf: f.eur0(r.irpf),
      facturacion: r.ok ? f.eur0(r.facturacion) : '—',
      horas: f.num0(r.horas),
      dia: f.eur0(r.dia),
    },
    stages: {
      vars: {
        neto: f.eur0(r.neto), gastos: f.eur0(r.gastosAnual), impuestos: f.eur0(impuestos),
        hora: f.eur0(r.hora), horas: f.num0(r.horas),
      },
      amounts: [r.neto, r.neto + r.gastosAnual, r.facturacion, r.hora].map(f.eur0),
      segs: [
        { v: r.neto, c: 'var(--accent)' },
        { v: r.gastosAnual, c: 'var(--paper-muted)' },
        { v: impuestos, c: 'var(--paper-ink)' },
      ],
      rows: [f.eur0(r.neto), f.eur0(r.gastosAnual), f.eur0(impuestos)],
      focus: [0, 1, 2, -1],
    },
  };
}

export function fill(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}
