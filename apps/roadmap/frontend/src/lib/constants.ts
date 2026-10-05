export const ESTADOS = ['Por hacer', 'En curso', 'Bloqueada', 'Hecha'] as const
export const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const
export const GRUPOS_SUGERIDOS = ['Desarrollo', 'Marketing', 'Operaciones', 'Producto'] as const

export const GRUPO_PALETTE = [
  { id: 'indigo', nombre: 'Índigo', bg: '#EEF2FF', fg: '#4338CA', border: '#E0E7FF', swatch: '#6366F1' },
  { id: 'sky', nombre: 'Celeste', bg: '#E0F2FE', fg: '#0369A1', border: '#BAE6FD', swatch: '#0EA5E9' },
  { id: 'emerald', nombre: 'Esmeralda', bg: '#D1FAE5', fg: '#047857', border: '#A7F3D0', swatch: '#10B981' },
  { id: 'pink', nombre: 'Rosa', bg: '#FCE7F3', fg: '#BE185D', border: '#FBCFE8', swatch: '#EC4899' },
  { id: 'amber', nombre: 'Ámbar', bg: '#FEF3C7', fg: '#B45309', border: '#FDE68A', swatch: '#F59E0B' },
  { id: 'violet', nombre: 'Violeta', bg: '#F3E8FF', fg: '#7E22CE', border: '#E9D5FF', swatch: '#A855F7' },
  { id: 'rose', nombre: 'Rojo', bg: '#FFE4E6', fg: '#BE123C', border: '#FECDD3', swatch: '#F43F5E' },
  { id: 'teal', nombre: 'Verde azulado', bg: '#CCFBF1', fg: '#0F766E', border: '#99F6E4', swatch: '#14B8A6' },
  { id: 'orange', nombre: 'Naranja', bg: '#FFEDD5', fg: '#C2410C', border: '#FED7AA', swatch: '#F97316' },
  { id: 'slate', nombre: 'Gris', bg: '#F1F5F9', fg: '#475569', border: '#E2E8F0', swatch: '#64748B' },
] as const

export const GRUPO_COLOR_DEFAULTS: Record<string, string> = {
  Desarrollo: 'indigo',
  Marketing: 'sky',
  Operaciones: 'emerald',
  Producto: 'pink',
}

export const STORAGE_KEY = 'tubroki_roadmap_v1'
export const API = '/api/roadmap/tareas'
export const API_EXPORT = '/api/roadmap/exportar'
export const API_LOGOUT = '/api/auth/logout'
export const RUTA_ACCESO = '/acceso'
export const PLACEHOLDER_TITULO = 'Escribe el título…'
export const PLACEHOLDER_SUB = 'Escribe la subtarea…'
export const PLACEHOLDER_HITO = 'Nombre del hito…'
export const HINT_KEY = 'tubroki_roadmap_hint_v1'
export const GRUPO_COLORES_KEY = 'tubroki_roadmap_grupo_colores_v1'
export const CRONO_LABELS_W_KEY = 'tubroki_roadmap_crono_labels_w'
export const CRONO_LABELS_W_DEFAULT = 340
export const CRONO_LABELS_W_MIN = 160
export const CRONO_LABELS_W_MAX = 560
export const TITULO_W_KEY = 'tubroki_roadmap_titulo_w'
export const TITULO_W_DEFAULT = 320
export const TITULO_W_MIN = 180
export const TITULO_W_MAX = 720
export const CRONO_SCALE_KEY = 'tubroki_roadmap_crono_scale'
