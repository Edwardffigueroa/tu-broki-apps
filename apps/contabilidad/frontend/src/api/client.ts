import { API, RUTA_ACCESO } from '../lib/constants'
import type { Cfg, Meta, Movimiento } from '../lib/types'

export class AuthError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'AuthError'
  }
}

export function irAAcceso(): void {
  window.location.replace(
    RUTA_ACCESO + '?volver=' + encodeURIComponent(window.location.pathname),
  )
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })
  if (res.status === 401) throw new AuthError()
  if (res.headers.get('content-type')?.includes('text/csv')) {
    return (await res.text()) as T
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data as T
}

export async function loadAll(): Promise<{
  movimientos: Movimiento[]
  metas: Record<string, Meta>
  config: Cfg
}> {
  const [m, g, c] = await Promise.all([
    req<{ movimientos: Movimiento[] }>(API.movimientos),
    req<{ metas: Record<string, Meta> }>(API.metas),
    req<{ config: Cfg }>(API.config),
  ])
  return { movimientos: m.movimientos || [], metas: g.metas || {}, config: c.config }
}

export async function createMov(body: Partial<Movimiento>): Promise<Movimiento> {
  return req(API.movimientos, { method: 'POST', body: JSON.stringify(body) })
}

export async function updateMov(id: string, body: Partial<Movimiento>): Promise<Movimiento> {
  return req(`${API.movimiento}?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function deleteMov(id: string): Promise<void> {
  await req(`${API.movimiento}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function saveMeta(body: {
  mes: string
  unidades: Record<string, number>
  ventas: number
  utilidad: number
}): Promise<Meta & { mes: string }> {
  return req(API.metas, { method: 'PUT', body: JSON.stringify(body) })
}

export async function saveConfig(body: Partial<Cfg>): Promise<Cfg> {
  const data = await req<{ config: Cfg }>(API.config, {
    method: 'PUT',
    body: JSON.stringify(body),
  })
  return data.config
}

export async function downloadCsv(): Promise<void> {
  const res = await fetch(API.exportar, { credentials: 'include', cache: 'no-store' })
  if (res.status === 401) throw new AuthError()
  if (!res.ok) throw new Error('No se pudo exportar')
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition') || ''
  const match = /filename="([^"]+)"/.exec(cd)
  const name = match?.[1] || 'TuBroki_movimientos.csv'
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
