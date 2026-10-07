import { COLW, HEAD, type Edge, type Geom, type LayoutResult, type Port } from './schema'

function laneEdgeY(L: LayoutResult, li: number, which: 'top' | 'bottom', bias = 0): number {
  const top = L.laneTops[li] ?? 0
  const h = L.laneHeights[li] ?? 0
  // bias > 0 empuja el corredor hacia el interior del carril (evita apilar líneas).
  const pad = 9 + Math.max(0, bias)
  return which === 'top' ? top + pad : top + h - pad
}

/** Desfase estable por arista para no apilar corredores paralelos. */
export function corridorBias(edgeIndex: number): number {
  const slot = ((edgeIndex % 5) + 5) % 5
  return slot * 11
}

export type Point = [number, number]

/** Distancia que la línea recorre perpendicular a la forma antes de girar. */
const STUB = 28

/** Radio por defecto de las esquinas redondeadas de las conexiones. */
export const CORNER_R = 24

/** Factor de control cúbico ≈ arco de 90° (kappa). */
const CORNER_KAPPA = 0.5523

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
export function routePorts(
  a: Geom,
  b: Geom,
  fp: Port,
  tp: Port,
  L?: LayoutResult,
  edgeIndex = 0,
): Point[] {
  const pa = anchor(a, fp)
  const pb = anchor(b, tp)
  const da = dir(fp)
  const db = dir(tp)
  const p1: Point = [pa[0] + da[0] * STUB, pa[1] + da[1] * STUB]
  const p2: Point = [pb[0] + db[0] * STUB, pb[1] + db[1] * STUB]
  const hA = isHorizontal(fp)
  const hB = isHorizontal(tp)
  const bias = corridorBias(edgeIndex)

  let mid: Point[]
  if (hA && hB) {
    const forward = (fp === 'right' && p2[0] >= p1[0]) || (fp === 'left' && p2[0] <= p1[0])
    const entersOk = (tp === 'left' && p1[0] <= p2[0]) || (tp === 'right' && p1[0] >= p2[0])
    if (forward && entersOk) {
      // Desfasar el codo vertical para no apilar Z paralelos.
      const span = p2[0] - p1[0]
      const t = 0.35 + ((edgeIndex % 5) / 5) * 0.3
      const xm = p1[0] + span * t
      mid = [
        [xm, p1[1]],
        [xm, p2[1]],
      ]
    } else if (L) {
      const down = b.li > a.li || (b.li === a.li && b.ri >= a.ri)
      const yRun = laneEdgeY(L, a.li, down ? 'bottom' : 'top', bias)
      mid = [
        [p1[0], yRun],
        [p2[0], yRun],
      ]
    } else {
      const ym = (p1[1] + p2[1]) / 2 + ((edgeIndex % 3) - 1) * 8
      mid = [
        [p1[0], ym],
        [p2[0], ym],
      ]
    }
  } else if (hA && !hB) {
    if (L && a.li === b.li) {
      const yRun = laneEdgeY(L, a.li, tp === 'bottom' ? 'bottom' : 'top', bias)
      mid = [
        [p2[0], p1[1]],
        [p2[0], yRun],
      ]
    } else {
      mid = [[p2[0], p1[1]]]
    }
  } else if (!hA && hB) {
    if (L && a.li === b.li) {
      const yRun = laneEdgeY(L, a.li, fp === 'bottom' ? 'bottom' : 'top', bias)
      mid = [
        [p1[0], yRun],
        [p2[0], yRun],
      ]
    } else {
      mid = [[p1[0], p2[1]]]
    }
  } else {
    let ym: number
    if (fp === tp) {
      ym =
        fp === 'bottom'
          ? Math.max(p1[1], p2[1]) + STUB + bias
          : Math.min(p1[1], p2[1]) - STUB - bias
    } else {
      ym = (p1[1] + p2[1]) / 2 + ((edgeIndex % 3) - 1) * 10
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
        // Cualquier fila ocupada en esa columna cuenta como obstáculo.
        const prefixB = b.n.lane + '|' + c + '|'
        const prefixA = a.n.lane + '|' + c + '|'
        if (Object.keys(L.occ).some((k) => k.startsWith(prefixB))) kSrc++
        if (Object.keys(L.occ).some((k) => k.startsWith(prefixA))) kTgt++
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
    const down = b.li > a.li || (b.li === a.li && b.ri > a.ri)
    pts = down
      ? [
          [a.cx, a.cy + a.h / 2],
          [b.cx, b.cy - b.h / 2],
        ]
      : [
          [a.cx, a.cy - a.h / 2],
          [b.cx, b.cy + b.h / 2],
        ]
  } else {
    const down = b.li > a.li || (b.li === a.li && b.ri >= a.ri)
    const yRun = laneEdgeY(L, a.li, down ? 'bottom' : 'top')
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
export function routeEdge(a: Geom, b: Geom, L: LayoutResult, e: Edge, edgeIndex = 0): Point[] {
  const ports = resolvePorts(a, b, e)
  return ports ? routePorts(a, b, ports.fp, ports.tp, L, edgeIndex) : route(a, b, L)
}

export function dedupe(pts: Point[]): Point[] {
  return pts.filter(
    (p, i) => !i || Math.abs(p[0] - pts[i - 1][0]) > 0.5 || Math.abs(p[1] - pts[i - 1][1]) > 0.5,
  )
}

/**
 * Polilínea ortogonal con esquinas en curva cúbica (no “libres”:
 * sigue ejes, pero gira redondo como un conector de diagrama).
 */
export function pathD(pts: Point[], r = CORNER_R): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) {
    return `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`
  }

  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    const next = pts[i + 1]
    const l1 = Math.hypot(cur[0] - prev[0], cur[1] - prev[1])
    const l2 = Math.hypot(next[0] - cur[0], next[1] - cur[1])
    if (!l1 || !l2) continue

    // Hasta ~45% del segmento más corto; deja rectas visibles entre curvas.
    const rr = Math.min(r, l1 * 0.45, l2 * 0.45)
    if (rr < 2) {
      d += ` L${cur[0]} ${cur[1]}`
      continue
    }

    const ux1 = (prev[0] - cur[0]) / l1
    const uy1 = (prev[1] - cur[1]) / l1
    const ux2 = (next[0] - cur[0]) / l2
    const uy2 = (next[1] - cur[1]) / l2

    const enterX = cur[0] + ux1 * rr
    const enterY = cur[1] + uy1 * rr
    const exitX = cur[0] + ux2 * rr
    const exitY = cur[1] + uy2 * rr

    // Controles hacia la esquina → arco ~circular en giros de 90°.
    const c1x = enterX - ux1 * rr * CORNER_KAPPA
    const c1y = enterY - uy1 * rr * CORNER_KAPPA
    const c2x = exitX - ux2 * rr * CORNER_KAPPA
    const c2y = exitY - uy2 * rr * CORNER_KAPPA

    d += ` L${enterX} ${enterY} C${c1x} ${c1y} ${c2x} ${c2y} ${exitX} ${exitY}`
  }
  const last = pts[pts.length - 1]
  return d + ` L${last[0]} ${last[1]}`
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
