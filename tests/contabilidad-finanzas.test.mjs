import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calc,
  pnl,
  inPeriod,
  netOf,
  svc,
  unitMargin,
  mergeCfg,
  DEF_CFG,
  exportMovsCsv,
  servicioPorNombre,
  categoriaPorNombreCsv,
  metaTotal,
  csvEscape,
  monthsCount,
  fijosList,
} from '../apps/contabilidad/lib/finanzas.mjs';
import { validarMovimiento, validarMeta, validarCfg } from '../apps/contabilidad/server/modelo.js';

test('netOf con IVA incluido', () => {
  const neto = netOf(119000, { ...DEF_CFG, ivaIncluido: true, iva: 0.19 });
  assert.ok(Math.abs(neto - 100000) < 0.01);
});

test('calc ingreso con Transferencia suma GMF', () => {
  const c = calc(
    { tipo: 'ingreso', monto: 100000, costoDirecto: 1000, medio: 'Transferencia' },
    DEF_CFG,
  );
  assert.equal(Math.round(c.bruto), 100000);
  assert.ok(c.costo > 1000);
  assert.ok(c.neto < 100000);
});

test('calc Wompi suma comisión + IVA sobre pasarela', () => {
  const t = calc(
    { tipo: 'ingreso', monto: 100000, costoDirecto: 0, medio: 'Transferencia' },
    DEF_CFG,
  );
  const w = calc(
    { tipo: 'ingreso', monto: 100000, costoDirecto: 0, medio: 'Wompi' },
    DEF_CFG,
  );
  assert.ok(w.costo > t.costo);
});

test('inPeriod mes/año/trimestre', () => {
  const m = { fecha: '2026-10-03' };
  assert.equal(inPeriod(m, 'm:2026-10'), true);
  assert.equal(inPeriod(m, 'm:2026-09'), false);
  assert.equal(inPeriod(m, 'y:2026'), true);
  assert.equal(inPeriod(m, 'q:2026-Q4'), true);
  assert.equal(inPeriod(m, 'q:2026-Q1'), false);
  assert.equal(inPeriod(m, 'all'), true);
});

test('pnl cuenta venta v04 y gasto marketing', () => {
  const movs = [
    {
      tipo: 'ingreso',
      fecha: '2026-10-03',
      servicio: 'v04',
      cantidad: 1,
      monto: 789000,
      costoDirecto: 59723,
      medio: 'Transferencia',
      estado: 'pagado',
    },
    {
      tipo: 'gasto',
      fecha: '2026-10-02',
      categoria: 'Marketing',
      monto: 50000,
      estado: 'pagado',
      servicioCac: 'v04',
    },
  ];
  const r = pnl(movs, DEF_CFG);
  assert.equal(r.nVentas, 1);
  assert.equal(r.nNuevos, 1);
  assert.equal(r.mkt, 50000);
  assert.ok(r.ventasBrutas === 789000);
  assert.ok(Number.isFinite(r.cacReal));
});

test('v07 recurrente no cuenta como cliente nuevo', () => {
  const r = pnl(
    [
      {
        tipo: 'ingreso',
        fecha: '2026-10-01',
        servicio: 'v07',
        cantidad: 1,
        monto: 59000,
        costoDirecto: 0,
        medio: 'Transferencia',
        estado: 'pagado',
      },
    ],
    DEF_CFG,
  );
  assert.equal(r.nNuevos, 0);
});

test('servicio retirado', () => {
  const s = svc('v99', DEF_CFG);
  assert.equal(s.nombre, 'Servicio retirado del catálogo');
});

test('CSV export contiene BOM y columnas', () => {
  const csv = exportMovsCsv(
    [
      {
        tipo: 'gasto',
        fecha: '2026-10-02',
        categoria: 'Tecnología',
        concepto: 'Google Workspace',
        monto: 70000,
        estado: 'pagado',
        quien: 'Empresa',
        tercero: 'Google',
      },
    ],
    DEF_CFG,
  );
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('Google Workspace'));
  assert.ok(csv.includes('523595'));
});

test('mapeo CSV nombres', () => {
  assert.equal(servicioPorNombre('Todo para vender'), 'v04');
  assert.equal(categoriaPorNombreCsv('Tecnología y software'), 'Tecnología');
});

test('validarMovimiento rechazo gasto sin concepto', () => {
  const v = validarMovimiento({
    tipo: 'gasto',
    fecha: '2026-10-02',
    monto: 1000,
    estado: 'pagado',
    concepto: '',
  });
  assert.equal(v.ok, false);
});

test('validarMovimiento ingreso v01 gratis monto 0', () => {
  const v = validarMovimiento({
    tipo: 'ingreso',
    fecha: '2026-10-02',
    monto: 0,
    estado: 'pagado',
    servicio: 'v01',
    cantidad: 1,
    medio: 'Transferencia',
  });
  assert.equal(v.ok, true);
});

test('validarMeta y cfg', () => {
  const m = validarMeta({ mes: '2026-10', unidades: { v03: 2 }, ventas: 0, utilidad: 0 });
  assert.equal(m.ok, true);
  assert.equal(m.data.unidades.v03, 2);
  const c = validarCfg({ iva: 0.19, ivaIncluido: true, precios: { v03: { precio: 629000 } } });
  assert.equal(c.ok, true);
  assert.equal(metaTotal({ unidades: { v03: 2 } }, mergeCfg(c.data)), 629000 * 2);
});

test('csvEscape neutraliza fórmulas y comillas', () => {
  assert.equal(csvEscape('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(csvEscape('a;b'), '"a;b"');
  assert.equal(csvEscape(-5), '-5');
});

test('monthsCount usa el rango real con datos en año/todo', () => {
  const movs = [{ fecha: '2026-03-10' }, { fecha: '2026-06-02' }];
  assert.equal(monthsCount(movs, 'y:2026'), 4);
  assert.equal(monthsCount(movs, 'all'), 4);
  assert.equal(monthsCount(movs, 'm:2026-03'), 1);
  assert.equal(monthsCount([], 'y:2026'), 1);
});

test('fijosList respeta lista vacía y usa defaults con null', () => {
  assert.equal(fijosList({ ...DEF_CFG, fijos: [] }).length, 0);
  assert.ok(fijosList({ ...DEF_CFG, fijos: null }).length > 0);
});

test('validarMovimiento rechaza fecha inexistente e id de servicio raro', () => {
  assert.equal(validarMovimiento({ tipo: 'gasto', fecha: '2026-02-30', monto: 1, concepto: 'x' }).ok, false);
  assert.equal(
    validarMovimiento({ tipo: 'ingreso', fecha: '2026-02-01', monto: 1, servicio: '<script>' }).ok,
    false,
  );
});

test('unitMargin v03 positivo', () => {
  const s = svc('v03', DEF_CFG);
  assert.ok(unitMargin(s, DEF_CFG) > 0);
});
