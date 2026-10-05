import { COLW, HEAD, LH, TOP, type Edge, type Geom, type LayoutResult, type Port } from './schema'

export type Point = [number, number]

/** Distancia que la línea recorre perpendicular a la forma antes de girar. */
const STUB = 14

/** Punto de anclaje de un puerto sobre el contorno de la forma. */
export function anchor(g: Geom, port: Port): Point {
  switch (port) {
    case 'top':
      return [g.cx, g.cy - g.h / 2]
    case 'bottom':
      return [g.cx, g.cy + g.h / 2]
    case 'left':
      return [g.cx - g.w / 2, g.cy]
    default:
      return [g.cx + g.w / 2, g.cy]
  }
}

function dir(port: Port): Point {
  switch (port) {
    case 'top':
      return [0, -1]
    case 'bottom':
      return [0, 1]
    case 'left':
      return [-1, 0]
    default:
      return [1, 0]
  }
}

function isHorizontal(port: Port): boolean {
  return port === 'left' || port === 'right'
}

/** Puerto de `g` más cercano al punto `p`. */
export function nearestPort(g: Geom, p: { x: number; y: number }): Port {
  const dx = (p.x - g.cx) / (g.w / 2)
  const dy = (p.y - g.cy) / (g.h / 2)
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'bottom' : 'top'
}

/**
 * Resuelve los puertos de una conexión: respeta los explícitos y completa el
 * que falte con el lado de la otra forma más cercano al anclaje conocido.
 */
export function resolvePorts(a: Geom, b: Geom, e: Pick<Edge, 'fromPort' | 'toPort'>): { fp: Port; tp: Port } | null {
  if (!e.fromPort && !e.toPort) return null
  let fp = e.fromPort
  let tp = e.toPort
  if (fp && !tp) {
    const pa = anchor(a, fp)
    tp = nearestPort(b, { x: pa[0], y: pa[1] })
  } else if (tp && !fp) {
    const pb = anchor(b, tp)
    fp = nearestPort(a, { x: pb[0], y: pb[1] })
  }
  return { fp: fp!, tp: tp! }
}

/** Ruta ortogonal cuando los puertos están definidos. */
export function routePorts(a: Geom, b: Geom, fp: Port, tp: Port): Point[] {
  const pa = anchor(a, fp)
  const pb = anchor(b, tp)
  const da = dir(fp)
  const db = dir(tp)
  const p1: Point = [pa[0] + da[0] * STUB, pa[1] + da[1] * STUB]
  const p2: Point = [pb[0] + db[0] * STUB, pb[1] + db[1] * STUB]
  const hA = isHorizontal(fp)
  const hB = isHorizontal(tp)

  let mid: Point[]
  if (hA && hB) {
    const forward = (fp === 'right' && p2[0] >= p1[0]) || (fp === 'left' && p2[0] <= p1[0])
    const entersOk = (tp === 'left' && p1[0] <= p2[0]) || (tp === 'right' && p1[0] >= p2[0])
    if (forward && entersOk) {
      const xm = (p1[0] + p2[0]) / 2
      mid = [
        [xm, p1[1]],
        [xm, p2[1]],
      ]
    } else {
      // Conexión de retorno: baja (o sube) por el borde del carril de origen.
      const down = b.li >= a.li
      const yRun = down ? TOP + (a.li + 1) * LH - 9 : TOP + a.li * LH + 9
      mid = [
        [p1[0], yRun],
        [p2[0], yRun],
      ]
    }
  } else if (hA && !hB) {
    mid = [[p2[0], p1[1]]]
  } else if (!hA && hB) {
    mid = [[p1[0], p2[1]]]
  } else {
    let ym: number
    if (fp === tp) {
      // Mismo lado: la vuelta corre un poco más afuera que el stub más alejado,
      // para no solapar la línea con el borde de la figura.
      ym = fp === 'bottom' ? Math.max(p1[1], p2[1]) + STUB : Math.min(p1[1], p2[1]) - STUB
    } else {
      ym = (p1[1] + p2[1]) / 2
    }
    mid = [
      [p1[0], ym],
      [p2[0], ym],
    ]
  }
  return [pa, p1, ...mid, p2, pb]
}

/** Ruta automática (sin puertos), heredada del prototipo. */
export function route(a: Geom, b: Geom, L: LayoutResult): Point[] {
  let pts: Point[]
  if (a.c < b.c) {
    const sx = a.cx + a.w / 2
    const sy = a.cy
    const ex = b.cx - b.w / 2
    const ey = b.cy
    if (Math.abs(sy - ey) < 1) {
      pts = [
        [sx, sy],
        [ex, ey],
      ]
    } else {
      let kSrc = 0
      let kTgt = 0
      for (let c = a.c + 1; c < b.c; c++) {
        if (L.occ[b.n.lane + '|' + c]) kSrc++
        if (L.occ[a.n.lane + '|' + c]) kTgt++
      }
      const x = kTgt < kSrc ? HEAD + b.c * COLW : HEAD + (a.c + 1) * COLW
      pts = [
        [sx, sy],
        [x, sy],
        [x, ey],
        [ex, ey],
      ]
    }
  } else if (a.c === b.c) {
    pts =
      b.li > a.li
        ? [
            [a.cx, a.cy + a.h / 2],
            [b.cx, b.cy - b.h / 2],
          ]
        : [
            [a.cx, a.cy - a.h / 2],
            [b.cx, b.cy + b.h / 2],
          ]
  } else {
    const yRun = TOP + (a.li + 1) * LH - 9
    const down = b.li > a.li
    pts = [
      [a.cx, a.cy + a.h / 2],
      [a.cx, yRun],
      [b.cx, yRun],
      [b.cx, down ? b.cy - b.h / 2 : b.cy + b.h / 2],
    ]
  }
  return pts
}

/** Punto de entrada único: usa puertos si existen, si no la ruta automática. */
export function routeEdge(a: Geom, b: Geom, L: LayoutResult, e: Edge): Point[] {
  const ports = resolvePorts(a, b, e)
  return ports ? routePorts(a, b, ports.fp, ports.tp) : route(a, b, L)
}

export function dedupe(pts: Point[]): Point[] {
  return pts.filter(
    (p, i) => !i || Math.abs(p[0] - pts[i - 1][0]) > 0.5 || Math.abs(p[1] - pts[i - 1][1]) > 0.5,
  )
}

export function pathD(pts: Point[], r = 10): string {
  let d = 'M' + pts[0][0] + ' ' + pts[0][1]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const a = pts[i - 1]
    const b = pts[i + 1]
    const l1 = Math.hypot(p[0] - a[0], p[1] - a[1])
    const l2 = Math.hypot(b[0] - p[0], b[1] - p[1])
    if (!l1 || !l2) continue
    const rr = Math.min(r, l1 / 2, l2 / 2)
    d +=
      ' L' +
      (p[0] + ((a[0] - p[0]) / l1) * rr) +
      ' ' +
      (p[1] + ((a[1] - p[1]) / l1) * rr) +
      ' Q' +
      p[0] +
      ' ' +
      p[1] +
      ' ' +
      (p[0] + ((b[0] - p[0]) / l2) * rr) +
      ' ' +
      (p[1] + ((b[1] - p[1]) / l2) * rr)
  }
  const e = pts[pts.length - 1]
  return d + ' L' + e[0] + ' ' + e[1]
}

export function labelAt(pts: Point[], text: string): { x: number; y: number; w: number } {
  const w = text.length * 6.3 + 16
  let best: { score: number; x: number; y: number } | null = null
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const len = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1])
    const horiz = Math.abs(a[1] - b[1]) < 1
    const score = len + (horiz && len >= w + 10 ? 1000 : 0)
    if (!best || score > best.score) {
      best = { score, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 }
    }
  }
  return { x: best!.x, y: best!.y, w }
}
