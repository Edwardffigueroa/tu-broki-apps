/**
 * Dominio puro de Contabilidad TuBroki: catálogo, cálculos, P&L, periodos, CSV.
 * Sin I/O. Usado por server, frontend (vía alias Vite) y tests.
 */

export const TRUORA = 12520;
export const FIRMA = 28170;
export const NOTIF = 3000;

export const SERVICIOS = [
  { id: 'v01', cac: 0, n: 1, nombre: 'Publica gratis en TuBroki', linea: 'Transversal', para: 'Vendedores y propietarios que alquilan', precio: 0, costo: 0, nota: 'Gancho de adquisición' },
  { id: 'v02', cac: 100000, n: 2, nombre: 'Publicación + atención a interesados', linea: 'Transversal', para: 'Venta y alquiler', precio: 499000, costo: NOTIF, nota: 'Notificaciones WhatsApp' },
  { id: 'v03', cac: 100000, n: 3, nombre: 'Todo para arrendar', linea: 'Arriendo', para: 'Propietarios que alquilan', precio: 629000, costo: FIRMA + NOTIF, nota: 'Firma digital (3 firmas) + notificaciones' },
  { id: 'v04', cac: 100000, n: 4, nombre: 'Todo para vender', linea: 'Venta', para: 'Vendedores', precio: 789000, costo: 2 * TRUORA + NOTIF, nota: '2 validaciones de antecedentes + notificaciones' },
  { id: 'v05', cac: 15000, n: 5, nombre: 'Validación de antecedentes', linea: 'Transversal', para: 'Venta, alquiler y compradores', precio: 39000, costo: TRUORA, nota: 'Truora ($4 USD)' },
  { id: 'v06', cac: 0, n: 6, nombre: 'Contrato de arrendamiento + firma digital', linea: 'Arriendo', para: 'Alquiler', precio: 199000, costo: FIRMA, nota: 'Firma digital (3 firmas)' },
  { id: 'v07', cac: 0, n: 7, nombre: 'TuBroki Te Cuida (administración mensual)', linea: 'Arriendo', para: 'Propietarios · siempre con póliza', precio: 59000, costo: 0, recurrente: true, nota: 'Cobro mensual; se vende junto con la póliza' },
  { id: 'v08', cac: 30000, n: 8, nombre: 'Diagnóstico del inmueble', linea: 'Venta', para: 'Vendedores', precio: 249000, costo: 0, nota: 'Asesoría legal' },
  { id: 'v09', cac: 30000, n: 9, nombre: 'Todo para comprar', linea: 'Compra', para: 'Compradores', precio: 689000, costo: TRUORA + NOTIF, nota: 'Antecedentes del propietario + notificaciones' },
  { id: 'v10', cac: 80000, n: 10, nombre: 'Créditos (comisión)', linea: 'Comisiones', para: 'Compradores', precio: 1225000, costo: 0, interno: true, nota: '0,7% sobre crédito promedio de $175M' },
  { id: 'v11', cac: 300000, n: 11, nombre: 'Venta de inmuebles (comisión)', linea: 'Comisiones', para: 'Compradores', precio: 7500000, costo: 0, interno: true, nota: '3% sobre inmueble promedio de $250M (rango 1,5%–3%)' },
  { id: 'v12', cac: 50000, n: 12, nombre: 'Referidos a Habi (comisión)', linea: 'Comisiones', para: 'Vendedores', precio: 2700000, costo: 0, interno: true, nota: '1,5% sobre inmueble promedio de $180M' },
  { id: 'v13', cac: 0, n: 13, nombre: 'Póliza de arrendamiento (comisión)', linea: 'Comisiones', para: 'Alquiler', precio: 25200, costo: 0, interno: true, nota: '40% del 7% que SURA paga al aliado, sobre póliza de $900.000' },
];

export const LINEAS = ['Arriendo', 'Venta', 'Compra', 'Transversal', 'Comisiones'];

export const CATS = [
  { id: 'Marketing', puc: '523560', nombre: 'Marketing y pauta' },
  { id: 'Tecnología', puc: '523595', nombre: 'Tecnología y software' },
  { id: 'Honorarios', puc: '5110', nombre: 'Honorarios (contador, abogados)' },
  { id: 'Legal', puc: '5140', nombre: 'Gastos legales' },
  { id: 'Nómina', puc: '5105', nombre: 'Gastos de personal' },
  { id: 'Oficina', puc: '5120', nombre: 'Arriendo y oficina' },
  { id: 'Operación', puc: '5135', nombre: 'Servicios operativos' },
  { id: 'Programas', puc: '5195', nombre: 'Programas y formación' },
  { id: 'Impuestos', puc: '5115', nombre: 'Impuestos y tasas' },
  { id: 'Otros', puc: '5195', nombre: 'Diversos' },
];

export const PUC_ING = '4155';
export const PUC_COSTO = '6155';

export const FIJOS_DEF = [
  { n: 'Mano de obra — 1 persona (SMMLV + prestaciones + seguridad social)', m: 2820334, g: 'Mano de obra' },
  { n: 'Portales: Fincaraíz + Metrocuadrado + Proppit (25 cupos)', m: 1200000, g: 'Publicación' },
  { n: 'Contador', m: 800000, g: 'Servicios' },
  { n: 'Wasi (gestión de inmuebles)', m: 179000, g: 'Herramientas' },
  { n: 'Zapsign (plan mensual)', m: 136400, g: 'Herramientas', nota: 'El tracker dice que se canceló en agosto: revisar' },
  { n: 'Facturación electrónica (12/mes)', m: 46900, g: 'Herramientas' },
  { n: 'CapCut Pro', m: 59900, g: 'Herramientas' },
  { n: 'Canva Pro', m: 37200, g: 'Herramientas' },
  { n: 'Google Workspace', m: 35000, g: 'Herramientas' },
  { n: 'Plan de celular', m: 35000, g: 'Herramientas' },
  { n: 'Calendly', m: 31000, g: 'Herramientas' },
  { n: 'Dominio (anual prorrateado)', m: 17272, g: 'Herramientas' },
  { n: 'Arriendo de oficina', m: 800000, g: 'Oficina', nota: 'Estimado' },
  { n: 'Servicios públicos (luz, agua, internet)', m: 300000, g: 'Oficina', nota: 'Estimado' },
  { n: 'Papelería y suministros', m: 80000, g: 'Oficina', nota: 'Estimado' },
  { n: 'Aseo, cafetería, mantenimiento', m: 100000, g: 'Oficina', nota: 'Estimado' },
];

export const DEF_CFG = {
  iva: 0.19,
  ivaIncluido: true,
  ica: 0.01,
  renta: 0.35,
  gmf: 0.004,
  wompiPct: 0.0265,
  wompiFijo: 700,
  precios: {},
  fijos: null,
};

export const QUIENES = ['Empresa', 'Mayra', 'Edward', 'Tarjeta TuBroki'];
export const MEDIOS = ['Transferencia', 'Wompi', 'Efectivo', 'Otro'];
export const TIPOS = ['ingreso', 'gasto'];
export const ESTADOS = ['pagado', 'pendiente'];
export const GRUPOS_FIJO = ['Mano de obra', 'Publicación', 'Servicios', 'Herramientas', 'Oficina', 'Otros'];

export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_L = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const nf = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

export function money(n) {
  if (!Number.isFinite(n)) return '—';
  const v = Math.round(n);
  return v < 0 ? `($${nf.format(Math.abs(v))})` : `$${nf.format(v)}`;
}

export function short(n) {
  if (!Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1).replace('.', ',')} MM`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1).replace('.', ',')} M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)} mil`;
  return `${s}$${Math.round(a)}`;
}

export function pct(n, d = 1) {
  return Number.isFinite(n) ? `${(n * 100).toFixed(d).replace('.', ',')}%` : '—';
}

export function mLabel(k) {
  const [y, m] = k.split('-');
  return `${MESES[+m - 1]} ${y.slice(2)}`;
}

export function mLong(k) {
  const [y, m] = k.split('-');
  return `${MESES_L[+m - 1]} ${y}`;
}

export function fmtDate(f) {
  if (!f) return '—';
  const [y, m, d] = f.split('-');
  return `${d} ${MESES[+m - 1]} ${y.slice(2)}`;
}

export function curMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function todayKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function addMonths(k, n) {
  let [y, m] = k.split('-').map(Number);
  m += n;
  while (m > 12) {
    m -= 12;
    y++;
  }
  while (m < 1) {
    m += 12;
    y--;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function mergeCfg(raw) {
  return { ...DEF_CFG, ...(raw || {}), precios: { ...(raw?.precios || {}) } };
}

/** `fijos` null → defaults del código; array (incluso vacío) → lo que decidió el equipo. */
export function fijosList(cfg) {
  const c = mergeCfg(cfg);
  return Array.isArray(c.fijos) ? c.fijos : FIJOS_DEF;
}

export function fijoMes(cfg) {
  return fijosList(cfg).reduce((s, f) => s + (+f.m || 0), 0);
}

export function svc(id, cfg) {
  const c = mergeCfg(cfg);
  const b = SERVICIOS.find((s) => s.id === id);
  if (!b) {
    return id
      ? { id, n: 0, nombre: 'Servicio retirado del catálogo', linea: 'Transversal', para: '', precio: 0, costo: 0, cac: 0 }
      : null;
  }
  const o = (c.precios || {})[id] || {};
  return {
    ...b,
    precio: o.precio ?? b.precio,
    costo: o.costo ?? b.costo,
    cac: o.cac ?? b.cac ?? 0,
  };
}

export function catOf(id) {
  return CATS.find((c) => c.id === id) || CATS[CATS.length - 1];
}

export function netOf(bruto, cfg) {
  const c = mergeCfg(cfg);
  return c.ivaIncluido ? bruto / (1 + c.iva) : bruto;
}

export function unitMargin(s, cfg) {
  return netOf(s.precio, cfg) - s.costo;
}

export function marginAfterCac(s, cfg) {
  return unitMargin(s, cfg) - (s.cac || 0);
}

/** Normaliza movimiento API (snake) ↔ UI (camel). */
export function toUiMov(row) {
  if (!row) return null;
  return {
    id: row.id,
    tipo: row.tipo,
    fecha: row.fecha instanceof Date
      ? row.fecha.toISOString().slice(0, 10)
      : String(row.fecha).slice(0, 10),
    fechaPendiente: !!row.fecha_pendiente,
    estado: row.estado,
    monto: Number(row.monto) || 0,
    quien: row.quien || '',
    tercero: row.tercero || '',
    concepto: row.concepto || '',
    notas: row.notas || '',
    servicio: row.servicio || undefined,
    cantidad: row.cantidad != null ? Number(row.cantidad) : undefined,
    costoDirecto: row.costo_directo != null ? Number(row.costo_directo) : undefined,
    medio: row.medio || undefined,
    categoria: row.categoria || undefined,
    servicioCac: row.servicio_cac || undefined,
    creado: row.creado instanceof Date ? row.creado.getTime() : (row.creado ? Date.parse(row.creado) : Date.now()),
  };
}

export function toDbMov(d) {
  const base = {
    tipo: d.tipo,
    fecha: d.fecha,
    fecha_pendiente: !!d.fechaPendiente,
    estado: d.estado,
    monto: +d.monto || 0,
    quien: d.quien || '',
    tercero: d.tercero || '',
    concepto: d.concepto || '',
    notas: d.notas || '',
    servicio: null,
    cantidad: null,
    costo_directo: null,
    medio: null,
    categoria: null,
    servicio_cac: null,
  };
  if (d.tipo === 'ingreso') {
    base.servicio = d.servicio || null;
    base.cantidad = +d.cantidad || 1;
    base.costo_directo = +d.costoDirecto || 0;
    base.medio = d.medio || 'Transferencia';
  } else {
    base.categoria = d.categoria || 'Otros';
    base.servicio_cac = d.servicioCac || null;
  }
  return base;
}

export function calc(m, cfg) {
  const c = mergeCfg(cfg);
  const monto = +m.monto || 0;
  if (m.tipo === 'ingreso') {
    const neto = netOf(monto, c);
    const pas = m.medio === 'Wompi' ? (monto * c.wompiPct + c.wompiFijo) * (1 + c.iva) : 0;
    const gmf = monto * (c.gmf ?? 0.004);
    return { bruto: monto, neto, iva: monto - neto, costo: (+m.costoDirecto || 0) + pas + gmf };
  }
  return { gasto: monto };
}

export function inPeriod(m, per) {
  if (!m.fecha) return per === 'all';
  if (per === 'all') return true;
  const [t, v] = per.split(':');
  if (t === 'y') return m.fecha.startsWith(v);
  if (t === 'm') return m.fecha.slice(0, 7) === v;
  if (t === 'q') {
    const [y, q] = v.split('-Q');
    const mm = +m.fecha.slice(5, 7);
    return m.fecha.startsWith(y) && Math.ceil(mm / 3) === +q;
  }
  return true;
}

export function pnl(list, cfg) {
  const c = mergeCfg(cfg);
  const r = {
    mkt: 0,
    mktServ: {},
    nNuevos: 0,
    cacObj: 0,
    ventasBrutas: 0,
    iva: 0,
    ventas: 0,
    costos: 0,
    gastosCat: {},
    gastos: 0,
    nVentas: 0,
    unidades: 0,
    cobrado: 0,
    porCobrar: 0,
    pagado: 0,
    porPagar: 0,
    porServ: {},
  };
  for (const m of list) {
    const cal = calc(m, c);
    if (m.tipo === 'ingreso') {
      r.ventasBrutas += cal.bruto;
      r.iva += cal.iva;
      r.ventas += cal.neto;
      r.costos += cal.costo;
      r.nVentas++;
      r.unidades += +m.cantidad || 1;
      // Cliente nuevo para el CAC: servicios pagos no recurrentes; los internos (comisiones) sí cuentan.
      const sv = svc(m.servicio, c);
      if (sv && sv.precio > 0 && (!sv.recurrente || sv.interno)) {
        r.nNuevos += 1;
        r.cacObj += sv.cac || 0;
      }
      if (m.estado === 'pendiente') r.porCobrar += cal.bruto;
      else r.cobrado += cal.bruto;
      const ps = r.porServ[m.servicio] || (r.porServ[m.servicio] = { u: 0, bruto: 0, neto: 0, costo: 0, n: 0 });
      ps.u += +m.cantidad || 1;
      ps.bruto += cal.bruto;
      ps.neto += cal.neto;
      ps.costo += cal.costo;
      ps.n++;
    } else {
      r.gastos += cal.gasto;
      r.gastosCat[m.categoria] = (r.gastosCat[m.categoria] || 0) + cal.gasto;
      if (m.categoria === 'Marketing') {
        r.mkt += cal.gasto;
        const k = m.servicioCac || 'general';
        r.mktServ[k] = (r.mktServ[k] || 0) + cal.gasto;
      }
      if (m.estado === 'pendiente') r.porPagar += cal.gasto;
      else r.pagado += cal.gasto;
    }
  }
  r.utilBruta = r.ventas - r.costos;
  r.utilOp = r.utilBruta - r.gastos;
  r.ica = r.ventas * c.ica;
  r.uai = r.utilOp - r.ica;
  r.renta = Math.max(0, r.uai) * c.renta;
  r.utilNeta = r.uai - r.renta;
  r.caja = r.cobrado - r.pagado;
  r.mcPct = r.ventas ? r.utilBruta / r.ventas : NaN;
  r.cacReal = r.nNuevos ? r.mkt / r.nNuevos : NaN;
  r.cacObjProm = r.nNuevos ? r.cacObj / r.nNuevos : NaN;
  return r;
}

export function monthsInData(movs, now = new Date()) {
  const s = new Set(movs.filter((m) => m.fecha).map((m) => m.fecha.slice(0, 7)));
  s.add(curMonthKey(now));
  return [...s].sort();
}

export function periodLabel(p) {
  if (p === 'all') return 'Todo el historial';
  const [t, v] = p.split(':');
  if (t === 'y') return `Año ${v}`;
  if (t === 'm') return mLong(v);
  if (t === 'q') {
    const [y, q] = v.split('-Q');
    return `T${q} ${y}`;
  }
  return p;
}

/** Meses cubiertos por el periodo: fijos para mes/trimestre; para año/todo, el rango real con datos. */
export function monthsCount(movs, p) {
  if (p.startsWith('m:')) return 1;
  if (p.startsWith('q:')) return 3;
  const ms = movs
    .filter((m) => inPeriod(m, p) && m.fecha)
    .map((m) => m.fecha.slice(0, 7))
    .sort();
  if (!ms.length) return 1;
  let a = ms[0];
  const b = ms[ms.length - 1];
  let n = 1;
  while (a < b) {
    a = addMonths(a, 1);
    n++;
  }
  return n;
}

export function metaTotal(mt, cfg) {
  if (!mt) return 0;
  if (+mt.ventas > 0) return +mt.ventas;
  return Object.entries(mt.unidades || {}).reduce(
    (s, [id, u]) => s + (svc(id, cfg)?.precio || 0) * (+u || 0),
    0,
  );
}

export function paceFrac(k, now = new Date()) {
  const cur = curMonthKey(now);
  if (k < cur) return 1;
  if (k > cur) return 0;
  const d = now.getDate();
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return d / dim;
}

export function goalStatus(f) {
  if (!Number.isFinite(f)) return { c: 'neutral', t: 'Sin datos' };
  if (f >= 1) return { c: 'ok', t: 'En meta' };
  if (f >= 0.8) return { c: 'warn', t: 'En riesgo' };
  return { c: 'bad', t: 'Atrasado' };
}

export function niceStep(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

/** Escapa para CSV `;` y neutraliza fórmulas (=, +, -, @) que Excel/Sheets ejecutarían. */
export function csvEscape(v) {
  let s = String(v ?? '');
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function exportMovsCsv(movs, cfg) {
  const head = [
    'Fecha', 'Tipo', 'Cuenta PUC', 'Servicio/Categoría', 'Concepto', 'Cantidad',
    'Monto bruto', 'Ventas netas (sin IVA)', 'IVA', 'Costo directo', 'Estado',
    'Pagó/recibió', 'Tercero', 'Medio de pago', 'Notas',
  ];
  const rows = movs
    .slice()
    .sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''))
    .map((m) => {
      const c = calc(m, cfg);
      const isI = m.tipo === 'ingreso';
      return [
        m.fecha || '',
        isI ? 'Ingreso' : 'Gasto',
        isI ? PUC_ING : catOf(m.categoria).puc,
        isI ? svc(m.servicio, cfg)?.nombre || '' : catOf(m.categoria).nombre,
        m.concepto || '',
        m.cantidad || '',
        m.monto,
        isI ? Math.round(c.neto) : '',
        isI ? Math.round(c.iva) : '',
        isI ? Math.round(c.costo) : '',
        m.estado === 'pendiente' ? 'Pendiente' : isI ? 'Cobrado' : 'Pagado',
        m.quien || '',
        m.tercero || '',
        m.medio || '',
        m.notas || '',
      ];
    });
  return `\ufeff${[head, ...rows].map((r) => r.map(csvEscape).join(';')).join('\n')}`;
}

/** Resuelve nombre de servicio del CSV → id. */
export function servicioPorNombre(nombre) {
  if (!nombre) return null;
  const n = nombre.trim().toLowerCase();
  const hit = SERVICIOS.find((s) => s.nombre.toLowerCase() === n);
  return hit?.id || null;
}

export function categoriaPorNombreCsv(nombre) {
  if (!nombre) return 'Otros';
  const n = nombre.trim().toLowerCase();
  const byNombre = CATS.find((c) => c.nombre.toLowerCase() === n);
  if (byNombre) return byNombre.id;
  const byId = CATS.find((c) => c.id.toLowerCase() === n);
  if (byId) return byId.id;
  // "Tecnología y software" → Tecnología
  const partial = CATS.find((c) => n.startsWith(c.id.toLowerCase()) || n.includes(c.nombre.toLowerCase().split(' ')[0]));
  return partial?.id || 'Otros';
}
