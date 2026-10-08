import { useMemo, useState } from 'react'
import { useViewport } from '@xyflow/react'
import { COL_W, HEADER_W, PHASE_H, PHASE_MIN_W, phaseGeometry } from '@flow'
import { useFlowCtx } from '../FlowCtx'

export function PhaseHeaders() {
  const ctrl = useFlowCtx()
  const { x, zoom } = useViewport()
  const pg = useMemo(() => phaseGeometry(ctrl.model), [ctrl.model])
  const phases = ctrl.model.phases || []
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [resizePreview, setResizePreview] = useState<{ id: string; width: number } | null>(null)

  /** Fin de la última fase en coords de flujo (incluye preview de resize). */
  const phasesEndFlow = useMemo(() => {
    if (!phases.length) return 0
    let total = pg.total
    if (resizePreview) {
      const ri = phases.findIndex((p) => p.id === resizePreview.id)
      if (ri >= 0) total += resizePreview.width - pg.widths[ri]
    }
    return total
  }, [phases, pg.total, pg.widths, resizePreview])

  const addPhaseLeft =
    phases.length === 0
      ? Math.max(8, x - HEADER_W + 8)
      : phasesEndFlow * zoom + x - HEADER_W + 6

  return (
    <div className="fs-phase-headers" style={{ left: HEADER_W, height: PHASE_H }}>
      {phases.length === 0 ? (
        <div className="fs-phase-placeholder">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} style={{ left: (i * COL_W + COL_W / 2) * zoom + x - HEADER_W }}>
              {i + 1}
            </span>
          ))}
        </div>
      ) : (
        phases.map((phase, j) => {
          let leftFlow = pg.lefts[j]
          let widthFlow = pg.widths[j]
          if (resizePreview) {
            const ri = phases.findIndex((p) => p.id === resizePreview.id)
            if (ri === j) widthFlow = resizePreview.width
            else if (ri >= 0 && ri < j) {
              leftFlow = pg.lefts[j] + (resizePreview.width - pg.widths[ri])
            }
          }
          const left = leftFlow * zoom + x - HEADER_W
          const width = widthFlow * zoom
          const selected = ctrl.headerSel?.kind === 'phase' && ctrl.headerSel.id === phase.id
          return (
            <div
              key={phase.id}
              className={`fs-phase-header${selected ? ' selected' : ''}`}
              style={{ left, width }}
              onClick={() => ctrl.selectHeader('phase', phase.id)}
              onDoubleClick={() => {
                if (ctrl.readOnly) return
                setRenaming(phase.id)
                setDraft(phase.name)
              }}
            >
              {renaming === phase.id ? (
                <input
                  className="fs-header-rename"
                  value={draft}
                  autoFocus
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    ctrl.updatePhase(phase.id, { name: draft.trim() || phase.name })
                    setRenaming(null)
                  }}
                />
              ) : (
                <span className="fs-header-text" title={phase.name}>
                  {phase.name}
                </span>
              )}
              {!ctrl.readOnly && (
                <div
                  className="fs-phase-resize"
                  onPointerDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const startX = e.clientX
                    const startW = pg.widths[j]
                    let lastW = startW
                    const onMove = (ev: PointerEvent) => {
                      const delta = (ev.clientX - startX) / zoom
                      lastW = Math.max(PHASE_MIN_W, Math.round(startW + delta))
                      setResizePreview({ id: phase.id, width: lastW })
                    }
                    const onUp = () => {
                      window.removeEventListener('pointermove', onMove)
                      window.removeEventListener('pointerup', onUp)
                      setResizePreview(null)
                      if (lastW !== startW) ctrl.updatePhase(phase.id, { width: lastW })
                    }
                    window.addEventListener('pointermove', onMove)
                    window.addEventListener('pointerup', onUp)
                  }}
                />
              )}
            </div>
          )
        })
      )}
      {!ctrl.readOnly && (
        <button
          type="button"
          className="fs-add-phase"
          style={{ left: addPhaseLeft }}
          title="Agregar fase al final"
          onClick={() => ctrl.addPhase()}
        >
          + Fase
        </button>
      )}
    </div>
  )
}
