/**
 * Validación / normalización de Contabilidad (sin I/O).
 * Devuelve { ok: true, data } | { ok: false, error }. Nunca lanza.
 */

import {
  TIPOS,
  ESTADOS,
  MEDIOS,
  CATS,
  SERVICIOS,
  DEF_CFG,
  FIJOS_DEF,
  mergeCfg,
  GRUPOS_FIJO,
} from '../lib/finanzas.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MES_RE = /^\d{4}-\d{2}$/;
const SERVICIO_ID_RE = /^[a-z0-9_-]{1,32}$/i;
const CAT_IDS = new Set(CATS.map((c) => c.id));
const SERVICIO_IDS = new Set(SERVICIOS.map((s) => s.id));

const MAX_TEXTO = 500;
const MAX_NOTAS = 4000;
const MAX_MONTO = 1e12;

function fechaValida(f) {
  if (!DATE_RE.test(String(f))) return false;
  const [y, m, d] = String(f).split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function texto(v, max, nombre) {
  const s = String(v ?? '').trim();
  if (s.length > max) return { ok: false, error: `${nombre} supera ${max} caracteres.` };
  return { ok: true, value: s };
}

export function validarMovimiento(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'El movimiento debe ser un objeto.' };
  }

  const tipo = body.tipo;
  if (!TIPOS.includes(tipo)) {
    return { ok: false, error: `tipo inválido: usa ${TIPOS.join(' o ')}.` };
  }

  if (!fechaValida(body.fecha)) {
    return { ok: false, error: 'fecha inválida (usa YYYY-MM-DD con un día real).' };
  }

  const estado = body.estado ?? 'pagado';
  if (!ESTADOS.includes(estado)) {
    return { ok: false, error: `estado inválido: usa ${ESTADOS.join(' o ')}.` };
  }

  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto < 0 || monto > MAX_MONTO) {
    return { ok: false, error: 'El monto debe ser un número entre 0 y 1 billón.' };
  }

  const tQuien = texto(body.quien, 80, 'quien');
  if (!tQuien.ok) return tQuien;
  const tTercero = texto(body.tercero, MAX_TEXTO, 'tercero');
  if (!tTercero.ok) return tTercero;
  const tConcepto = texto(body.concepto, MAX_TEXTO, 'concepto');
  if (!tConcepto.ok) return tConcepto;
  const tNotas = texto(body.notas, MAX_NOTAS, 'notas');
  if (!tNotas.ok) return tNotas;

  const data = {
    tipo,
    fecha: String(body.fecha),
    fechaPendiente: !!body.fechaPendiente,
    estado,
    monto,
    quien: tQuien.value,
    tercero: tTercero.value,
    concepto: tConcepto.value,
    notas: tNotas.value,
  };

  if (tipo === 'ingreso') {
    const servicio = String(body.servicio || '');
    if (!SERVICIO_ID_RE.test(servicio)) {
      return { ok: false, error: 'Falta el servicio del ingreso.' };
    }
    if (!(monto > 0) && servicio !== 'v01') {
      return { ok: false, error: 'Escribe un monto mayor que cero.' };
    }
    const cantidad = body.cantidad != null && body.cantidad !== '' ? Number(body.cantidad) : 1;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 10000) {
      return { ok: false, error: 'La cantidad debe ser un entero entre 1 y 10.000.' };
    }
    const costo = body.costoDirecto != null && body.costoDirecto !== '' ? Number(body.costoDirecto) : 0;
    if (!Number.isFinite(costo) || costo < 0 || costo > MAX_MONTO) {
      return { ok: false, error: 'El costo directo debe ser un número ≥ 0.' };
    }
    const medio = body.medio || 'Transferencia';
    if (!MEDIOS.includes(medio)) {
      return { ok: false, error: `medio inválido: ${MEDIOS.join(', ')}.` };
    }
    data.servicio = servicio;
    data.cantidad = cantidad;
    data.costoDirecto = costo;
    data.medio = medio;
  } else {
    if (!(monto > 0)) {
      return { ok: false, error: 'Escribe un monto mayor que cero.' };
    }
    if (!data.concepto) {
      return { ok: false, error: 'Escribe el concepto del gasto.' };
    }
    const categoria = body.categoria || 'Otros';
    if (!CAT_IDS.has(categoria)) {
      return { ok: false, error: `categoría inválida: ${categoria}.` };
    }
    let servicioCac = '';
    if (categoria === 'Marketing' && body.servicioCac) {
      servicioCac = String(body.servicioCac);
      if (!SERVICIO_IDS.has(servicioCac)) {
        return { ok: false, error: `servicioCac inválido: ${servicioCac}.` };
      }
    }
    data.categoria = categoria;
    data.servicioCac = servicioCac;
  }

  return { ok: true, data };
}

export function validarMeta(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'La meta debe ser un objeto.' };
  }
  const mes = String(body.mes || '');
  if (!MES_RE.test(mes) || +mes.slice(5, 7) < 1 || +mes.slice(5, 7) > 12) {
    return { ok: false, error: 'mes inválido (usa YYYY-MM).' };
  }
  const unidades = body.unidades && typeof body.unidades === 'object' ? body.unidades : {};
  const clean = {};
  for (const [k, v] of Object.entries(unidades)) {
    if (!SERVICIO_ID_RE.test(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) clean[k] = Math.min(10000, Math.round(n));
  }
  const ventas = Number(body.ventas) || 0;
  const utilidad = Number(body.utilidad) || 0;
  if (ventas < 0 || ventas > MAX_MONTO || Math.abs(utilidad) > MAX_MONTO) {
    return { ok: false, error: 'Meta en pesos fuera de rango.' };
  }
  return { ok: true, data: { mes, unidades: clean, ventas, utilidad } };
}

function tasa(v, fallback, nombre, max = 1) {
  if (v === undefined || v === null || v === '') return { ok: true, value: fallback };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) {
    return { ok: false, error: `${nombre} debe estar entre 0 y ${max}.` };
  }
  return { ok: true, value: n };
}

export function validarCfg(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'La config debe ser un objeto.' };
  }
  const base = mergeCfg(null);

  const precios = {};
  if (body.precios && typeof body.precios === 'object') {
    for (const [id, o] of Object.entries(body.precios)) {
      if (!SERVICIO_ID_RE.test(id) || !o || typeof o !== 'object') continue;
      const entry = {};
      for (const k of ['precio', 'costo', 'cac']) {
        if (o[k] === undefined || o[k] === null || o[k] === '') continue;
        const n = Number(o[k]);
        if (!Number.isFinite(n) || n < 0 || n > MAX_MONTO) {
          return { ok: false, error: `${k} de ${id} fuera de rango.` };
        }
        entry[k] = n;
      }
      if (Object.keys(entry).length) precios[id] = entry;
    }
  }

  // `fijos`: null → se usan los defaults del código; [] → el equipo decidió no tener fijos.
  let fijos = null;
  if (Array.isArray(body.fijos)) {
    fijos = [];
    for (const f of body.fijos) {
      if (!f || typeof f !== 'object') continue;
      const n = String(f.n || '').trim();
      if (!n) continue;
      const m = Number(f.m);
      if (!Number.isFinite(m) || m < 0 || m > MAX_MONTO) {
        return { ok: false, error: `Monto de "${n}" fuera de rango.` };
      }
      fijos.push({
        n: n.slice(0, MAX_TEXTO),
        m,
        g: GRUPOS_FIJO.includes(f.g) ? f.g : 'Otros',
        ...(f.nota ? { nota: String(f.nota).slice(0, MAX_TEXTO) } : {}),
      });
    }
  }

  const campos = [
    ['iva', tasa(body.iva, base.iva, 'IVA')],
    ['ica', tasa(body.ica, base.ica, 'ICA')],
    ['renta', tasa(body.renta, base.renta, 'renta')],
    ['gmf', tasa(body.gmf, base.gmf, 'GMF')],
    ['wompiPct', tasa(body.wompiPct, base.wompiPct, 'comisión Wompi')],
    ['wompiFijo', tasa(body.wompiFijo, base.wompiFijo, 'fijo Wompi', MAX_MONTO)],
  ];
  const data = { precios, fijos };
  for (const [k, r] of campos) {
    if (!r.ok) return r;
    data[k] = r.value;
  }
  data.ivaIncluido = body.ivaIncluido !== undefined ? !!body.ivaIncluido : base.ivaIncluido;
  return { ok: true, data };
}

export function cfgInicial() {
  return {
    ...DEF_CFG,
    fijos: FIJOS_DEF.map((f) => ({ ...f })),
    precios: {},
  };
}
