import { API, RUTA_ACCESO } from '../lib/constants'
import type { Diagrama, DiagramaResumen, Etiqueta, Grupo } from '../lib/types'

export class AuthError extends Error {
  constructor() {
    super('Unauthorized')
    this.name = 'AuthError'
  }
}

export class ConflictError extends Error {
  revision?: number
  constructor(revision?: number) {
    super('Conflict')
    this.name = 'ConflictError'
    this.revision = revision
  }
}

export function irAAcceso(): void {
  window.location.replace(
    RUTA_ACCESO + '?volver=' + encodeURIComponent(window.location.pathname + window.location.search),
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
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: string
    revision?: number
  }
  if (res.status === 409) throw new ConflictError(data.revision)
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data as T
}

export async function listarDiagramas(params: {
  q?: string
  grupo?: string | null
  etiqueta?: string | null
  archivados?: boolean
}): Promise<DiagramaResumen[]> {
  const sp = new URLSearchParams()
  if (params.q) sp.set('q', params.q)
  if (params.grupo) sp.set('grupo', params.grupo)
  if (params.etiqueta) sp.set('etiqueta', params.etiqueta)
  if (params.archivados) sp.set('archivados', '1')
  const qs = sp.toString()
  const data = await req<{ diagramas: DiagramaResumen[] }>(
    API.diagramas + (qs ? `?${qs}` : ''),
  )
  return data.diagramas
}

export async function obtenerDiagrama(id: string): Promise<Diagrama> {
  return req<Diagrama>(`${API.diagrama}?id=${encodeURIComponent(id)}`)
}

export async function crearDiagrama(body: {
  titulo?: string
  grupo_id?: string | null
  modelo?: unknown
}): Promise<Diagrama> {
  return req<Diagrama>(API.diagramas, { method: 'POST', body: JSON.stringify(body) })
}

export async function actualizarDiagrama(
  id: string,
  body: Record<string, unknown>,
): Promise<Diagrama> {
  return req<Diagrama>(`${API.diagrama}?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function eliminarDiagrama(id: string): Promise<void> {
  await req(`${API.diagrama}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function duplicarDiagrama(id: string): Promise<Diagrama> {
  return req<Diagrama>(`${API.duplicar}?id=${encodeURIComponent(id)}`, { method: 'POST' })
}

export async function listarGrupos(): Promise<Grupo[]> {
  const data = await req<{ grupos: Grupo[] }>(API.grupos)
  return data.grupos
}

export async function crearGrupo(nombre: string, color?: string | null): Promise<Grupo> {
  return req<Grupo>(API.grupos, {
    method: 'POST',
    body: JSON.stringify({ nombre, color: color || null }),
  })
}

export async function actualizarGrupo(
  id: string,
  body: { nombre?: string; color?: string | null; orden?: number },
): Promise<Grupo> {
  return req<Grupo>(`${API.grupos}?id=${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function eliminarGrupo(id: string): Promise<void> {
  await req(`${API.grupos}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function listarEtiquetas(): Promise<Etiqueta[]> {
  const data = await req<{ etiquetas: Etiqueta[] }>(API.etiquetas)
  return data.etiquetas
}

export async function crearEtiqueta(nombre: string, color?: string | null): Promise<Etiqueta> {
  return req<Etiqueta>(API.etiquetas, {
    method: 'POST',
    body: JSON.stringify({ nombre, color: color || null }),
  })
}

export async function eliminarEtiqueta(id: string): Promise<void> {
  await req(`${API.etiquetas}?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function logout(): Promise<void> {
  try {
    await fetch(API.logout, { method: 'POST', credentials: 'include' })
  } catch {
    /* */
  }
  irAAcceso()
}
