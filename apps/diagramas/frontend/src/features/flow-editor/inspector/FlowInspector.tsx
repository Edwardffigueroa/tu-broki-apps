import { useEffect, useState } from 'react'
import { EDGE_KIND_NAMES, SIDES, TYPE_DEFAULTS, TYPE_ORDER, deleteElements, nodeSize } from '@flow'
import { useFlowCtx } from '../FlowCtx'

/** Rellenos / letras sugeridos (pasteles + vivos + blanco/negro). */
const NODE_COLORS = [
  '#FF6B35',
  '#00C2A8',
  '#7B61FF',
  '#2751D8',
  '#FFB800',
  '#E91E63',
  '#E63946',
  '#FF8A5B',
  '#3DDCB2',
  '#4C7CFF',
  '#FFD166',
  '#FF4D8D',
  '#DDF2E3',
  '#FFF1CB',
  '#E2E9FC',
  '#FFFFFF',
  '#14202B',
]

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/

function ColorField({
  value,
  disabled,
  onChange,
}: {
  value?: string
  disabled?: boolean
  onChange: (color: string | null) => void
}) {
  const [draft, setDraft] = useState(value || '')
  useEffect(() => {
    setDraft(value || '')
  }, [value])

  return (
    <div className="fs-color-field">
      <div className="fs-color-swatches" role="listbox" aria-label="Colores sugeridos">
        {NODE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            role="option"
            aria-selected={value?.toUpperCase() === c}
            className={`fs-color-swatch${value?.toUpperCase() === c ? ' active' : ''}`}
            style={{ background: c }}
            title={c}
            disabled={disabled}
            onClick={() => onChange(c)}
          />
        ))}
      </div>
      <div className="fs-color-row">
        <input
          type="color"
          aria-label="Elegir color"
          disabled={disabled}
          value={value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : '#FFFFFF'}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <input
          type="text"
          placeholder="#RRGGBB"
          spellCheck={false}
          disabled={disabled}
          value={draft}
          onChange={(e) => {
            const v = e.target.value.trim()
            setDraft(v)
            if (!v) onChange(null)
            else if (HEX_RE.test(v)) onChange(v)
          }}
          onBlur={() => {
            if (draft && !HEX_RE.test(draft)) setDraft(value || '')
          }}
        />
        <button type="button" className="ghost" disabled={disabled || !value} onClick={() => onChange(null)}>
          Automático
        </button>
      </div>
    </div>
  )
}

export function FlowInspector() {
  const ctrl = useFlowCtx()
  const { sel, headerSel, model } = ctrl

  if (headerSel?.kind === 'lane') {
    const lane = model.lanes.find((l) => l.id === headerSel.id)
    if (!lane) return null
    return (
      <div className="fs-inspector">
        <h3>Carril</h3>
        <label>
          Nombre
          <input
            value={lane.name}
            disabled={ctrl.readOnly}
            onChange={(e) => ctrl.updateLane(lane.id, { name: e.target.value })}
          />
        </label>
        <label>
          Altura
          <input
            type="number"
            value={lane.height ?? 260}
            disabled={ctrl.readOnly}
            onChange={(e) => ctrl.updateLane(lane.id, { height: +e.target.value })}
          />
        </label>
        <label>
          Color del carril
          <ColorField
            value={lane.color}
            disabled={ctrl.readOnly}
            onChange={(color) => ctrl.updateLane(lane.id, { color })}
          />
        </label>
        {!ctrl.readOnly && (
          <>
            <button type="button" onClick={() => ctrl.moveLane(lane.id, -1)}>Subir</button>
            <button type="button" onClick={() => ctrl.moveLane(lane.id, 1)}>Bajar</button>
            <button type="button" className="danger" onClick={() => ctrl.confirmDeleteLane(lane.id)}>
              Eliminar carril
            </button>
          </>
        )}
      </div>
    )
  }

  if (headerSel?.kind === 'phase') {
    const phase = model.phases?.find((p) => p.id === headerSel.id)
    if (!phase) return null
    return (
      <div className="fs-inspector">
        <h3>Fase</h3>
        <label>
          Nombre
          <input
            value={phase.name}
            disabled={ctrl.readOnly}
            onChange={(e) => ctrl.updatePhase(phase.id, { name: e.target.value })}
          />
        </label>
        <label>
          Ancho
          <input
            type="number"
            value={phase.width ?? 800}
            disabled={ctrl.readOnly}
            onChange={(e) => ctrl.updatePhase(phase.id, { width: +e.target.value })}
          />
        </label>
        <p className="fs-hint">Eliminar la fase no borra los pasos.</p>
        {!ctrl.readOnly && (
          <>
            <button type="button" onClick={() => ctrl.movePhase(phase.id, -1)}>Mover izq.</button>
            <button type="button" onClick={() => ctrl.movePhase(phase.id, 1)}>Mover der.</button>
            <button type="button" className="danger" onClick={() => ctrl.deletePhase(phase.id)}>
              Eliminar fase
            </button>
          </>
        )}
      </div>
    )
  }

  const multi = sel.nodeIds.length + sel.edgeIds.length > 1
  if (multi) {
    return (
      <div className="fs-inspector">
        <h3>Selección múltiple</h3>
        <p>
          {sel.nodeIds.length} pasos, {sel.edgeIds.length} flechas
        </p>
        {!ctrl.readOnly && sel.nodeIds.length >= 2 && (
          <>
            <label>
              Cambiar carril
              <select
                onChange={(e) => {
                  const lane = e.target.value
                  sel.nodeIds.forEach((id) => ctrl.updateNode(id, { lane }))
                }}
              >
                {model.lanes.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </label>
            <label>
              Cambiar tipo
              <select
                onChange={(e) => {
                  sel.nodeIds.forEach((id) => ctrl.updateNode(id, { type: e.target.value }))
                }}
              >
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>{TYPE_DEFAULTS[t].name}</option>
                ))}
              </select>
            </label>
            <label>
              Color de los pasos
              <ColorField
                onChange={(color) => {
                  sel.nodeIds.forEach((id) => ctrl.updateNode(id, { color }))
                }}
              />
            </label>
            <label>
              Color de la letra
              <ColorField
                onChange={(textColor) => {
                  sel.nodeIds.forEach((id) => ctrl.updateNode(id, { textColor }))
                }}
              />
            </label>
            <div className="fs-align-btns">
              <button type="button" onClick={() => ctrl.alignNodes(sel.nodeIds, 'left')}>Alinear izq.</button>
              <button type="button" onClick={() => ctrl.alignNodes(sel.nodeIds, 'hcenter')}>Centro H</button>
              <button type="button" onClick={() => ctrl.alignNodes(sel.nodeIds, 'top')}>Alinear arriba</button>
              <button type="button" onClick={() => ctrl.alignNodes(sel.nodeIds, 'vcenter')}>Centro V</button>
              <button type="button" onClick={() => ctrl.distributeNodes(sel.nodeIds)}>Distribuir H</button>
            </div>
            <button type="button" onClick={() => ctrl.duplicate()}>Duplicar</button>
            <button type="button" className="danger" onClick={() => ctrl.mutate((m) => deleteElements(m, { nodeIds: sel.nodeIds, edgeIds: sel.edgeIds }))}>
              Eliminar
            </button>
          </>
        )}
      </div>
    )
  }

  if (sel.edgeIds.length === 1) {
    const edge = model.edges.find((e) => e.id === sel.edgeIds[0])
    if (!edge) return null
    const from = model.nodes.find((n) => n.id === edge.from)
    const to = model.nodes.find((n) => n.id === edge.to)
    return (
      <div className="fs-inspector">
        <h3>Conexión</h3>
        <p>{from?.label || edge.from} → {to?.label || edge.to}</p>
        <label>
          Etiqueta
          <input
            value={edge.label || ''}
            disabled={ctrl.readOnly}
            onChange={(e) => ctrl.updateEdge(edge.id, { label: e.target.value || undefined })}
          />
        </label>
        <label>
          Tipo
          <select
            value={edge.kind || 'flow'}
            disabled={ctrl.readOnly}
            onChange={(e) => ctrl.updateEdge(edge.id, { kind: e.target.value })}
          >
            {Object.entries(EDGE_KIND_NAMES).map(([k, name]) => (
              <option key={k} value={k}>{name}</option>
            ))}
          </select>
        </label>
        {!ctrl.readOnly && (
          <>
            <label>
              Sale por
              <select
                value={edge.fromHandle || ''}
                onChange={(e) => ctrl.updateEdge(edge.id, { fromHandle: e.target.value || undefined })}
              >
                <option value="">Automático</option>
                {SIDES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              Entra por
              <select
                value={edge.toHandle || ''}
                onChange={(e) => ctrl.updateEdge(edge.id, { toHandle: e.target.value || undefined })}
              >
                <option value="">Automático</option>
                {SIDES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => ctrl.updateEdge(edge.id, { center: undefined })}>
              Restablecer recorrido
            </button>
            <button type="button" onClick={() => ctrl.reverseEdge(edge.id)}>Invertir</button>
            <button type="button" className="danger" onClick={() => ctrl.mutate((m) => deleteElements(m, { edgeIds: [edge.id] }))}>
              Eliminar
            </button>
          </>
        )}
      </div>
    )
  }

  if (sel.nodeIds.length === 1) {
    const n = model.nodes.find((x) => x.id === sel.nodeIds[0])
    if (!n) return null
    const sz = nodeSize(n)
    return (
      <div className="fs-inspector">
        <h3>{TYPE_DEFAULTS[n.type]?.name || n.type}</h3>
        <label>
          Texto
          <textarea
            value={n.label}
            disabled={ctrl.readOnly}
            onChange={(e) => ctrl.updateNode(n.id, { label: e.target.value })}
          />
        </label>
        <label>
          Tipo
          <select
            value={n.type}
            disabled={ctrl.readOnly}
            onChange={(e) => ctrl.updateNode(n.id, { type: e.target.value })}
          >
            {TYPE_ORDER.map((t) => (
              <option key={t} value={t}>{TYPE_DEFAULTS[t].name}</option>
            ))}
          </select>
        </label>
        <label>
          Carril
          <select
            value={n.lane}
            disabled={ctrl.readOnly}
            onChange={(e) => ctrl.updateNode(n.id, { lane: e.target.value })}
          >
            {model.lanes.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <label>
          Color del paso
          <ColorField
            value={n.color}
            disabled={ctrl.readOnly}
            onChange={(color) => ctrl.updateNode(n.id, { color })}
          />
        </label>
        <label>
          Color de la letra
          <ColorField
            value={n.textColor}
            disabled={ctrl.readOnly}
            onChange={(textColor) => ctrl.updateNode(n.id, { textColor })}
          />
        </label>
        <label>
          Nota
          <textarea
            value={n.note || ''}
            disabled={ctrl.readOnly}
            onChange={(e) => ctrl.updateNode(n.id, { note: e.target.value || undefined })}
          />
        </label>
        <p className="fs-hint">Tamaño: {sz.w}×{sz.h} px</p>
        {!ctrl.readOnly && (
          <>
            <button type="button" onClick={() => ctrl.duplicate()}>Duplicar</button>
            <button type="button" className="danger" onClick={() => ctrl.mutate((m) => deleteElements(m, { nodeIds: [n.id] }))}>
              Eliminar
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="fs-inspector fs-inspector-help">
      <h3>Ayuda</h3>
      <ul>
        <li>Arrastra pasos entre carriles</li>
        <li>Conecta desde los puntos del paso</li>
        <li>⌘Z deshacer · ⌘K buscar · F ajustar vista</li>
        <li>Shift+arrastrar selección múltiple</li>
      </ul>
    </div>
  )
}
