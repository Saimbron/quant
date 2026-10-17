import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sueldoNeto, retencionIRPF, cuotaAutonomo, factura, precioHora, escala, netoAutonomo, tramoAutonomo, facturacionNecesaria,
} from '../src/lib/tax.js';

test('escala', () => {
  assert.equal(escala(12450), 12450 * 0.19);
  assert.ok(Math.abs(escala(20200) - (2365.5 + 7750 * 0.24)) < 1e-6);
  assert.ok(Math.abs(escala(24000) - 5365.5) < 1e-6); // ejemplo del algoritmo AEAT
});

test('sueldo 30.000 € 14 pagas', () => {
  const r = sueldoNeto({ bruto: 30000, pagas: 14 });
  assert.ok(Math.abs(r.ssAnual - 1950) < 0.01, `SS ${r.ssAnual}`);
  assert.equal(r.tipoIRPF, 16.42);
  assert.ok(r.netoMes > 1600 && r.netoMes < 1700, `neto ${r.netoMes}`);
});

test('tipo truncado, no redondeado (AEAT)', () => {
  assert.equal(sueldoNeto({ bruto: 20000 }).tipoIRPF, 8.86);
});

test('sin deducción de 340 € en la retención', () => {
  const r = retencionIRPF({ bruto: 17000, cotizaciones: 1105 });
  assert.equal(r.tipo, 2.84);
});

test('límite del 43 % solo hasta 35.200 €', () => {
  // Por encima de 35.200 € no se limita la cuota
  const r = retencionIRPF({ bruto: 36000, cotizaciones: 2340 });
  assert.ok(r.tipo > 18, `tipo ${r.tipo}`);
});

test('600 € de reducción con más de dos hijos', () => {
  const dos = retencionIRPF({ bruto: 40000, cotizaciones: 2600, hijos: 3, compartidos: false });
  const sin = retencionIRPF({ bruto: 40000, cotizaciones: 2600, hijos: 3, compartidos: false, situacion: 3 });
  assert.equal(dos.tipo, sin.tipo);
  const tres = retencionIRPF({ bruto: 40000, cotizaciones: 2600, hijos: 3 });
  const dosHijos = retencionIRPF({ bruto: 40000, cotizaciones: 2600, hijos: 2 });
  assert.ok(tres.tipo < dosHijos.tipo);
});

test('sueldo bajo sin retención', () => {
  assert.equal(sueldoNeto({ bruto: 15000 }).tipoIRPF, 0);
});

test('tope de base y cotización de solidaridad', () => {
  const r = sueldoNeto({ bruto: 120000 });
  assert.ok(Math.abs(r.baseMes - 5101.2) < 1e-6);
  assert.ok(r.lineas.solidaridad > 5 && r.lineas.solidaridad < 15, `sol ${r.lineas.solidaridad}`);
  assert.equal(sueldoNeto({ bruto: 50000 }).lineas.solidaridad, 0);
});

test('valores absurdos no cuelgan ni desbordan', () => {
  const r = sueldoNeto({ bruto: 1e308, hijos: 1e309, menores3: -5, situacion: 'x', pagas: 'x' });
  assert.ok(Number.isFinite(r.netoMes));
  assert.ok(Number.isFinite(sueldoNeto({ bruto: 'abc' }).netoMes));
});

test('autónomo: tramos y límites', () => {
  const r = cuotaAutonomo({ ingresos: 2500, gastos: 500 });
  assert.equal(r.tramo, 7);
  assert.ok(Math.abs(r.cuota - 380.88) < 0.01);
  assert.equal(tramoAutonomo(1166.7), 3); // 1.166,70 € ya es tabla general
  assert.equal(tramoAutonomo(1166.69), 2);
  assert.equal(cuotaAutonomo({ ingresos: 1000, tarifaPlana: true }).cuota, 88.64);
  const soc = cuotaAutonomo({ ingresos: 1000, societario: true });
  assert.ok(Math.abs(soc.cuota - 1424.4 * 0.315) < 0.01);
});

test('factura cuadra con las cifras redondeadas', () => {
  assert.equal(factura({ importe: 1000 }).total, 1060);
  assert.ok(Math.abs(factura({ importe: 1060, modo: 'total' }).base - 1000) < 1e-9);
  const f = factura({ importe: 100.03 });
  assert.equal(f.total, Math.round((f.base + f.cuotaIVA - f.retencion) * 100) / 100);
});

test('precio hora: mínimo real pese a los saltos de tramo', () => {
  const p = precioHora({ netoMes: 2000, gastosMes: 200, horasSemana: 30, semanasLibres: 6 });
  assert.ok(p.neto >= 24000 - 0.01);
  // Ninguna facturación menor alcanza el objetivo
  for (let f = 0; f < p.facturacion - 1; f += 50) assert.ok(netoAutonomo(f, 200).neto < 24000, `f ${f}`);
  const q = facturacionNecesaria(681.21 * 12, 250);
  assert.ok(q <= 14500 + 0.01, `q ${q}`);
});

test('precio hora con objetivo 0 cubre los gastos', () => {
  const p = precioHora({ netoMes: 0, gastosMes: 250 });
  assert.ok(p.facturacion > 0 && p.neto >= -0.01);
});
