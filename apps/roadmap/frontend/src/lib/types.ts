import type { ESTADOS, PRIORIDADES } from './constants'

export type Estado = (typeof ESTADOS)[number]
export type Prioridad = (typeof PRIORIDADES)[number]
export type Tipo = 'tarea' | 'hito'
export type View = 'tabla' | 'cronograma' | 'kanban'
export type CronoScale = 'dias' | 'semanas' | 'meses'
export type SaveStatus = 'idle' | 'saving' | 'ok' | 'error' | 'offline' | 'conflict'
export type BannerKind = '' | 'warn' | 'err' | 'ok'

export type Task = {
  id: string
  padre_id: string
  tipo: Tipo
  titulo: string
  descripcion: string
  grupo: string
  estado: Estado
  prioridad: Prioridad
  responsable: string
  estimacion_dias: number | ''
  fecha_inicio: string
  fecha_fin: string
  orden: number
  creado: string
  actualizado: string
}

export type GrupoColor = {
  id: string
  nombre: string
  bg: string
  fg: string
  border: string
  swatch: string
}

export type BannerState = {
  kind: BannerKind
  message: string
  actionLabel?: string
  action?: 'retry-load' | 'retry-save' | 'reload'
}

export type ToastState = {
  message: string
  undo?: () => void
} | null

export type UiState = {
  view: View
  search: string
  filtroEstado: string
  filtroGrupos: string[]
  selectedId: string | null
  collapsedGroups: string[]
  expandedTasks: string[]
  cronoScale: CronoScale
  showSubInCrono: boolean
  cronoLabelsW: number
  tablaTituloW: number
  saveStatus: SaveStatus
  saveMsg: string
  offline: boolean
  showHint: boolean
  grupoColores: Record<string, string>
  colorPickerGrupo: string | null
  colorPickerAnchor: { top: number; left: number } | null
  banner: BannerState
  toast: ToastState
  helpOpen: boolean
  appearIds: string[]
  loading: boolean
}

export type RoadmapState = UiState & {
  tareas: Task[]
  version: number | string | null
}
