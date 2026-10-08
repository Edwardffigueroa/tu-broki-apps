import { TYPE_DEFAULTS, TYPE_ORDER } from '@flow'
import { useFlowCtx } from '../FlowCtx'
import { useReactFlow } from '@xyflow/react'

export function Palette() {
  const ctrl = useFlowCtx()
  const rf = useReactFlow()

  const addAtCenter = (type: string) => {
    const el = ctrl.wrapperRef.current
    if (!el) return
    const cx = (el.clientWidth - 168) / 2
    const cy = (el.clientHeight - 36) / 2
    const pos = rf.screenToFlowPosition({ x: cx + 168, y: cy + 36 })
    ctrl.addNodeAt(type, pos)
  }

  return (
    <div className="fs-palette">
      <p className="fs-panel-hint">Arrastra al lienzo o haz clic para agregar al centro visible.</p>
      <div className="fs-palette-grid">
        {TYPE_ORDER.map((type) => (
          <div
            key={type}
            className={`fs-palette-item${ctrl.readOnly ? ' disabled' : ''}`}
            draggable={!ctrl.readOnly}
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-flow-type', type)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onClick={() => !ctrl.readOnly && addAtCenter(type)}
            role="button"
            tabIndex={0}
          >
            <span className={`fs-palette-icon fs-icon-${type}`} />
            <span>{TYPE_DEFAULTS[type].name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
