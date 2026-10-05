export const RUTA_ACCESO = '/acceso'
export const BASE = '/diagramas'

export const API = {
  diagramas: '/api/diagramas/diagramas',
  diagrama: '/api/diagramas/diagrama',
  duplicar: '/api/diagramas/duplicar',
  grupos: '/api/diagramas/grupos',
  etiquetas: '/api/diagramas/etiquetas',
  logout: '/api/auth/logout',
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-CO', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
