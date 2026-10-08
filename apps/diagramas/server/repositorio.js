/**
 * Acceso a datos del schema `diagramas` (Prisma).
 */

import { getPrisma } from '../../../shared/prisma.js'

function iso(d) {
  if (!d) return null
  return d instanceof Date ? d.toISOString() : d
}

function mapGrupo(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    color: r.color ?? null,
    orden: Number(r.orden) || 0,
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }
}

function mapEtiqueta(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    color: r.color ?? null,
    created_at: iso(r.created_at),
  }
}

function etiquetasDesdeInclude(row) {
  const links = row.diagrama_etiquetas || []
  return links
    .map((l) => l.etiquetas)
    .filter(Boolean)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    .map(mapEtiqueta)
}

function mapDiagramaResumen(r) {
  return {
    id: r.id,
    titulo: r.titulo,
    tipo: r.tipo,
    grupo_id: r.grupo_id ?? null,
    revision: Number(r.revision) || 1,
    archived_at: iso(r.archived_at),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
    etiquetas: r.etiquetas || etiquetasDesdeInclude(r),
  }
}

function mapDiagrama(r) {
  return {
    ...mapDiagramaResumen(r),
    modelo: r.modelo,
  }
}

const includeEtiquetas = {
  diagrama_etiquetas: { include: { etiquetas: true } },
}

/* ---------- grupos ---------- */

export async function listarGrupos() {
  const filas = await getPrisma().grupos.findMany({
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  })
  return filas.map(mapGrupo)
}

export async function crearGrupo({ nombre, color, orden }) {
  const r = await getPrisma().grupos.create({
    data: { nombre, color: color ?? null, orden: orden ?? 0 },
  })
  return mapGrupo(r)
}

export async function actualizarGrupo(id, patch) {
  const prisma = getPrisma()
  const cur = await prisma.grupos.findUnique({ where: { id } })
  if (!cur) return null
  const r = await prisma.grupos.update({
    where: { id },
    data: {
      nombre: patch.nombre !== undefined ? patch.nombre : cur.nombre,
      color: patch.color !== undefined ? patch.color : cur.color,
      orden: patch.orden !== undefined ? patch.orden : cur.orden,
      updated_at: new Date(),
    },
  })
  return mapGrupo(r)
}

export async function eliminarGrupo(id) {
  try {
    await getPrisma().grupos.delete({ where: { id } })
    return true
  } catch (e) {
    if (e?.code === 'P2025') return false
    throw e
  }
}

/* ---------- etiquetas ---------- */

export async function listarEtiquetas() {
  const filas = await getPrisma().etiquetas.findMany({ orderBy: { nombre: 'asc' } })
  return filas.map(mapEtiqueta)
}

export async function crearEtiqueta({ nombre, color }) {
  const r = await getPrisma().etiquetas.create({
    data: { nombre, color: color ?? null },
  })
  return mapEtiqueta(r)
}

export async function actualizarEtiqueta(id, patch) {
  const prisma = getPrisma()
  const cur = await prisma.etiquetas.findUnique({ where: { id } })
  if (!cur) return null
  const r = await prisma.etiquetas.update({
    where: { id },
    data: {
      nombre: patch.nombre !== undefined ? patch.nombre : cur.nombre,
      color: patch.color !== undefined ? patch.color : cur.color,
    },
  })
  return mapEtiqueta(r)
}

export async function eliminarEtiqueta(id) {
  try {
    await getPrisma().etiquetas.delete({ where: { id } })
    return true
  } catch (e) {
    if (e?.code === 'P2025') return false
    throw e
  }
}

/* ---------- diagramas ---------- */

export async function listarDiagramas({ q, grupoId, etiquetaId, archivados } = {}) {
  const sinGrupo = grupoId === 'none' || grupoId === '__sin_carpeta__'
  const where = {
    archived_at: archivados === true ? { not: null } : null,
  }
  if (grupoId) {
    where.grupo_id = sinGrupo ? null : grupoId
  }
  if (q && q.trim()) {
    where.titulo = { contains: q.trim(), mode: 'insensitive' }
  }
  if (etiquetaId) {
    where.diagrama_etiquetas = { some: { etiqueta_id: etiquetaId } }
  }

  const filas = await getPrisma().diagramas.findMany({
    where,
    orderBy: { updated_at: 'desc' },
    include: includeEtiquetas,
  })
  return filas.map((f) => mapDiagramaResumen(f))
}

export async function obtenerDiagrama(id) {
  const r = await getPrisma().diagramas.findUnique({
    where: { id },
    include: includeEtiquetas,
  })
  if (!r) return null
  return mapDiagrama(r)
}

export async function obtenerTipoDiagrama(id) {
  const r = await getPrisma().diagramas.findUnique({
    where: { id },
    select: { id: true, tipo: true },
  })
  return r || null
}

export async function crearDiagrama({ titulo, tipo, grupoId, modelo }) {
  const r = await getPrisma().diagramas.create({
    data: {
      titulo,
      tipo,
      grupo_id: grupoId ?? null,
      modelo,
    },
  })
  return mapDiagrama({ ...r, etiquetas: [] })
}

/**
 * Actualiza metadatos y/o modelo con control de concurrencia optimista.
 * Devuelve { ok: true, diagrama } | { ok: false, conflicto: true, revision } | { ok: false, missing: true }
 */
export async function actualizarDiagrama(id, patch) {
  const prisma = getPrisma()
  return prisma.$transaction(async (tx) => {
    const cur = await tx.diagramas.findUnique({ where: { id } })
    if (!cur) return { ok: false, missing: true }

    if (patch.revision != null && Number(patch.revision) !== Number(cur.revision)) {
      return { ok: false, conflicto: true, revision: Number(cur.revision) }
    }

    const titulo = patch.titulo !== undefined ? patch.titulo : cur.titulo
    const grupoId = patch.grupo_id !== undefined ? patch.grupo_id : cur.grupo_id
    const modelo = patch.modelo !== undefined ? patch.modelo : cur.modelo
    let archivedAt = cur.archived_at
    if (patch.archived_at !== undefined) {
      archivedAt = patch.archived_at ? new Date(patch.archived_at) : null
    }
    const bump = patch.modelo !== undefined || patch.titulo !== undefined

    const r = await tx.diagramas.update({
      where: { id },
      data: {
        titulo,
        grupo_id: grupoId,
        modelo,
        archived_at: archivedAt,
        revision: bump ? { increment: 1 } : undefined,
        updated_at: new Date(),
      },
      include: includeEtiquetas,
    })

    if (patch.etiqueta_ids !== undefined) {
      await tx.diagrama_etiquetas.deleteMany({ where: { diagrama_id: id } })
      if (patch.etiqueta_ids.length) {
        await tx.diagrama_etiquetas.createMany({
          data: patch.etiqueta_ids.map((eid) => ({
            diagrama_id: id,
            etiqueta_id: eid,
          })),
          skipDuplicates: true,
        })
      }
      const full = await tx.diagramas.findUnique({
        where: { id },
        include: includeEtiquetas,
      })
      return { ok: true, diagrama: mapDiagrama(full) }
    }

    return { ok: true, diagrama: mapDiagrama(r) }
  })
}

export async function duplicarDiagrama(id) {
  const origen = await obtenerDiagrama(id)
  if (!origen) return null

  const copia = await crearDiagrama({
    titulo: `${origen.titulo} (copia)`,
    tipo: origen.tipo,
    grupoId: origen.grupo_id,
    modelo: {
      ...origen.modelo,
      title: `${origen.modelo?.title || origen.titulo} (copia)`,
    },
  })

  if (origen.etiquetas?.length) {
    const ids = origen.etiquetas.map((e) => e.id)
    await actualizarDiagrama(copia.id, {
      revision: copia.revision,
      etiqueta_ids: ids,
    })
    return obtenerDiagrama(copia.id)
  }
  return copia
}

export async function eliminarDiagrama(id) {
  try {
    await getPrisma().diagramas.delete({ where: { id } })
    return true
  } catch (e) {
    if (e?.code === 'P2025') return false
    throw e
  }
}
