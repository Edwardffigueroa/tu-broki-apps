import { API, API_EXPORT, API_LOGOUT, RUTA_ACCESO, STORAGE_KEY } from '../lib/constants'
import type { Task } from '../lib/types'

export class AuthError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'AuthError'
  }
}

export class ConflictError extends Error {
  constructor() {
    super('Conflict')
    this.name = 'ConflictError'
  }
}

export function irAAcceso(): void {
  window.location.replace(RUTA_ACCESO + '?volver=' + encodeURIComponent(window.location.pathname))
}

export function cacheLocal(tareas: Task[], version: number | string | null): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ tareas, version, savedAt: Date.now() }),
    )
  } catch {
    /* quota */
  }
}

export function readLocalCache(): { tareas: Task[]; version: number | string | null } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as { tareas?: Task[]; version?: number | string | null }
    return { tareas: data.tareas || [], version: data.version ?? null }
  } catch {
    return null
  }
}

export async function loadTareas(): Promise<{ tareas: Task[]; version: number | string | null }> {
  const res = await fetch(API, { cache: 'no-store', credentials: 'include' })
  if (res.status === 401) throw new AuthError()
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = (await res.json()) as { tareas?: Task[]; version?: number | string | null }
  return { tareas: data.tareas || [], version: data.version ?? null }
}

export async function saveTareas(
  tareas: Task[],
  version: number | string | null,
): Promise<{ version: number | string | null }> {
  const res = await fetch(API, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tareas, version }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    version?: number | string | null
    error?: string
  }
  if (res.status === 401) throw new AuthError()
  if (res.status === 409) throw new ConflictError()
  if (!res.ok) throw new Error(data.error || 'Error al guardar')
  return { version: data.version ?? null }
}

export async function exportCsv(): Promise<void> {
  const res = await fetch(API_EXPORT, { credentials: 'include' })
  if (res.status === 401) {
    irAAcceso()
    return
  }
  if (!res.ok) throw new Error('No se pudo exportar')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'roadmap-tubroki.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export async function logout(): Promise<void> {
  try {
    await fetch(API_LOGOUT, { method: 'POST', credentials: 'include' })
  } catch {
    /* */
  }
  irAAcceso()
}
