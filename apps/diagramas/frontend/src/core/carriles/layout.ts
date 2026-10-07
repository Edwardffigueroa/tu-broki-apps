import { measureNode } from './measure'
import {
  COLW,
  HEAD,
  ROW_H,
  TOP,
  clamp,
  laneRows,
  type DiagramModel,
  type DiagramNode,
  type Geom,
  type LayoutResult,
} from './schema'

/** ¿Hay otro nodo en la misma celda (carril + columna + fila)? */
export function cellTaken(
  nodes: DiagramNode[],
  lane: string,
  step: number,
  row: number,
  except?: DiagramNode | null,
): boolean {
  return nodes.some(
    (o) =>
      o !== except &&
      o.lane === lane &&
      (o.step ?? 0) === step &&
      (o.row ?? 1) === row,
  )
}

/**
 * Primera celda libre a partir de (step, row) preferidos.
 * Avanza fila dentro del carril; si se acaba, pasa a la siguiente columna.
 */
export function placeFree(
  m: DiagramModel,
  laneId: string,
  preferStep: number,
  preferRow = 1,
  except?: DiagramNode | null,
): { step: number; row: number } {
  const lane = m.lanes.find((l) => l.id === laneId)
  const rows = laneRows(lane)
  let step = Math.max(1, Math.round(preferStep) || 1)
  let row = clamp(Math.round(preferRow) || 1, 1, rows)
  let guard = 0
  while (cellTaken(m.nodes, laneId, step, row, except) && guard++ < 500) {
    row++
    if (row > rows) {
      row = 1
      step++
    }
  }
  return { step, row }
}

function occKey(lane: string, c: number, r: number): string {
  return `${lane}|${c}|${r}`
}

function freeRow(
  occ: Record<string, number>,
  laneId: string,
  c: number,
  rows: number,
): number | null {
  for (let r = 0; r < rows; r++) {
    if (!occ[occKey(laneId, c, r)]) return r
  }
  return null
}

/** Geometry helpers: tops/heights per lane. */
export function laneBandGeometry(m: DiagramModel): {
  laneTops: number[]
  laneHeights: number[]
  lanesH: number
} {
  const laneTops: number[] = []
  const laneHeights: number[] = []
  let y = TOP
  m.lanes.forEach((l) => {
    laneTops.push(y)
    const h = laneRows(l) * ROW_H
    laneHeights.push(h)
    y += h
  })
  return { laneTops, laneHeights, lanesH: y - TOP }
}

export function layout(m: DiagramModel): LayoutResult {
  const idx: Record<string, number> = {}
  const laneIdx: Record<string, number> = {}
  const rowsByLane: Record<string, number> = {}
  m.nodes.forEach((n, i) => {
    idx[n.id] = i
  })
  m.lanes.forEach((l, i) => {
    laneIdx[l.id] = i
    rowsByLane[l.id] = laneRows(l)
  })

  const out: Record<string, { to: string; i: number }[]> = {}
  const indeg: Record<string, number> = {}
  m.nodes.forEach((n) => {
    out[n.id] = []
    indeg[n.id] = 0
  })
  m.edges.forEach((e, i) => {
    out[e.from].push({ to: e.to, i })
    indeg[e.to]++
  })

  const state: Record<string, number> = {}
  const back: Record<number, number> = {}
  const order: string[] = []

  function dfs(u: string) {
    state[u] = 1
    out[u].forEach((o) => {
      const s = state[o.to]
      if (s === 1) back[o.i] = 1
      else if (!s) dfs(o.to)
    })
    state[u] = 2
    order.push(u)
  }

  m.nodes.forEach((n) => {
    if (!indeg[n.id] && !state[n.id]) dfs(n.id)
  })
  m.nodes.forEach((n) => {
    if (!state[n.id]) dfs(n.id)
  })
  order.reverse()

  const preds: Record<string, string[]> = {}
  m.nodes.forEach((n) => {
    preds[n.id] = []
  })
  m.edges.forEach((e, i) => {
    if (!back[i]) preds[e.to].push(e.from)
  })

  const col: Record<string, number> = {}
  const row: Record<string, number> = {}
  const occ: Record<string, number> = {}

  // Semillas: step/row explícitos
  m.nodes.forEach((n) => {
    const rows = rowsByLane[n.lane] || 2
    if (n.step != null && Number.isFinite(+n.step) && +n.step >= 1) {
      col[n.id] = Math.round(+n.step) - 1
    }
    if (n.row != null && Number.isFinite(+n.row) && +n.row >= 1) {
      row[n.id] = clamp(Math.round(+n.row) - 1, 0, rows - 1)
    }
    if (col[n.id] != null && row[n.id] != null) {
      occ[occKey(n.lane, col[n.id], row[n.id])] = 1
    }
  })

  // Completar fila si hay columna pero no fila
  m.nodes.forEach((n) => {
    if (col[n.id] == null || row[n.id] != null) return
    const rows = rowsByLane[n.lane] || 2
    let c = col[n.id]
    let r = freeRow(occ, n.lane, c, rows)
    while (r == null) {
      c++
      r = freeRow(occ, n.lane, c, rows)
    }
    col[n.id] = c
    row[n.id] = r
    occ[occKey(n.lane, c, r)] = 1
  })

  // Auto: columna por topo + primera fila libre
  order.forEach((id) => {
    if (col[id] != null && row[id] != null) return
    const n = m.nodes[idx[id]]
    const rows = rowsByLane[n.lane] || 2
    let c = 0
    preds[id].forEach((p) => {
      if (col[p] != null) c = Math.max(c, col[p] + 1)
    })
    let r = freeRow(occ, n.lane, c, rows)
    while (r == null) {
      c++
      r = freeRow(occ, n.lane, c, rows)
    }
    col[id] = c
    row[id] = r
    occ[occKey(n.lane, c, r)] = 1
  })

  const { laneTops, laneHeights, lanesH } = laneBandGeometry(m)
  const G: Record<string, Geom> = {}
  let maxCol = 0
  m.nodes.forEach((n) => {
    const c = col[n.id] ?? 0
    const ri = row[n.id] ?? 0
    const li = laneIdx[n.lane] ?? 0
    const size = measureNode(n)
    maxCol = Math.max(maxCol, c)
    const top = laneTops[li] ?? TOP
    G[n.id] = {
      n,
      c,
      li,
      ri,
      w: size.w,
      h: size.h,
      cx: HEAD + c * COLW + COLW / 2,
      cy: top + ri * ROW_H + ROW_H / 2,
    }
  })

  return { G, maxCol, occ, back, laneTops, laneHeights, lanesH }
}

/** Escribe columnas/filas calculadas en node.step / node.row (mutación in-place). */
export function materialize(m: DiagramModel): void {
  const L = layout(m)
  m.nodes.forEach((n) => {
    const g = L.G[n.id]
    if (!g) return
    n.step = g.c + 1
    n.row = g.ri + 1
  })
}
