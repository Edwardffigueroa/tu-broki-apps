/** Tipos y constantes del motor de diagramas de carriles (swimlane). */

export type NodeType = 'start' | 'task' | 'decision' | 'document' | 'end'

export interface Lane {
  id: string
  name: string
}

export interface DiagramNode {
  id: string
  lane: string
  type: NodeType
  label: string
  step?: number
  note?: string
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
  w: number
  h: number
  def: string
}

export const HEAD = 116
export const TOP = 32
export const COLW = 176
export const LH = 128

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
  li: number
  w: number
  h: number
  cx: number
  cy: number
}

export interface LayoutResult {
  G: Record<string, Geom>
  maxCol: number
  occ: Record<string, number>
  back: Record<number, number>
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
