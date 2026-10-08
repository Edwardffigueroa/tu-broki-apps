import { memo, useCallback, useState, type CSSProperties } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react'
import { useFlowCtx } from '../FlowCtx'
import type { RFFlowEdge } from '../project'
import { markerFor } from './markers'

export const FlowEdge = memo(function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RFFlowEdge>) {
  const ctrl = useFlowCtx()
  const rf = useReactFlow()
  const edge = data?.edge
  const kind = edge?.kind || 'flow'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(edge?.label || '')
  const [draggingCenter, setDraggingCenter] = useState(false)

  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
    offset: 18,
    centerX: edge?.center?.x,
    centerY: edge?.center?.y,
  })

  const markers = markerFor(kind, !!selected)
  const readOnly = data?.readOnly

  const edgeStyle: CSSProperties = {
    stroke:
      kind === 'return'
        ? 'var(--warn-line)'
        : kind === 'association'
          ? 'var(--muted)'
          : 'var(--ink)',
    strokeWidth: kind === 'return' ? 2.5 : kind === 'association' ? 1.75 : 2.4,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    fill: 'none',
    vectorEffect: 'non-scaling-stroke',
    ...(kind === 'message'
      ? { strokeDasharray: '6 4' }
      : kind === 'return'
        ? { strokeDasharray: '4 4' }
        : kind === 'async' || kind === 'association'
          ? { strokeDasharray: '1 5' }
          : {}),
    ...(selected ? { stroke: 'var(--accent)', strokeWidth: 3 } : {}),
  }

  const saveLabel = useCallback(() => {
    setEditing(false)
    ctrl.updateEdge(id, { label: draft.trim() || undefined })
  }, [ctrl, draft, id])

  const onCenterPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly) return
      e.stopPropagation()
      e.preventDefault()
      setDraggingCenter(true)
      const onMove = (ev: PointerEvent) => {
        const pt = rf.screenToFlowPosition({ x: ev.clientX, y: ev.clientY })
        ctrl.updateEdge(id, { center: { x: Math.round(pt.x), y: Math.round(pt.y) } })
      }
      const onUp = () => {
        setDraggingCenter(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [ctrl, id, readOnly, rf],
  )

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={edgeStyle}
        className={`fs-edge fs-edge-${kind}${selected ? ' selected' : ''}${data?.dim ? ' dim' : ''}`}
        markerEnd={markers.end}
        markerStart={markers.start}
        interactionWidth={18}
      />
      <EdgeLabelRenderer>
        {(edge?.label || editing || selected) && (
          <div
            className="fs-edge-label-wrap nodrag nopan"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            onDoubleClick={() => {
              if (readOnly) return
              setDraft(edge?.label || '')
              setEditing(true)
            }}
          >
            {editing ? (
              <input
                className="fs-edge-label-input"
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={saveLabel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveLabel()
                  if (e.key === 'Escape') setEditing(false)
                }}
              />
            ) : (
              <span className="fs-edge-label">{edge?.label}</span>
            )}
          </div>
        )}
        {selected && !readOnly && (
          <div
            className={`fs-edge-center-handle nodrag nopan${draggingCenter ? ' dragging' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            onPointerDown={onCenterPointerDown}
            onDoubleClick={(e) => {
              e.stopPropagation()
              ctrl.updateEdge(id, { center: undefined })
            }}
            title="Arrastra para curvar · doble clic para restablecer"
          />
        )}
      </EdgeLabelRenderer>
    </>
  )
})
