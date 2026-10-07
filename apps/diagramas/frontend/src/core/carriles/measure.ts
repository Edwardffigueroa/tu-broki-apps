import { COLW, ROW_H, TYPES, clamp, wrap, type DiagramNode, type NodeType } from './schema'

/** Ancho aproximado de un carácter en el label del nodo (~12.5px Instrument Sans). */
const CHAR_W = 6.5
const LINE_H = 14.5

const PAD_X: Record<NodeType, number> = {
  start: 28,
  end: 28,
  task: 22,
  decision: 40,
  document: 22,
}

const PAD_Y: Record<NodeType, number> = {
  start: 18,
  end: 18,
  task: 20,
  decision: 32,
  document: 24,
}

const MAX_LINES: Record<NodeType, number> = {
  start: 3,
  end: 3,
  task: 4,
  decision: 4,
  document: 4,
}

/** Tope para que el nodo quepa en la celda (columna × fila). */
export const NODE_MAX_W = COLW - 16
export const NODE_MAX_H = ROW_H - 20

export interface NodeMeasure {
  w: number
  h: number
  lines: string[]
  /** Caracteres por línea usados al envolver. */
  charsPerLine: number
  /** true si w o h vienen del nodo (resize manual). */
  manual: boolean
}

export function minNodeSize(type: NodeType): { w: number; h: number } {
  return {
    w: Math.round(TYPES[type].w * 0.75),
    h: Math.round(TYPES[type].h * 0.75),
  }
}

export function clampNodeSize(type: NodeType, w: number, h: number): { w: number; h: number } {
  const min = minNodeSize(type)
  return {
    w: Math.round(clamp(w, min.w, NODE_MAX_W)),
    h: Math.round(clamp(h, min.h, NODE_MAX_H)),
  }
}

function autoWidth(type: NodeType, label: string): number {
  const minW = TYPES[type].w
  const padX = PAD_X[type]
  const oneLineW = Math.ceil(label.length * CHAR_W + padX)
  if (oneLineW <= minW) return minW
  return Math.min(NODE_MAX_W, Math.max(minW, oneLineW))
}

function autoHeight(type: NodeType, w: number, lineCount: number): number {
  const minH = TYPES[type].h
  const padY = PAD_Y[type]
  let h = Math.max(minH, Math.ceil(padY + lineCount * LINE_H))
  if (type === 'decision') {
    h = Math.max(h, Math.min(NODE_MAX_H, Math.round(w * 0.58)))
  } else if (type === 'start' || type === 'end') {
    h = Math.max(h, Math.min(64, 36 + (lineCount - 1) * LINE_H))
  } else if (type === 'document') {
    h = Math.max(h, minH, padY + lineCount * LINE_H + 8)
  }
  return Math.min(NODE_MAX_H, h)
}

/**
 * Calcula ancho/alto del shape.
 * Si el nodo trae `w`/`h`, se respetan (clamp a la celda); si no, se deriva del texto.
 */
export function measureNode(n: Pick<DiagramNode, 'type' | 'label' | 'w' | 'h'>): NodeMeasure {
  const type = n.type
  const label = String(n.label || TYPES[type].def || '').trim() || TYPES[type].def
  const padX = PAD_X[type]
  const maxLines = MAX_LINES[type]
  const manualW = n.w != null && Number.isFinite(+n.w)
  const manualH = n.h != null && Number.isFinite(+n.h)

  let w = manualW ? +n.w! : autoWidth(type, label)
  w = clampNodeSize(type, w, TYPES[type].h).w

  const usable = type === 'decision' ? Math.max(48, w * 0.55) : Math.max(24, w - padX)
  const charsPerLine = Math.max(6, Math.floor(usable / CHAR_W))
  const lines = wrap(label, charsPerLine, maxLines)

  let h = manualH ? +n.h! : autoHeight(type, w, lines.length)
  h = clampNodeSize(type, w, h).h

  return { w, h, lines, charsPerLine, manual: manualW || manualH }
}
