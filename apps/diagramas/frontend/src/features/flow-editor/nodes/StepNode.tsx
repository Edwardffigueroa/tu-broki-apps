import { memo, useCallback, useState, type CSSProperties } from 'react'
import { Handle, NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { TYPE_DEFAULTS, TYPE_ORDER, deleteElements } from '@flow'
import { useFlowCtx } from '../FlowCtx'
import type { RFStepNode } from '../project'
import { NodeShape, eventIcon, isDarkHex } from './shapes'

export const StepNode = memo(function StepNode({ id, data, selected }: NodeProps<RFStepNode>) {
  const ctrl = useFlowCtx()
  const n = data.node
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(n.label)
  const w = data.node.w ?? TYPE_DEFAULTS[n.type]?.w ?? 160
  const h = data.node.h ?? TYPE_DEFAULTS[n.type]?.h ?? 64
  const lane = ctrl.model.lanes.find((l) => l.id === n.lane)
  const errCount = data.issues.filter((i) => i.level === 'error').length
  const warnCount = data.issues.filter((i) => i.level === 'aviso').length
  const onlySel = selected && ctrl.sel.nodeIds.length === 1

  const saveLabel = useCallback(() => {
    setEditing(false)
    if (draft.trim() !== n.label) ctrl.updateNode(id, { label: draft.trim() || n.label })
  }, [ctrl, draft, id, n.label])

  return (
    <>
      <NodeResizer
        isVisible={selected && !data.readOnly}
        minWidth={TYPE_DEFAULTS[n.type]?.minW ?? 80}
        minHeight={TYPE_DEFAULTS[n.type]?.minH ?? 40}
        keepAspectRatio={n.type === 'event'}
        onResizeEnd={(_, params) => {
          ctrl.resizeNode(id, {
            x: params.x,
            y: params.y,
            width: params.width,
            height: params.height,
          })
        }}
      />
      {onlySel && (
        <NodeToolbar position={Position.Top} className="fs-node-toolbar">
          {!data.readOnly && (
            <>
              <select
                className="fs-toolbar-select"
                value={n.type}
                onChange={(e) => ctrl.updateNode(id, { type: e.target.value })}
                aria-label="Tipo de paso"
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_DEFAULTS[t].name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={() => ctrl.addNodeAfter(id)}>
                + Siguiente
              </button>
              <button type="button" onClick={() => ctrl.duplicate()}>
                Duplicar
              </button>
            </>
          )}
          <button type="button" onClick={() => ctrl.togglePath(id)}>
            Ver camino
          </button>
          {!data.readOnly && (
            <button
              type="button"
              className="danger"
              onClick={() => ctrl.mutate((m) => deleteElements(m, { nodeIds: [id] }))}
            >
              Eliminar
            </button>
          )}
        </NodeToolbar>
      )}
      <div
        className={`fs-node fs-${n.type}${selected ? ' selected' : ''}${data.dim ? ' dim' : ''}${n.color ? ' custom-fill' : ''}${!n.textColor && isDarkHex(n.color) ? ' dark-fill' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          opacity: data.dim ? 0.25 : 1,
          ...(n.textColor ? ({ ['--fs-node-text']: n.textColor } as CSSProperties) : {}),
        }}
        aria-label={`${TYPE_DEFAULTS[n.type]?.name || n.type}: ${n.label}, carril ${lane?.name || n.lane}`}
        onDoubleClick={() => {
          if (data.readOnly) return
          setDraft(n.label)
          setEditing(true)
        }}
      >
        <NodeShape type={n.type} w={w} h={h} color={n.color} />
        <div className="fs-node-body" style={n.textColor ? { color: n.textColor } : undefined}>
          {n.type === 'event' && (
            <span className="fs-event-icon" aria-hidden="true" style={n.textColor ? { color: n.textColor } : undefined}>
              {eventIcon(n.event)}
            </span>
          )}
          {editing ? (
            <textarea
              className="fs-inline-edit nodrag nowheel"
              value={draft}
              autoFocus
              rows={3}
              style={n.textColor ? { color: n.textColor } : undefined}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  saveLabel()
                }
                if (e.key === 'Escape') {
                  setEditing(false)
                  setDraft(n.label)
                }
              }}
            />
          ) : (
            <div className="fs-node-label" style={n.textColor ? { color: n.textColor } : undefined}>
              {n.label}
            </div>
          )}
        </div>
        {n.type === 'event' && (
          <div className="fs-event-caption" style={n.textColor ? { color: n.textColor } : undefined}>
            {n.label}
          </div>
        )}
        <div className="fs-node-badges">
          {n.note && <span className="fs-badge note" title={n.note}>📝</span>}
          {n.meta?.status && (
            <span className={`fs-badge status status-${n.meta.status}`} title={n.meta.status} />
          )}
          {n.meta?.sla && <span className="fs-badge sla">{n.meta.sla}</span>}
          {(errCount > 0 || warnCount > 0) && (
            <span
              className={`fs-badge lint ${errCount ? 'err' : 'warn'}`}
              title={data.issues.map((i) => i.msg).join('\n')}
            >
              !
            </span>
          )}
        </div>
        {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
          <Handle
            key={side}
            id={side}
            type="source"
            position={
              side === 'top'
                ? Position.Top
                : side === 'right'
                  ? Position.Right
                  : side === 'bottom'
                    ? Position.Bottom
                    : Position.Left
            }
            className="fs-handle"
          />
        ))}
      </div>
    </>
  )
})
