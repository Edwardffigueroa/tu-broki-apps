/**
 * Acceso a datos del schema `contabilidad` (Prisma).
 */

import { getPrisma } from '../../../shared/prisma.js'
import { toUiMov } from '../lib/finanzas.mjs'

function isoDate(d) {
  if (!d) return null
  if (d instanceof Date) return d.toISOString().slice(0, 10)
  return String(d).slice(0, 10)
}

function mapMov(r) {
  return toUiMov({
    ...r,
    fecha: isoDate(r.fecha),
    monto: r.monto != null ? Number(r.monto) : 0,
    costo_directo: r.costo_directo != null ? Number(r.costo_directo) : null,
  })
}

function fechaDate(s) {
  if (s instanceof Date) return s
  return new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`)
}

export async function listarMovimientos() {
  const filas = await getPrisma().movimientos.findMany({
    orderBy: [{ fecha: 'desc' }, { creado: 'desc' }],
  })
  return filas.map(mapMov)
}

export async function obtenerMovimiento(id) {
  const r = await getPrisma().movimientos.findUnique({ where: { id } })
  return r ? mapMov(r) : null
}

export async function crearMovimiento(d) {
  const r = await getPrisma().movimientos.create({
    data: {
      tipo: d.tipo,
      fecha: fechaDate(d.fecha),
      fecha_pendiente: !!d.fecha_pendiente,
      estado: d.estado,
      monto: d.monto,
      quien: d.quien,
      tercero: d.tercero,
      concepto: d.concepto,
      notas: d.notas,
      servicio: d.servicio,
      cantidad: d.cantidad,
      costo_directo: d.costo_directo,
      medio: d.medio,
      categoria: d.categoria,
      servicio_cac: d.servicio_cac,
    },
  })
  return mapMov(r)
}

export async function actualizarMovimiento(id, d) {
  try {
    const r = await getPrisma().movimientos.update({
      where: { id },
      data: {
        tipo: d.tipo,
        fecha: fechaDate(d.fecha),
        fecha_pendiente: !!d.fecha_pendiente,
        estado: d.estado,
        monto: d.monto,
        quien: d.quien,
        tercero: d.tercero,
        concepto: d.concepto,
        notas: d.notas,
        servicio: d.servicio,
        cantidad: d.cantidad,
        costo_directo: d.costo_directo,
        medio: d.medio,
        categoria: d.categoria,
        servicio_cac: d.servicio_cac,
        updated_at: new Date(),
      },
    })
    return mapMov(r)
  } catch (e) {
    if (e?.code === 'P2025') return null
    throw e
  }
}

export async function eliminarMovimiento(id) {
  try {
    await getPrisma().movimientos.delete({ where: { id } })
    return true
  } catch (e) {
    if (e?.code === 'P2025') return false
    throw e
  }
}

export async function contarMovimientos() {
  return getPrisma().movimientos.count()
}

export async function listarMetas() {
  const filas = await getPrisma().metas.findMany({ orderBy: { mes: 'desc' } })
  const out = {}
  for (const f of filas) {
    out[f.mes] = {
      unidades: f.unidades || {},
      ventas: Number(f.ventas) || 0,
      utilidad: Number(f.utilidad) || 0,
    }
  }
  return out
}

export async function upsertMeta({ mes, unidades, ventas, utilidad }) {
  const r = await getPrisma().metas.upsert({
    where: { mes },
    create: { mes, unidades, ventas, utilidad },
    update: { unidades, ventas, utilidad, updated_at: new Date() },
  })
  return {
    mes: r.mes,
    unidades: r.unidades || {},
    ventas: Number(r.ventas) || 0,
    utilidad: Number(r.utilidad) || 0,
  }
}

export async function obtenerConfig(clave = 'catalogo') {
  const r = await getPrisma().config.findUnique({ where: { clave } })
  return r?.data || null
}

export async function upsertConfig(data, clave = 'catalogo') {
  const r = await getPrisma().config.upsert({
    where: { clave },
    create: { clave, data },
    update: { data, updated_at: new Date() },
  })
  return r.data
}
