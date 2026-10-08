/**
 * Acceso a datos de la app roadmap (Prisma). Schema `roadmap`.
 *
 * El navegador manda el tablero completo; reemplazamos todas las tareas en una
 * transacción, protegidos por `tableros.version` (concurrencia optimista).
 */

import { Prisma } from '@prisma/client'
import { getPrisma } from '../../../shared/prisma.js'

export const TABLERO_PRINCIPAL = 'principal'
const MAX_RESPALDOS = 14

/** Convierte una fila de Postgres al objeto plano que usa la UI y el CSV. */
function filaATarea(r) {
  const fecha = (d) => {
    if (!d) return ''
    if (d instanceof Date) return d.toISOString().slice(0, 10)
    return String(d).slice(0, 10)
  }
  return {
    id: r.id,
    padre_id: r.padre_id ?? '',
    tipo: r.tipo,
    titulo: r.titulo,
    descripcion: r.descripcion ?? '',
    grupo: r.grupo ?? '',
    estado: r.estado,
    prioridad: r.prioridad,
    responsable: r.responsable ?? '',
    estimacion_dias: r.estimacion_dias == null ? '' : Number(r.estimacion_dias),
    fecha_inicio: fecha(r.fecha_inicio),
    fecha_fin: fecha(r.fecha_fin),
    orden: r.orden ?? 0,
    creado: r.creado instanceof Date ? r.creado.toISOString() : r.creado ?? '',
    actualizado: r.actualizado instanceof Date ? r.actualizado.toISOString() : r.actualizado ?? '',
  }
}

function vacioANull(v) {
  return v === '' || v == null ? null : v
}

function fechaONull(v) {
  const x = vacioANull(v)
  if (x == null) return null
  return new Date(`${String(x).slice(0, 10)}T00:00:00.000Z`)
}

function tareaAData(t, tableroId) {
  return {
    id: t.id,
    tablero_id: tableroId,
    padre_id: vacioANull(t.padre_id),
    tipo: t.tipo,
    titulo: t.titulo,
    descripcion: t.descripcion ?? '',
    grupo: t.grupo ?? '',
    estado: t.estado,
    prioridad: t.prioridad,
    responsable: t.responsable ?? '',
    estimacion_dias: vacioANull(t.estimacion_dias),
    fecha_inicio: fechaONull(t.fecha_inicio),
    fecha_fin: fechaONull(t.fecha_fin),
    orden: Number(t.orden) || 0,
    creado: vacioANull(t.creado) ? new Date(t.creado) : new Date(),
    actualizado: vacioANull(t.actualizado) ? new Date(t.actualizado) : new Date(),
  }
}

export async function obtenerTablero(tableroId = TABLERO_PRINCIPAL) {
  const prisma = getPrisma()
  const tablero = await prisma.tableros.findUnique({ where: { id: tableroId } })
  if (!tablero) throw new Error(`Tablero ${tableroId} no existe.`)

  const filas = await prisma.tareas.findMany({
    where: { tablero_id: tableroId },
    orderBy: [{ orden: 'asc' }, { creado: 'asc' }],
  })
  return {
    nombre: tablero.nombre,
    version: Number(tablero.version),
    tareas: filas.map(filaATarea),
  }
}

/**
 * Reemplaza todas las tareas del tablero si la versión coincide.
 * Devuelve { ok: true, version } o { ok: false, conflicto: true, version }.
 */
export async function reemplazarTareas({
  tableroId = TABLERO_PRINCIPAL,
  tareas,
  versionEsperada,
  respaldoCsv,
}) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`select version from roadmap.tableros where id = ${tableroId} for update`,
    )
    const tablero = await tx.tableros.findUnique({ where: { id: tableroId } })
    if (!tablero) throw new Error(`Tablero ${tableroId} no existe.`)
    const versionActual = Number(tablero.version)

    if (versionEsperada != null && Number(versionEsperada) !== versionActual) {
      return { ok: false, conflicto: true, version: versionActual }
    }

    if (respaldoCsv) {
      const hoy = new Date()
      hoy.setUTCHours(0, 0, 0, 0)
      await tx.respaldos.createMany({
        data: [{ tablero_id: tableroId, fecha: hoy, csv: respaldoCsv }],
        skipDuplicates: true,
      })
      const keep = await tx.respaldos.findMany({
        where: { tablero_id: tableroId },
        orderBy: { fecha: 'desc' },
        take: MAX_RESPALDOS,
        select: { id: true },
      })
      const keepIds = keep.map((k) => k.id)
      if (keepIds.length) {
        await tx.respaldos.deleteMany({
          where: { tablero_id: tableroId, id: { notIn: keepIds } },
        })
      }
    }

    await tx.tareas.deleteMany({ where: { tablero_id: tableroId } })

    const filas = tareas.map((t) => tareaAData(t, tableroId))
    for (let i = 0; i < filas.length; i += 200) {
      await tx.tareas.createMany({ data: filas.slice(i, i + 200) })
    }

    const actualizado = await tx.tableros.update({
      where: { id: tableroId },
      data: { version: { increment: 1 }, actualizado: new Date() },
    })
    return { ok: true, version: Number(actualizado.version) }
  })
}
