// Parámetros fiscales 2026 (España, territorio común).
// Fuentes: Orden PJC/297/2026 (bases, tipos y cotización de solidaridad), RDL 3/2026,
// algoritmo de cálculo de retenciones AEAT 2026 (versión del 10 de septiembre),
// RD 142/2024 (límites excluyentes) y prórroga de la tabla de autónomos de 2025.

export const YEAR = 2026;

export const SS = {
  comunes: 0.047,
  desempleoIndefinido: 0.0155,
  desempleoTemporal: 0.016,
  fp: 0.001,
  mei: 0.0015,
  baseMax: 5101.2,
};

// Cotización de solidaridad 2026, parte del trabajador (1/6 de 1,15 %, 1,25 % y 1,46 %),
// sobre la parte del salario que supera la base máxima.
const SOLIDARIDAD = [
  [0.1, 0.0115 / 6],
  [0.5, 0.0125 / 6],
  [Infinity, 0.0146 / 6],
];

// Límites de entrada: evitan cuelgues y desbordamientos con valores absurdos
export const LIMITS = {
  money: 100_000_000,
  hijos: 6,
};

// Escala de retenciones (estatal + autonómica general)
const ESCALA = [
  [12450, 0.19],
  [20200, 0.24],
  [35200, 0.3],
  [60000, 0.37],
  [300000, 0.45],
  [Infinity, 0.47],
];

export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const trunc2 = (n) => Math.floor(n * 100 + 1e-9) / 100;
const money = (v) => Math.min(LIMITS.money, Math.max(0, Number.isFinite(+v) ? +v : 0));
const int = (v, min, max) => Math.min(max, Math.max(min, Math.trunc(Number.isFinite(+v) ? +v : 0)));

export function escala(base) {
  let cuota = 0;
  let desde = 0;
  for (const [hasta, tipo] of ESCALA) {
    if (base <= desde) break;
    cuota += (Math.min(base, hasta) - desde) * tipo;
    desde = hasta;
  }
  return cuota;
}

// Límites excluyentes de retención (RD 142/2024): [0 hijos, 1 hijo, 2 o más]
const LIMITES = {
  1: [null, 17644, 18694], // monoparental (sin hijos no aplica: se trata como situación 3)
  2: [17197, 18130, 19262], // cónyuge con rentas anuales de hasta 1.500 €
  3: [15876, 16342, 16867], // resto de casos
};

const MIN_DESCENDIENTES = [2400, 2700, 4000, 4500];

export function reduccionTrabajo(rnt) {
  if (rnt <= 14852) return 7302;
  if (rnt <= 17673.52) return round2(7302 - 1.75 * (rnt - 14852));
  if (rnt < 19747.5) return round2(2364.34 - 1.14 * (rnt - 17673.52));
  return 0;
}

// Tipo de retención según el algoritmo de la AEAT 2026 (sin regularización)
export function retencionIRPF({ bruto, cotizaciones, hijos = 0, menores3 = 0, compartidos = true, situacion = 3, temporal = false }) {
  bruto = money(bruto);
  hijos = int(hijos, 0, LIMITS.hijos);
  menores3 = int(menores3, 0, hijos);
  situacion = [1, 2, 3].includes(+situacion) ? +situacion : 3;
  if (bruto <= 0) return { tipo: 0, cuota: 0 };

  const sit = situacion === 1 && hijos === 0 ? 3 : situacion;
  const limite = LIMITES[sit][Math.min(hijos, 2)];
  if (bruto <= limite) return { tipo: 0, cuota: 0, limite };

  const rnt = Math.max(0, bruto - cotizaciones);
  const otrosGastos = Math.min(2000, rnt);
  const rntReducido = Math.max(0, rnt - otrosGastos - reduccionTrabajo(rnt));
  const reducciones = hijos > 2 ? 600 : 0;
  const base = Math.max(0, rntReducido - reducciones);

  const entero = compartidos ? 0.5 : 1;
  let minDesc = 0;
  for (let i = 0; i < hijos; i++) minDesc += MIN_DESCENDIENTES[Math.min(i, 3)] * entero;
  minDesc += menores3 * 2800 * entero;
  const minimo = 5550 + round2(minDesc);

  const cuota1 = escala(base);
  const cuota2 = escala(minimo);
  let cuota = cuota1 > cuota2 ? cuota1 - cuota2 : 0;
  if (bruto <= 35200) cuota = Math.min(cuota, (bruto - limite) * 0.43);

  let tipo = trunc2((cuota / bruto) * 100);
  if (temporal && tipo < 2) tipo = 2;
  return { tipo, cuota: round2((bruto * tipo) / 100), limite };
}

function solidaridadMes(salarioMes) {
  const exceso = salarioMes - SS.baseMax;
  if (exceso <= 0) return 0;
  let total = 0;
  let desde = 0;
  for (const [hasta, tipo] of SOLIDARIDAD) {
    const tope = hasta * SS.baseMax;
    const tramo = Math.min(exceso, tope) - desde;
    if (tramo <= 0) break;
    total += tramo * tipo;
    desde = tope;
    if (exceso <= tope) break;
  }
  return total;
}

export function sueldoNeto({ bruto, pagas = 14, hijos = 0, menores3 = 0, compartidos = true, situacion = 3, temporal = false }) {
  bruto = money(bruto);
  pagas = +pagas === 12 ? 12 : 14;
  const salarioMes = bruto / 12; // prorrateado, incluye pagas extra
  const baseMes = Math.min(salarioMes, SS.baseMax);
  const desempleo = temporal ? SS.desempleoTemporal : SS.desempleoIndefinido;
  const lineas = {
    comunes: round2(baseMes * SS.comunes),
    desempleo: round2(baseMes * desempleo),
    fp: round2(baseMes * SS.fp),
    mei: round2(baseMes * SS.mei),
    solidaridad: round2(solidaridadMes(salarioMes)),
  };
  const ssMes = lineas.comunes + lineas.desempleo + lineas.fp + lineas.mei + lineas.solidaridad;
  const ssAnual = ssMes * 12;
  const irpf = retencionIRPF({ bruto, cotizaciones: ssAnual, hijos, menores3, compartidos, situacion, temporal });
  const brutoPaga = round2(bruto / pagas);
  const irpfPaga = round2((brutoPaga * irpf.tipo) / 100);
  const netoMes = brutoPaga - ssMes - irpfPaga;
  const netoExtra = pagas === 14 ? brutoPaga - irpfPaga : null;
  const irpfAnual = irpf.cuota;
  const netoAnual = bruto - ssAnual - irpfAnual;
  return {
    bruto, pagas, brutoPaga, baseMes, lineas, ssMes, ssAnual,
    tipoSS: SS.comunes + desempleo + SS.fp + SS.mei,
    tipoIRPF: irpf.tipo, irpfPaga, irpfAnual,
    netoMes, netoExtra, netoAnual,
    diasHacienda: bruto > 0 ? Math.round(((ssAnual + irpfAnual) / bruto) * 365) : 0,
  };
}

// Autónomos: tabla de 2025 prorrogada para 2026; tipo 31,5 % (30,6 % + MEI 0,9 %).
// `desde` incluido, `hasta` excluido salvo en la tabla reducida, que va «hasta» cada tope.
export const TRAMOS_AUTONOMOS = [
  { hasta: 670, base: 653.59 },
  { hasta: 900, base: 718.95 },
  { hasta: 1166.7, base: 849.67 },
  { hasta: 1300, base: 950.98 },
  { hasta: 1500, base: 960.78 },
  { hasta: 1700, base: 960.78 },
  { hasta: 1850, base: 1143.79 },
  { hasta: 2030, base: 1209.15 },
  { hasta: 2330, base: 1274.51 },
  { hasta: 2760, base: 1356.21 },
  { hasta: 3190, base: 1437.91 },
  { hasta: 3620, base: 1519.61 },
  { hasta: 4050, base: 1601.31 },
  { hasta: 6000, base: 1732.03 },
  { hasta: Infinity, base: 1928.1 },
];
export const TIPO_AUTONOMOS = 0.315;
export const TARIFA_PLANA = 88.64; // 80 € + MEI
export const BASE_MIN_SOCIETARIO = 1424.4;

export function tramoAutonomo(computable) {
  // El tramo 3 de la tabla reducida termina antes de 1.166,70 €: esa cifra ya es tabla general
  if (computable < 1166.7) {
    if (computable <= 670) return 0;
    if (computable <= 900) return 1;
    return 2;
  }
  return TRAMOS_AUTONOMOS.findIndex((t, i) => i >= 3 && computable <= t.hasta);
}

export function cuotaAutonomo({ ingresos, gastos = 0, tarifaPlana = false, societario = false }) {
  ingresos = money(ingresos);
  gastos = money(gastos);
  const rendimiento = ingresos - gastos;
  const deduccion = round2(Math.max(0, rendimiento) * (societario ? 0.03 : 0.07));
  const computable = rendimiento - deduccion;
  const idx = tramoAutonomo(computable);
  const baseTabla = TRAMOS_AUTONOMOS[idx].base;
  const base = societario ? Math.max(baseTabla, BASE_MIN_SOCIETARIO) : baseTabla;
  const cuotaTabla = round2(base * TIPO_AUTONOMOS);
  const cuota = tarifaPlana ? TARIFA_PLANA : cuotaTabla;
  return { rendimiento, deduccion, computable, tramo: idx, base, cuota, cuotaTabla, anual: round2(cuota * 12) };
}

export function factura({ importe, modo = 'base', iva = 0.21, irpf = 0.15 }) {
  importe = money(importe);
  const base = round2(modo === 'total' ? importe / (1 + iva - irpf) : importe);
  const cuotaIVA = round2(base * iva);
  const retencion = round2(base * irpf);
  // El total se suma con las cifras ya redondeadas para que la factura cuadre
  const total = round2(base + cuotaIVA - retencion);
  return { base, iva, irpf, cuotaIVA, retencion, total, tuyo: round2(base - retencion) };
}

// Neto anual de un autónomo en estimación directa simplificada a partir de su facturación anual (sin IVA)
export function netoAutonomo(facturacion, gastosMes, tarifaPlana = false) {
  const cuota = cuotaAutonomo({ ingresos: facturacion / 12, gastos: gastosMes, tarifaPlana });
  const rn = facturacion - gastosMes * 12 - cuota.anual;
  const dificil = Math.min(Math.max(0, rn) * 0.05, 2000);
  const base = Math.max(0, rn - dificil);
  const irpf = Math.max(0, escala(base) - escala(5550));
  return { neto: rn - irpf, irpf, cuotaAnual: cuota.anual, tramo: cuota.tramo };
}

// Menor facturación anual que deja al menos `objetivo` neto. La cuota sube a saltos por tramos,
// así que el neto no crece de forma continua: se busca dentro de cada tramo y se toma el mínimo.
export function facturacionNecesaria(objetivo, gastosMes, tarifaPlana = false) {
  const net = (f) => netoAutonomo(f, gastosMes, tarifaPlana).neto;
  const toF = (computable) => 12 * (gastosMes + computable / 0.93);
  const ranges = [];
  if (tarifaPlana) ranges.push([0, Infinity]);
  else {
    let desde = 0;
    TRAMOS_AUTONOMOS.forEach((t, i) => {
      const lo = i === 0 ? 0 : desde;
      const hi = t.hasta === Infinity ? Infinity : toF(t.hasta);
      ranges.push([lo, hi]);
      desde = hi;
    });
  }
  let best = null;
  for (let [lo, hi] of ranges) {
    if (best !== null && lo >= best) break;
    if (hi === Infinity) {
      hi = Math.max(lo * 2, 1000);
      while (net(hi) < objetivo && hi < LIMITS.money) hi *= 2;
      if (net(hi) < objetivo) continue;
    } else {
      hi -= 0.25; // margen para quedar dentro del tramo pese al redondeo de céntimos
      if (hi < lo || net(hi) < objetivo) continue;
    }
    if (net(lo) >= objetivo) { best = best === null ? lo : Math.min(best, lo); continue; }
    let a = lo;
    let b = hi;
    for (let k = 0; k < 60 && b - a > 0.005; k++) {
      const m = (a + b) / 2;
      if (net(m) >= objetivo) b = m;
      else a = m;
    }
    best = best === null ? b : Math.min(best, b);
  }
  return best;
}

export function precioHora({ netoMes, gastosMes = 0, horasSemana = 30, semanasLibres = 6, tarifaPlana = false }) {
  netoMes = money(netoMes);
  gastosMes = money(gastosMes);
  const h = int(horasSemana, 1, 80);
  const semanas = Math.max(1, 52 - int(semanasLibres, 0, 51));
  const found = facturacionNecesaria(netoMes * 12, gastosMes, tarifaPlana);
  const facturacion = found ?? 0;
  const d = netoAutonomo(facturacion, gastosMes, tarifaPlana);
  const horas = h * semanas;
  return {
    ok: found !== null,
    facturacion, horas, semanas,
    hora: facturacion / horas,
    dia: (facturacion / horas) * (h / 5),
    gastosAnual: gastosMes * 12,
    cuotaAnual: d.cuotaAnual,
    irpf: d.irpf,
    neto: d.neto,
  };
}
