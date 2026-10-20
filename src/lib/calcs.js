import { sueldoNeto, cuotaAutonomo, factura, precioHora, finiquito, prestacionParo, asalariadoOAutonomo, TIPO_AUTONOMOS } from './tax.js';
import { T } from './i18n.js';

export const DEFAULTS = {
  sueldo: { bruto: 30000, pagas: 14, contrato: 'indefinido', hijos: 0, menores3: 0, compartidos: true, situacion: 3 },
  finiquito: { bruto: 28000, alta: '2021-03-01', baja: '2026-10-31', motivo: 'improcedente', pagas: 14, vacaciones: 15 },
  paro: { bruto: 24000, meses: 36, hijos: 0 },
  autonomos: { ingresos: 2500, gastos: 400, tarifaPlana: false, societario: false },
  factura: { importe: 1000, modo: 'base', iva: 21, irpf: 15 },
  hora: { netoMes: 2000, gastosMes: 250, horasSemana: 30, semanasLibres: 6, tarifaPlana: false },
  comparar: { bruto: 30000, gastos: 150, tarifaPlana: false },
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
    num: (n, d = 2) => new Intl.NumberFormat(locale, { maximumFractionDigits: d, useGrouping: 'always' }).format(n || 0),
  };
}

const unitsFor = (locale) => T[locale.startsWith('ca') ? 'ca' : 'es'].units;

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
      mark: r.tramo,
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
  if (calc === 'finiquito') {
    const u = unitsFor(locale);
    const r = finiquito({ bruto: s.bruto, alta: s.alta, baja: s.baja, motivo: s.motivo, pagas: +s.pagas, vacaciones: +s.vacaciones });
    const salVac = r.salario + r.vacImporte;
    const anios = Math.floor(r.meses / 12);
    const meses = r.meses % 12;
    const antiguedad = [anios && `${anios} ${anios === 1 ? u.year : u.years}`, (meses || !anios) && `${meses} ${meses === 1 ? u.month : u.months}`]
      .filter(Boolean).join(` ${u.and} `);
    const porAnio = r.diasPorAnio ? (r.mixta ? u.mixed : `${r.diasPorAnio} ${u.perYear}`) : '—';
    return {
      raw: r,
      result: r.total,
      coins: [r.indemnizacion, salVac, r.pagasImporte],
      out: {
        antiguedad,
        salario: f.eur(r.salario),
        salarioDias: `${r.diasUltimoMes} ${u.days}`,
        vacaciones: f.eur(r.vacImporte),
        vacDias: `${f.num(r.vacDias)} ${u.days}`,
        pagas: +s.pagas === 14 ? f.eur(r.pagasImporte) : '—',
        pagasN: +s.pagas === 14 ? `${f.num(r.pagasPend)} ${u.pagas}` : '',
        liquidacion: f.eur(r.liquidacion),
        indemPct: porAnio,
        indemnizacion: f.eur(r.indemnizacion),
        diasIndem: `${f.num(r.diasIndem)} ${u.days}`,
        exenta: f.eur(r.exenta),
      },
      when: { tope: r.topeAplicado },
      mark: s.motivo,
      stages: {
        vars: {
          salario: f.eur0(r.salario), dias: String(r.diasUltimoMes), vacaciones: f.eur0(r.vacImporte), vacDias: f.num(r.vacDias, 1),
          pagas: f.eur0(r.pagasImporte), indemnizacion: f.eur0(r.indemnizacion), total: f.eur0(r.total), porAnio,
        },
        amounts: [r.salario, salVac, r.liquidacion, r.total].map(f.eur),
        segs: [
          { v: r.indemnizacion, c: 'var(--accent)' },
          { v: salVac, c: 'var(--paper-ink)' },
          { v: r.pagasImporte, c: 'var(--paper-muted)' },
        ],
        rows: [f.eur(r.indemnizacion), f.eur(salVac), f.eur(r.pagasImporte)],
        focus: [1, 1, 2, 0],
      },
    };
  }
  if (calc === 'paro') {
    const u = unitsFor(locale);
    const r = prestacionParo({ bruto: s.bruto, meses: +s.meses, hijos: +s.hijos });
    const duracion = `${r.mesesPrestacion} ${r.mesesPrestacion === 1 ? u.month : u.months}`;
    return {
      raw: r,
      result: r.neto70,
      coins: [r.total70, r.total60, r.cotizacionTotal],
      out: {
        base: f.eur(r.base),
        duracion: r.dias ? duracion : '—',
        duracionDias: r.dias ? `${r.dias} ${u.days}` : '',
        p70: r.dias ? f.eur(r.bruto70) : '—',
        p60: r.dias > 180 ? f.eur(r.bruto60) : '—',
        limites: `${f.eur0(r.min)} – ${f.eur0(r.max)}`,
        cotizacion: f.neg(r.cotizacion),
        neto60: r.dias > 180 ? f.eur(r.neto60) : '—',
        total: f.eur(r.total),
      },
      when: { sinDerecho: !r.dias, tope: r.tope === 'max', minimo: r.tope === 'min' },
      mark: r.dias,
      stages: {
        vars: {
          base: f.eur0(r.base), p70: f.eur0(r.neto70), p60: f.eur0(r.neto60), duracion: r.dias ? duracion : '0',
          total: f.eur0(r.total), min: f.eur0(r.min), max: f.eur0(r.max),
        },
        amounts: [r.base, r.neto70, r.neto60, r.total].map(f.eur),
        segs: [
          { v: r.total70, c: 'var(--accent)' },
          { v: r.total60, c: 'var(--paper-ink)' },
          { v: r.cotizacionTotal, c: 'var(--paper-muted)' },
        ],
        rows: [f.eur(r.total70), f.eur(r.total60), f.eur(r.cotizacionTotal)],
        focus: [-1, 0, 1, -1],
      },
    };
  }
  if (calc === 'comparar') {
    const r = asalariadoOAutonomo({ bruto: s.bruto, gastos: s.gastos, tarifaPlana: !!s.tarifaPlana });
    const impuestos = r.cuota + r.irpf;
    const extra = `${r.extra < 0 ? '−' : '+'}${f.pct(Math.abs(r.extra) * 100, 1)}`;
    return {
      raw: r,
      result: r.facturacion,
      coins: [Math.max(0, r.netoAutonomo), impuestos, r.gastos],
      out: {
        bruto: f.eur0(r.bruto),
        neto: f.eur0(r.netoAsalariado),
        coste: f.eur0(r.coste),
        cuota: f.eur0(r.cuota),
        irpf: f.eur0(r.irpf),
        gastos: f.eur0(r.gastos),
        mes: r.ok ? f.eur0(r.facturacionMes) : '—',
        extra: r.bruto > 0 ? extra : '—',
      },
      stages: {
        vars: {
          neto: f.eur0(r.netoAsalariado), bruto: f.eur0(r.bruto), impuestos: f.eur0(impuestos), gastos: f.eur0(r.gastos),
          facturacion: f.eur0(r.facturacion), mes: f.eur0(r.facturacionMes), extra: f.pct(Math.abs(r.extra) * 100, 1), coste: f.eur0(r.coste),
        },
        amounts: [r.netoAsalariado, r.netoAsalariado + impuestos, r.facturacion, r.facturacionMes].map(f.eur0),
        segs: [
          { v: Math.max(0, r.netoAutonomo), c: 'var(--accent)' },
          { v: impuestos, c: 'var(--paper-ink)' },
          { v: r.gastos, c: 'var(--paper-muted)' },
        ],
        rows: [f.eur0(r.netoAutonomo), f.eur0(impuestos), f.eur0(r.gastos)],
        focus: [0, 1, 2, -1],
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
