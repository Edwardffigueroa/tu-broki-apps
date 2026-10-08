import { useMemo, useState } from 'react'
import { useViewport } from '@xyflow/react'
import { HEADER_W, PHASE_H, minLaneHeight, laneGeometry } from '@flow'
import { useFlowCtx } from '../FlowCtx'

const LANE_COLORS = ['#2751d8', '#2e8b57', '#b7791f', '#b3261e', '#6b4fbb', '#0d9488']

export function LaneHeaders() {
  const ctrl = useFlowCtx()
  const { y, zoom } = useViewport()
  const lg = useMemo(() => laneGeometry(ctrl.model), [ctrl.model])
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [menuLane, setMenuLane] = useState<string | null>(null)
  /** Preview de altura durante el gesto (un solo commit al soltar). */
  const [resizePreview, setResizePreview] = useState<{ id: string; height: number } | null>(null)

  return (
    <div className="fs-lane-headers" style={{ width: HEADER_W }}>
      <div className="fs-corner" style={{ height: PHASE_H }}>
        {!ctrl.readOnly && (
          <button type="button" className="fs-add-lane" onClick={() => ctrl.addLane()} title="Agregar carril">
            + Carril
          </button>
        )}
      </div>
      {ctrl.model.lanes.map((lane, i) => {
        const baseH = resizePreview?.id === lane.id ? resizePreview.height : lg.heights[i]
        // Ajustar top si un carril anterior está en preview
        let topPx = lg.tops[i]
        if (resizePreview) {
          const ri = ctrl.model.lanes.findIndex((l) => l.id === resizePreview.id)
          if (ri >= 0 && ri < i) {
            topPx = lg.tops[i] + (resizePreview.height - lg.heights[ri])
          }
        }
        const top = topPx * zoom + y
        const height = baseH * zoom
        const selected = ctrl.headerSel?.kind === 'lane' && ctrl.headerSel.id === lane.id
        return (
          <div
            key={lane.id}
            className={`fs-lane-header${selected ? ' selected' : ''}`}
            style={{ top, height, borderLeftColor: lane.color || LANE_COLORS[i % LANE_COLORS.length] }}
            onClick={() => ctrl.selectHeader('lane', lane.id)}
            onDoubleClick={() => {
              if (ctrl.readOnly) return
              setRenaming(lane.id)
              setDraft(lane.name)
            }}
          >
            {renaming === lane.id ? (
              <input
                className="fs-header-rename"
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                  ctrl.updateLane(lane.id, { name: draft.trim() || lane.name })
                  setRenaming(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  if (e.key === 'Escape') setRenaming(null)
                }}
              />
            ) : (
              <span className="fs-header-text" title={lane.name}>
                {lane.name}
              </span>
            )}
            {!ctrl.readOnly && (
              <>
                <button
                  type="button"
                  className="fs-header-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuLane(menuLane === lane.id ? null : lane.id)
                  }}
                >
                  ⋯
                </button>
                {menuLane === lane.id && (
                  <div className="fs-header-menu" role="menu">
                    <button type="button" onClick={() => { setRenaming(lane.id); setDraft(lane.name); setMenuLane(null) }}>Renombrar</button>
                    {LANE_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => { ctrl.updateLane(lane.id, { color: c }); setMenuLane(null) }} style={{ borderLeft: `4px solid ${c}` }}>Color</button>
                    ))}
                    <button type="button" onClick={() => { ctrl.addLane(i); setMenuLane(null) }}>Insertar arriba</button>
                    <button type="button" onClick={() => { ctrl.addLane(i + 1); setMenuLane(null) }}>Insertar abajo</button>
                    <button type="button" onClick={() => { ctrl.moveLane(lane.id, -1); setMenuLane(null) }}>Subir</button>
                    <button type="button" onClick={() => { ctrl.moveLane(lane.id, 1); setMenuLane(null) }}>Bajar</button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        ctrl.confirmDeleteLane(lane.id)
                        setMenuLane(null)
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                )}
                <div
                  className="fs-lane-resize"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const startY = e.clientY
                    const startH = lg.heights[i]
                    const minH = minLaneHeight(ctrl.model, lane.id)
                    let lastH = startH
                    const onMove = (ev: PointerEvent) => {
                      const delta = (ev.clientY - startY) / zoom
                      lastH = Math.max(minH, Math.round(startH + delta))
                      setResizePreview({ id: lane.id, height: lastH })
                    }
                    const onUp = () => {
                      window.removeEventListener('pointermove', onMove)
                      window.removeEventListener('pointerup', onUp)
                      setResizePreview(null)
                      if (lastH !== startH) ctrl.updateLane(lane.id, { height: lastH })
                    }
                    window.addEventListener('pointermove', onMove)
                    window.addEventListener('pointerup', onUp)
                  }}
                />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
