export interface Etiqueta {
  id: string
  nombre: string
  color: string | null
  created_at?: string
}

export interface Grupo {
  id: string
  nombre: string
  color: string | null
  orden: number
  created_at?: string
  updated_at?: string
}

export interface DiagramaResumen {
  id: string
  titulo: string
  tipo: string
  grupo_id: string | null
  revision: number
  archived_at: string | null
  created_at: string
  updated_at: string
  etiquetas: Etiqueta[]
}

export interface Diagrama extends DiagramaResumen {
  modelo: Record<string, unknown>
}

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'
