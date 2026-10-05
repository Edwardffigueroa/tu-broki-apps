import { COLW, HEAD, LH, TOP, TYPES, type DiagramModel, type Geom, type LayoutResult } from './schema'

export function layout(m: DiagramModel): LayoutResult {
  const idx: Record<string, number> = {}
  const laneIdx: Record<string, number> = {}
  m.nodes.forEach((n, i) => {
    idx[n.id] = i
  })
  m.lanes.forEach((l, i) => {
    laneIdx[l.id] = i
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
  const occ: Record<string, number> = {}
  m.nodes.forEach((n) => {
    if (n.step != null) {
      col[n.id] = n.step - 1
      occ[n.lane + '|' + (n.step - 1)] = 1
    }
  })

  order.forEach((id) => {
    if (col[id] != null) return
    const n = m.nodes[idx[id]]
    let c = 0
    preds[id].forEach((p) => {
      if (col[p] != null) c = Math.max(c, col[p] + 1)
    })
    while (occ[n.lane + '|' + c]) c++
    col[id] = c
    occ[n.lane + '|' + c] = 1
  })

  const G: Record<string, Geom> = {}
  let maxCol = 0
  m.nodes.forEach((n) => {
    const c = col[n.id]
    const li = laneIdx[n.lane]
    const t = TYPES[n.type]
    maxCol = Math.max(maxCol, c)
    G[n.id] = {
      n,
      c,
      li,
      w: t.w,
      h: t.h,
      cx: HEAD + c * COLW + COLW / 2,
      cy: TOP + li * LH + LH / 2,
    }
  })

  return { G, maxCol, occ, back }
}

/** Escribe columnas calculadas en node.step (mutación in-place). */
export function materialize(m: DiagramModel): void {
  const L = layout(m)
  m.nodes.forEach((n) => {
    n.step = L.G[n.id].c + 1
  })
}
