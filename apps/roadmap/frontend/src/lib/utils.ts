import type { CSSProperties } from 'react'
import {
  CRONO_LABELS_W_DEFAULT,
  CRONO_LABELS_W_KEY,
  CRONO_LABELS_W_MAX,
  CRONO_LABELS_W_MIN,
  GRUPO_COLOR_DEFAULTS,
  GRUPO_COLORES_KEY,
  GRUPO_PALETTE,
  PLACEHOLDER_HITO,
  PLACEHOLDER_SUB,
  PLACEHOLDER_TITULO,
  TITULO_W_DEFAULT,
  TITULO_W_KEY,
  TITULO_W_MAX,
  TITULO_W_MIN,
} from './constants'
import type { GrupoColor, Task } from './types'

export function uid(): string {
  return 't_' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const d = new Date(iso + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

export function daysBetween(a: string, b: string): number {
  const da = parseDate(a)
  const db = parseDate(b)
  if (!da || !db) return 0
  return Math.round((db.getTime() - da.getTime()) / 86400000)
}

export function estadoClass(e: string): string {
  return 'chip-estado-' + String(e || '').toLowerCase().replace(/\s+/g, '-')
}

export function prioClass(p: string): string {
  return 'chip-prio-' + String(p || '').toLowerCase()
}

export function barEstadoClass(e: string): string {
  return 'bar-estado-' + String(e || '').toLowerCase().replace(/\s+/g, '-')
}

function hashGrupo(nombre: string): number {
  let h = 0
  const s = String(nombre || '')
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h % GRUPO_PALETTE.length
}

export function colorDeGrupo(g: string, grupoColores: Record<string, string>): GrupoColor {
  const nombre = g || 'Sin grupo'
  const elegido = grupoColores[nombre]
  if (elegido) {
    const found = GRUPO_PALETTE.find((p) => p.id === elegido)
    if (found) return found
  }
  const def = GRUPO_COLOR_DEFAULTS[nombre]
  if (def) {
    const found = GRUPO_PALETTE.find((p) => p.id === def)
    if (found) return found
  }
  return GRUPO_PALETTE[hashGrupo(nombre)]
}

export function grupoStyle(g: string, grupoColores: Record<string, string>): CSSProperties {
  const c = colorDeGrupo(g, grupoColores)
  return { background: c.bg, color: c.fg, borderColor: c.border }
}

export function isPlaceholderTitle(titulo: string): boolean {
  return (
    titulo === PLACEHOLDER_TITULO ||
    titulo === PLACEHOLDER_SUB ||
    titulo === PLACEHOLDER_HITO ||
    titulo === 'Nueva tarea' ||
    titulo === 'Nueva subtarea' ||
    titulo === 'Nuevo hito'
  )
}

export function padres(tareas: Task[]): Task[] {
  return tareas.filter((t) => !t.padre_id)
}

export function hijos(tareas: Task[], id: string): Task[] {
  return tareas
    .filter((t) => t.padre_id === id)
    .sort((a, b) => a.orden - b.orden)
}

export function progreso(tareas: Task[], id: string): { done: number; total: number } | null {
  const kids = hijos(tareas, id)
  if (!kids.length) return null
  return { done: kids.filter((k) => k.estado === 'Hecha').length, total: kids.length }
}

export function gruposExistentes(tareas: Task[]): string[] {
  const set = new Set<string>()
  for (const t of tareas) {
    if (t.grupo) set.add(t.grupo)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'))
}

export function matchesFilters(
  t: Task,
  search: string,
  filtroEstado: string,
  filtroGrupos: string[],
): boolean {
  if (filtroEstado && t.estado !== filtroEstado) return false
  if (filtroGrupos.length && !filtroGrupos.includes(t.grupo || 'Sin grupo')) return false
  const q = search.trim().toLowerCase()
  if (!q) return true
  const blob = `${t.titulo} ${t.descripcion} ${t.responsable}`.toLowerCase()
  return blob.includes(q)
}

export function filteredPadres(
  tareas: Task[],
  search: string,
  filtroEstado: string,
  filtroGrupos: string[],
): Task[] {
  return padres(tareas)
    .filter((p) => {
      if (matchesFilters(p, search, filtroEstado, filtroGrupos)) return true
      return hijos(tareas, p.id).some((h) => matchesFilters(h, search, filtroEstado, filtroGrupos))
    })
    .sort((a, b) => {
      const g = (a.grupo || '').localeCompare(b.grupo || '', 'es')
      if (g !== 0) return g
      return a.orden - b.orden
    })
}

export function leerTituloW(): number {
  try {
    const n = Number(localStorage.getItem(TITULO_W_KEY))
    if (Number.isFinite(n) && n > 0) {
      return Math.min(TITULO_W_MAX, Math.max(TITULO_W_MIN, Math.round(n)))
    }
  } catch {
    /* */
  }
  return TITULO_W_DEFAULT
}

export function leerCronoLabelsW(): number {
  try {
    const raw = localStorage.getItem(CRONO_LABELS_W_KEY)
    if (raw == null || raw === '') return CRONO_LABELS_W_DEFAULT
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 280) {
      try {
        localStorage.setItem(CRONO_LABELS_W_KEY, String(CRONO_LABELS_W_DEFAULT))
      } catch {
        /* */
      }
      return CRONO_LABELS_W_DEFAULT
    }
    return Math.min(CRONO_LABELS_W_MAX, Math.max(CRONO_LABELS_W_MIN, Math.round(n)))
  } catch {
    /* */
  }
  return CRONO_LABELS_W_DEFAULT
}

export function leerGrupoColores(): Record<string, string> {
  try {
    const raw = localStorage.getItem(GRUPO_COLORES_KEY)
    if (!raw) return {}
    const obj = JSON.parse(raw) as Record<string, unknown>
    if (!obj || typeof obj !== 'object') return {}
    const out: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (typeof k === 'string' && GRUPO_PALETTE.some((p) => p.id === v)) out[k] = String(v)
    }
    return out
  } catch {
    return {}
  }
}

export function guardarGrupoColores(colores: Record<string, string>): void {
  try {
    localStorage.setItem(GRUPO_COLORES_KEY, JSON.stringify(colores))
  } catch {
    /* */
  }
}

export function computeCronoRange(tasks: Task[]): { min: string; max: string; days: number } {
  const today = todayStr()
  let min = today
  let max = addDays(today, 45)
  for (const t of tasks) {
    if (t.fecha_inicio && t.fecha_inicio < min) min = t.fecha_inicio
    if (t.fecha_fin && t.fecha_fin > max) max = t.fecha_fin
    if (t.tipo === 'hito' && t.fecha_inicio && t.fecha_inicio > max) max = t.fecha_inicio
  }
  min = addDays(min, -3)
  max = addDays(max, 7)
  return { min, max, days: daysBetween(min, max) + 1 }
}

export function cronoPxPerDay(scale: 'dias' | 'semanas' | 'meses'): number {
  return scale === 'dias' ? 40 : scale === 'meses' ? 8 : 22
}

export type BarGeom =
  | { kind: 'milestone'; left: number }
  | { kind: 'bar'; left: number; width: number }

export function barGeometry(
  t: Task,
  range: { min: string },
  px: number,
): BarGeom | null {
  if (t.tipo === 'hito') {
    if (!t.fecha_inicio) return null
    return { kind: 'milestone', left: daysBetween(range.min, t.fecha_inicio) * px - 5 }
  }
  if (!t.fecha_inicio || !t.fecha_fin) return null
  return {
    kind: 'bar',
    left: daysBetween(range.min, t.fecha_inicio) * px,
    width: Math.max((daysBetween(t.fecha_inicio, t.fecha_fin) + 1) * px, 10),
  }
}
