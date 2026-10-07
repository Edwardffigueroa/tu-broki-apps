/** Tipos y constantes del motor de diagramas de carriles (swimlane). */

export type NodeType = 'start' | 'task' | 'decision' | 'document' | 'end'

export interface Lane {
  id: string
  name: string
  /** Filas de grid dentro del carril (1–8). Por defecto {@link DEFAULT_LANE_ROWS}. */
  rows?: number
}

export interface DiagramNode {
  id: string
  lane: string
  type: NodeType
  label: string
  step?: number
  /** Fila dentro del carril (1-based). Si falta, el layout la asigna. */
  row?: number
  note?: string
  /** Ancho manual (px). Si falta, se calcula según el texto. */
  w?: number
  /** Alto manual (px). Si falta, se calcula según el texto. */
  h?: number
}

export type Port = 'top' | 'right' | 'bottom' | 'left'
export const PORTS: Port[] = ['top', 'right', 'bottom', 'left']
export const PORT_NAMES: Record<Port, string> = {
  top: 'Arriba',
  right: 'Derecha',
  bottom: 'Abajo',
  left: 'Izquierda',
}
export const PORT_ALIAS: Record<string, Port> = {
  top: 'top',
  arriba: 'top',
  up: 'top',
  n: 'top',
  right: 'right',
  derecha: 'right',
  e: 'right',
  bottom: 'bottom',
  abajo: 'bottom',
  down: 'bottom',
  s: 'bottom',
  left: 'left',
  izquierda: 'left',
  w: 'left',
}

export interface Edge {
  from: string
  to: string
  label?: string
  /** Lado por donde sale la conexión. Si falta, se elige automáticamente. */
  fromPort?: Port
  /** Lado por donde entra la conexión. Si falta, se elige automáticamente. */
  toPort?: Port
}

/** Nota de proceso (Markdown + Mermaid). Vive debajo del swimlane, no en un paso. */
export interface DocCard {
  id: string
  title?: string
  /** Markdown GFM. Usa ```mermaid para diagramas. */
  body: string
}

export interface DiagramModel {
  title: string
  lanes: Lane[]
  nodes: DiagramNode[]
  edges: Edge[]
  /** Cards de documentación del proceso completo (MD + Mermaid). */
  docs?: DocCard[]
}

export interface TypeMeta {
  name: string
  /** Ancho mínimo; el layout puede crecer según el texto (hasta ~COLW). */
  w: number
  /** Alto mínimo; el layout puede crecer según el texto (hasta ~LH). */
  h: number
  def: string
}

export const HEAD = 132
export const TOP = 36
/** Ancho de columna: deja aire entre nodos y espacio para stubs de las líneas. */
export const COLW = 220
/** Altura de una fila de grid dentro de un carril. */
export const ROW_H = 128
/** Filas por carril si no se especifica `lanes[].rows`. */
export const DEFAULT_LANE_ROWS = 2
/** Alias histórico: una fila de grid (antes era la altura total del carril). */
export const LH = ROW_H
export const MIN_LANE_ROWS = 1
export const MAX_LANE_ROWS = 8

/** Número de filas de un carril (clamp 1–8, default 2). */
export function laneRows(lane: Pick<Lane, 'rows'> | undefined | null): number {
  const raw = lane?.rows
  if (raw == null || !Number.isFinite(+raw)) return DEFAULT_LANE_ROWS
  return Math.min(MAX_LANE_ROWS, Math.max(MIN_LANE_ROWS, Math.round(+raw)))
}

export const TYPES: Record<NodeType, TypeMeta> = {
  start: { name: 'Inicio', w: 112, h: 48, def: 'Inicio' },
  task: { name: 'Tarea', w: 132, h: 60, def: 'Nueva tarea' },
  decision: { name: 'Decisión', w: 148, h: 88, def: '¿Condición?' },
  document: { name: 'Documento', w: 132, h: 64, def: 'Documento' },
  end: { name: 'Fin', w: 112, h: 48, def: 'Fin' },
}

export const TYPE_ORDER: NodeType[] = ['start', 'task', 'decision', 'document', 'end']

export const ALIAS: Record<string, NodeType> = {
  inicio: 'start',
  tarea: 'task',
  proceso: 'task',
  process: 'task',
  decisión: 'decision',
  decision: 'decision',
  documento: 'document',
  doc: 'document',
  fin: 'end',
  final: 'end',
  stop: 'end',
}

export interface Geom {
  n: DiagramNode
  c: number
  /** Índice del carril (0-based). */
  li: number
  /** Fila dentro del carril (0-based). */
  ri: number
  w: number
  h: number
  cx: number
  cy: number
}

export interface LayoutResult {
  G: Record<string, Geom>
  maxCol: number
  /** Ocupación `laneId|col|row` → 1 */
  occ: Record<string, number>
  back: Record<number, number>
  /** Y de inicio de cada carril (incluye TOP). */
  laneTops: number[]
  /** Altura total de cada carril (rows × ROW_H). */
  laneHeights: number[]
  /** Altura total del bloque de carriles (sin TOP). */
  lanesH: number
}

export function slug(s: string): string {
  return (
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'x'
  )
}

export function clamp(v: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, v))
}

export function wrap(text: string, max: number, maxLines: number): string[] {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w0 of words) {
    let w = w0
    while (w.length > max) {
      if (cur) {
        lines.push(cur)
        cur = ''
      }
      lines.push(w.slice(0, max))
      w = w.slice(max)
    }
    if (!cur) cur = w
    else if ((cur + ' ' + w).length <= max) cur += ' ' + w
    else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur) lines.push(cur)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, max - 1).replace(/\s+$/, '') + '…'
  }
  return lines
}

export function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  )
}

export function nextNodeId(nodes: DiagramNode[]): string {
  let k = 1
  while (nodes.some((n) => n.id === 'n' + k)) k++
  return 'n' + k
}

export function nextDocId(docs: DocCard[] | undefined): string {
  const list = docs || []
  let k = 1
  while (list.some((d) => d.id === 'doc' + k)) k++
  return 'doc' + k
}
