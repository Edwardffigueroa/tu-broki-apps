import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  COLW,
  HEAD,
  LH,
  PORTS,
  TOP,
  anchor,
  clamp,
  dedupe,
  labelAt,
  nearestPort,
  pathD,
  routeEdge,
  wrap,
  type Geom,
  type Port,
} from '../../core/carriles'
import type { EditorController } from './useEditorController'

export function typeIcon(t: string) {
  if (t === 'start') {
    return (
      <svg viewBox="0 0 22 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1.5" y="3.5" width="19" height="9" rx="4.5" fill="var(--ok)" stroke="var(--ok-line)" />
      </svg>
    )
  }
  if (t === 'task') {
    return (
      <svg viewBox="0 0 22 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1.5" y="2.5" width="19" height="11" rx="2.5" />
      </svg>
    )
  }
  if (t === 'decision') {
    return (
      <svg viewBox="0 0 22 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M11 1.5L20.5 8L11 14.5L1.5 8Z" fill="var(--warn)" stroke="var(--warn-line)" />
      </svg>
    )
  }
  if (t === 'document') {
    return (
      <svg viewBox="0 0 22 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 2.5H20V11.5Q15.5 14.5 11 11.5T2 11.5Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 22 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="3.5" width="19" height="9" rx="4.5" fill="var(--end)" strokeWidth="2.2" />
    </svg>
  )
}

/** Posición del puerto en coordenadas locales del nodo (centro = 0,0). */
function localPort(g: Geom, port: Port): [number, number] {
  const [ax, ay] = anchor(g, port)
  return [ax - g.cx, ay - g.cy]
}

function NodeShape({ g, noteNumber, withPorts = true }: { g: Geom; noteNumber?: number; withPorts?: boolean }) {
  const { n, w, h } = g
  const hw = w / 2
  const hh = h / 2
  let max = 18
  let ml = 3
  let dy = 0
  let shape: ReactNode
  switch (n.type) {
    case 'start':
      shape = <rect className="shape s-start" x={-hw} y={-hh} width={w} height={h} rx={hh} />
      max = 14
      ml = 2
      break
    case 'end':
      shape = <rect className="shape s-end" x={-hw} y={-hh} width={w} height={h} rx={hh} />
      max = 14
      ml = 2
      break
    case 'decision':
      shape = <polygon className="shape s-decision" points={`0,${-hh} ${hw},0 0,${hh} ${-hw},0`} />
      max = 11
      ml = 3
      break
    case 'document':
      shape = (
        <path
          className="shape"
          d={`M${-hw} ${-hh} H${hw} V${hh - 9} Q${hw / 2} ${hh + 5} 0 ${hh - 9} T${-hw} ${hh - 9} Z`}
        />
      )
      max = 18
      ml = 2
      dy = -4
      break
    default:
      shape = <rect className="shape" x={-hw} y={-hh} width={w} height={h} rx={9} />
  }
  const lines = wrap(n.label, max, ml)
  const lh = 14.5
  const y0 = dy - ((lines.length - 1) * lh) / 2
  const badge = n.type === 'decision' ? [hw / 2 + 4, -hh / 2 - 4] : [hw - 6, -hh + 6]
  return (
    <>
      <title>{n.label + (n.note ? ' — ' + n.note : '')}</title>
      {shape}
      {lines.map((l, i) => (
        <text key={i} x={0} y={y0 + i * lh}>
          {l}
        </text>
      ))}
      {noteNumber != null && (
        <g className="notebadge">
          <circle cx={badge[0]} cy={badge[1]} r={8} />
          <text x={badge[0]} y={badge[1]}>{noteNumber}</text>
        </g>
      )}
      {withPorts &&
        PORTS.map((p) => {
          const [px, py] = localPort(g, p)
          return (
            <g key={p}>
              <circle className="hdot" cx={px} cy={py} r={5} />
              <circle className="handle" data-kind="handle" data-id={n.id} data-port={p} cx={px} cy={py} r={13} />
            </g>
          )
        })}
    </>
  )
}

type DragState = {
  id: string
  sx: number
  sy: number
  dx: number
  dy: number
  moved: boolean
  px: number
  py: number
  cell: { c: number; li: number } | null
}

type ConnState = {
  from: string
  fromPort: Port
  sx: number
  sy: number
  ex: number
  ey: number
  target: string | null
  toPort: Port | null
}

const NOTES_TITLE_H = 34
const NOTES_LINE_H = 17
const NOTES_PAD = 16

export function CanvasSvg({
  ctrl,
  stageRef,
}: {
  ctrl: EditorController
  stageRef: React.RefObject<HTMLDivElement | null>
}) {
  const { model, sel, zoom, L, select, mutate, setZoom, showToast } = ctrl
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [conn, setConn] = useState<ConnState | null>(null)

  const ncols = Math.max(L.maxCol + 2, 5)
  const W = HEAD + ncols * COLW
  const lanesH = TOP + model.lanes.length * LH

  // Notas al pie: numeradas en el orden en que aparecen los pasos.
  const notedNodes = model.nodes.filter((n) => n.note)
  const noteNumber = new Map<string, number>()
  notedNodes.forEach((n, i) => noteNumber.set(n.id, i + 1))
  const charsPerLine = Math.max(40, Math.floor((W - 48) / 6.4))
  const noteLines = notedNodes.map((n) => wrap(`${n.label}: ${n.note ?? ''}`, charsPerLine, 4))
  const notesH = notedNodes.length
    ? NOTES_TITLE_H + noteLines.reduce((acc, ls) => acc + ls.length * NOTES_LINE_H + 6, 0) + NOTES_PAD
    : 0
  const H = lanesH + notesH

  const svgPt = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = svg.getScreenCTM()
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 }
  }, [])

  const cellAt = useCallback(
    (x: number, y: number) => ({
      c: clamp(Math.floor((x - HEAD) / COLW), 0, ncols - 1),
      li: clamp(Math.floor((y - TOP) / LH), 0, model.lanes.length - 1),
    }),
    [ncols, model.lanes.length],
  )

  const nodeAtPoint = useCallback(
    (p: { x: number; y: number }, except: string) => {
      for (const id of Object.keys(L.G)) {
        const g = L.G[id]
        if (g.n.id === except) continue
        if (Math.abs(p.x - g.cx) <= g.w / 2 + 10 && Math.abs(p.y - g.cy) <= g.h / 2 + 10) {
          return g.n.id
        }
      }
      return null
    },
    [L.G],
  )

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9))
      }
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [setZoom, stageRef, zoom])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const t = (e.target as Element).closest('[data-kind]') as HTMLElement | null
    if (!t) {
      if (sel) select(null)
      return
    }
    const kind = t.dataset.kind
    if (kind === 'edge') {
      select({ kind: 'edge', i: Number(t.dataset.i) })
      return
    }
    if (kind === 'lane') {
      select({ kind: 'lane', i: Number(t.dataset.i) })
      return
    }
    const id = t.dataset.id!
    const p = svgPt(e)
    if (!(sel && sel.kind === 'node' && sel.id === id)) select({ kind: 'node', id })
    svgRef.current?.setPointerCapture(e.pointerId)
    if (kind === 'handle') {
      const g = L.G[id]
      const fromPort = (t.dataset.port as Port) || 'right'
      const [sx, sy] = anchor(g, fromPort)
      setConn({ from: id, fromPort, sx, sy, ex: sx, ey: sy, target: null, toPort: null })
    } else {
      const g2 = L.G[id]
      setDrag({
        id,
        sx: p.x,
        sy: p.y,
        dx: p.x - g2.cx,
        dy: p.y - g2.cy,
        moved: false,
        px: p.x,
        py: p.y,
        cell: null,
      })
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (drag) {
      const p = svgPt(e)
      let next = { ...drag, px: p.x, py: p.y }
      if (!next.moved) {
        if (Math.hypot(p.x - drag.sx, p.y - drag.sy) * zoom < 5) return
        next = { ...next, moved: true }
      }
      next.cell = cellAt(p.x, p.y)
      setDrag(next)
    } else if (conn) {
      const q = svgPt(e)
      const tid = nodeAtPoint(q, conn.from)
      if (tid) {
        const g = L.G[tid]
        const toPort = nearestPort(g, q)
        const [ex, ey] = anchor(g, toPort)
        setConn({ ...conn, target: tid, toPort, ex, ey })
      } else {
        setConn({ ...conn, target: null, toPort: null, ex: q.x, ey: q.y })
      }
    }
  }

  const endPointer = (cancel: boolean) => {
    if (drag) {
      const d = drag
      setDrag(null)
      if (d.moved && d.cell && !cancel) {
        const cell = d.cell
        mutate((m) => {
          const n = m.nodes.find((o) => o.id === d.id)
          if (!n) return
          n.lane = m.lanes[cell.li].id
          let s = cell.c + 1
          while (m.nodes.some((o) => o !== n && o.lane === n.lane && o.step === s)) s++
          n.step = s
        })
      }
    } else if (conn) {
      const c = conn
      setConn(null)
      if (c.target && !cancel) {
        const exists = model.edges.some((e) => e.from === c.from && e.to === c.target)
        if (exists) showToast('Esos pasos ya están conectados')
        else {
          let idx = 0
          mutate((m) => {
            m.edges.push({ from: c.from, to: c.target!, fromPort: c.fromPort, toPort: c.toPort ?? undefined })
            idx = m.edges.length - 1
          })
          select({ kind: 'edge', i: idx })
        }
      }
    }
  }

  let notesCursorY = lanesH + NOTES_TITLE_H

  return (
    <svg
      ref={svgRef}
      role="img"
      aria-label="Diagrama de carriles"
      viewBox={`0 0 ${W} ${H}`}
      width={W * zoom}
      height={H * zoom}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => endPointer(false)}
      onPointerCancel={() => endPointer(true)}
      onDoubleClick={(e) => {
        if ((e.target as Element).closest('.node')) {
          const el = document.getElementById('i-label') as HTMLTextAreaElement | null
          el?.focus()
          el?.select()
        }
      }}
      onTouchStart={(e) => {
        if ((e.target as Element).closest?.('.node')) e.preventDefault()
      }}
    >
      <defs>
        <marker id="ar" viewBox="0 0 10 10" refX={9.5} refY={5} markerWidth={10} markerHeight={10} markerUnits="userSpaceOnUse" orient="auto">
          <path className="ah" d="M0 1.5L9.5 5L0 8.5z" />
        </marker>
        <marker id="ars" viewBox="0 0 10 10" refX={9.5} refY={5} markerWidth={12} markerHeight={12} markerUnits="userSpaceOnUse" orient="auto">
          <path className="ahs" d="M0 1.5L9.5 5L0 8.5z" />
        </marker>
      </defs>

      {model.lanes.map((l, i) => {
        const y = TOP + i * LH
        const k = i % 6
        const lines = wrap(l.name, 13, 3)
        const isSel = sel?.kind === 'lane' && sel.i === i
        return (
          <g key={l.id}>
            <rect x={0} y={y} width={W} height={LH} fill={`var(--lt${k})`} />
            <g className={'lhg' + (isSel ? ' sel' : '')} data-kind="lane" data-i={i}>
              <title>{l.name}</title>
              <rect className="lhead" x={0} y={y} width={HEAD} height={LH} fill={`var(--lh${k})`} />
              {lines.map((t, j) => (
                <text key={j} className="ltext" x={14} y={y + LH / 2 + (j - (lines.length - 1) / 2) * 17 + 4.5}>
                  {t}
                </text>
              ))}
            </g>
            <line className="sepl" x1={0} x2={W} y1={y + LH} y2={y + LH} />
          </g>
        )
      })}

      <rect className="rulerbg" x={0} y={0} width={W} height={TOP} />
      <text className="rtxt l" x={14} y={TOP - 11}>Paso</text>
      {Array.from({ length: ncols + 1 }, (_, cIdx) => {
        const x = HEAD + cIdx * COLW
        return (
          <g key={cIdx}>
            <line className="grid" x1={x} x2={x} y1={TOP} y2={lanesH} />
            {cIdx < ncols && (
              <text className="rtxt" x={x + COLW / 2} y={TOP - 11}>{cIdx + 1}</text>
            )}
          </g>
        )
      })}
      <line className="sepl" x1={0} x2={W} y1={TOP} y2={TOP} />

      {model.edges.map((e, i) => {
        const a = L.G[e.from]
        const b = L.G[e.to]
        if (!a || !b) return null
        const pts = dedupe(routeEdge(a, b, L, e))
        const dPath = pathD(pts)
        const isSel = sel?.kind === 'edge' && sel.i === i
        const isBack = Boolean(L.back[i])
        const lab = e.label ? labelAt(pts, e.label) : null
        return (
          <g
            key={i}
            className={'edge' + (isSel ? ' sel' : '') + (isBack ? ' back' : '')}
            data-kind="edge"
            data-i={i}
          >
            <path className="hit" d={dPath} />
            <path className="line" d={dPath} markerEnd={`url(#${isSel ? 'ars' : 'ar'})`} />
            {lab && e.label && (
              <g className="elabel">
                <rect x={lab.x - lab.w / 2} y={lab.y - 9} width={lab.w} height={18} rx={9} />
                <text x={lab.x} y={lab.y}>{e.label}</text>
              </g>
            )}
          </g>
        )
      })}

      {model.nodes.map((n) => {
        const g = L.G[n.id]
        if (!g) return null
        const isSel = sel?.kind === 'node' && sel.id === n.id
        const isTarget = conn?.target === n.id
        const isGhost = Boolean(drag?.moved && drag.id === n.id)
        return (
          <g
            key={n.id}
            className={'node' + (isSel ? ' sel' : '') + (isTarget ? ' target' : '') + (isGhost ? ' ghosting' : '')}
            data-kind="node"
            data-id={n.id}
            transform={`translate(${g.cx} ${g.cy})`}
          >
            <NodeShape g={g} noteNumber={noteNumber.get(n.id)} />
          </g>
        )
      })}

      {notedNodes.length > 0 && (
        <g className="notes" aria-label="Notas del diagrama">
          <rect className="notesbg" x={0} y={lanesH} width={W} height={notesH} />
          <line className="sepl" x1={0} x2={W} y1={lanesH} y2={lanesH} />
          <text className="notes-title" x={14} y={lanesH + 21}>Notas</text>
          {notedNodes.map((n, i) => {
            const lines = noteLines[i]
            const y0 = notesCursorY
            notesCursorY += lines.length * NOTES_LINE_H + 6
            return (
              <g key={n.id} className="note-item">
                <circle className="notenum" cx={24} cy={y0 + 5} r={8} />
                <text className="notenum-txt" x={24} y={y0 + 5}>{i + 1}</text>
                {lines.map((t, j) => (
                  <text key={j} className="note-txt" x={40} y={y0 + 9 + j * NOTES_LINE_H}>
                    {j === 0 ? (
                      <>
                        <tspan className="note-label">{n.label}:</tspan>
                        {t.slice(n.label.length + 1)}
                      </>
                    ) : (
                      t
                    )}
                  </text>
                ))}
              </g>
            )
          })}
        </g>
      )}

      <g>
        {drag?.moved && drag.cell && (
          <rect
            className="cellhl"
            rx={8}
            x={HEAD + drag.cell.c * COLW + 6}
            y={TOP + drag.cell.li * LH + 6}
            width={COLW - 12}
            height={LH - 12}
          />
        )}
        {drag?.moved && L.G[drag.id] && (
          <g className="node floating" transform={`translate(${drag.px - drag.dx} ${drag.py - drag.dy})`}>
            <NodeShape g={L.G[drag.id]} withPorts={false} />
          </g>
        )}
        {conn && (
          <>
            <path
              className="preview"
              d={`M${conn.sx} ${conn.sy} C${conn.sx + (conn.fromPort === 'left' ? -60 : conn.fromPort === 'right' ? 60 : 0)} ${conn.sy + (conn.fromPort === 'top' ? -60 : conn.fromPort === 'bottom' ? 60 : 0)} ${conn.ex - (conn.toPort === 'right' ? -60 : conn.toPort === 'left' ? 60 : 0)} ${conn.ey - (conn.toPort === 'bottom' ? -60 : conn.toPort === 'top' ? 60 : 0)} ${conn.ex} ${conn.ey}`}
            />
            {conn.target && <circle className="portpick" cx={conn.ex} cy={conn.ey} r={7} />}
          </>
        )}
      </g>
    </svg>
  )
}
