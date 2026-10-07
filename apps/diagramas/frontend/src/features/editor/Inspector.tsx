import {
  DEFAULT_LANE_ROWS,
  MAX_LANE_ROWS,
  MIN_LANE_ROWS,
  NODE_MAX_H,
  NODE_MAX_W,
  PORT_NAMES,
  PORTS,
  TYPE_ORDER,
  TYPES,
  clamp,
  clampNodeSize,
  laneRows,
  measureNode,
  minNodeSize,
  placeFree,
  type NodeType,
  type Port,
} from '../../core/carriles'
import { typeIcon } from './CanvasSvg'
import type { EditorController } from './useEditorController'

export function Inspector({ ctrl }: { ctrl: EditorController }) {
  const { model, sel, L, confirmLane, select, mutate, deleteSel, addNode } = ctrl

  if (!sel) {
    return (
      <div className="help">
        <h3>Cómo se usa</h3>
        <ul>
          <li>Toca un paso, una flecha o el nombre de un carril para editarlo aquí.</li>
          <li>Arrastra un paso a otro carril, columna o fila dentro del carril (por defecto cada carril tiene 2 filas).</li>
          <li>Pasa el cursor por un paso: aparecen 4 puntos (arriba, derecha, abajo, izquierda). Arrastra desde uno hasta el lado del paso destino para conectarlos.</li>
          <li>Con un paso seleccionado, arrastra el cuadrito de la esquina inferior derecha para cambiar el tamaño a mano.</li>
          <li>Las notas de cada paso se numeran y se listan debajo del diagrama.</li>
          <li>Más abajo puedes agregar cards de documentación del proceso en Markdown (con Mermaid), como en la Wiki.</li>
          <li>Escribe o pega JSON en el panel izquierdo y el diagrama se actualiza al instante.</li>
        </ul>
        <div className="lbl" style={{ marginBottom: 8 }}>Formas</div>
        <div className="legend">
          {TYPE_ORDER.map((t) => (
            <span key={t} style={{ display: 'contents' }}>
              {typeIcon(t)}
              <span>{TYPES[t].name}</span>
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (sel.kind === 'node') {
    const n = model.nodes.find((x) => x.id === sel.id)
    if (!n) return null
    const g = L.G[n.id]
    const conns = model.edges
      .map((e, i) => {
        if (e.from !== n.id && e.to !== n.id) return null
        const out = e.from === n.id
        const o = model.nodes.find((x) => x.id === (out ? e.to : e.from))
        return (
          <button
            key={i}
            type="button"
            className="conn"
            onClick={() => select({ kind: 'edge', i })}
          >
            {(out ? '→ ' : '← ') + (o?.label || '?') + (e.label ? ' · ' + e.label : '')}
          </button>
        )
      })
      .filter(Boolean)

    return (
      <>
        <div className="insp-head">
          <span className="insp-chip">Paso</span>
          <button className="x" type="button" onClick={() => select(null)}>Cerrar</button>
        </div>
        <div className="f">
          <label className="lbl" htmlFor="i-label">Texto</label>
          <textarea
            id="i-label"
            rows={2}
            value={n.label}
            onChange={(e) => {
              const v = e.target.value
              mutate((m) => {
                const node = m.nodes.find((x) => x.id === sel.id)
                if (node) node.label = v
              }, { key: 'lbl' + sel.id })
            }}
          />
        </div>
        <div className="f">
          <span className="lbl">Forma</span>
          <div className="seg">
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={n.type === t}
                onClick={() =>
                  mutate((m) => {
                    const node = m.nodes.find((x) => x.id === sel.id)
                    if (node) node.type = t
                  })
                }
              >
                {TYPES[t].name}
              </button>
            ))}
          </div>
        </div>
        <div className="f">
          <label className="lbl" htmlFor="i-lane">Carril</label>
          <select
            id="i-lane"
            value={n.lane}
            onChange={(e) => {
              const lane = e.target.value
              mutate((m) => {
                const node = m.nodes.find((x) => x.id === sel.id)
                if (!node) return
                node.lane = lane
                const placed = placeFree(m, lane, node.step || 1, node.row || 1, node)
                node.step = placed.step
                node.row = placed.row
              })
            }}
          >
            {model.lanes.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div className="f">
          <label className="lbl" htmlFor="i-step">Paso (columna)</label>
          <div className="stepper">
            <button
              type="button"
              aria-label="Un paso antes"
              onClick={() => {
                const cur = (g?.c ?? 0) + 1
                setCell(ctrl, sel.id, Math.max(1, cur - 1), (g?.ri ?? 0) + 1)
              }}
            >−</button>
            <input
              id="i-step"
              type="number"
              min={1}
              value={(g?.c ?? 0) + 1}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (v >= 1) setCell(ctrl, sel.id, v, (g?.ri ?? 0) + 1)
              }}
            />
            <button
              type="button"
              aria-label="Un paso después"
              onClick={() => {
                const cur = (g?.c ?? 0) + 1
                setCell(ctrl, sel.id, cur + 1, (g?.ri ?? 0) + 1)
              }}
            >+</button>
          </div>
        </div>
        <div className="f">
          <label className="lbl" htmlFor="i-row">Fila en el carril</label>
          <div className="stepper">
            <button
              type="button"
              aria-label="Fila anterior"
              onClick={() => {
                const maxR = laneRows(model.lanes.find((l) => l.id === n.lane))
                const cur = (g?.ri ?? 0) + 1
                setCell(ctrl, sel.id, (g?.c ?? 0) + 1, Math.max(1, cur - 1), maxR)
              }}
            >−</button>
            <input
              id="i-row"
              type="number"
              min={1}
              max={laneRows(model.lanes.find((l) => l.id === n.lane))}
              value={(g?.ri ?? 0) + 1}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                const maxR = laneRows(model.lanes.find((l) => l.id === n.lane))
                if (v >= 1) setCell(ctrl, sel.id, (g?.c ?? 0) + 1, v, maxR)
              }}
            />
            <button
              type="button"
              aria-label="Fila siguiente"
              onClick={() => {
                const maxR = laneRows(model.lanes.find((l) => l.id === n.lane))
                const cur = (g?.ri ?? 0) + 1
                setCell(ctrl, sel.id, (g?.c ?? 0) + 1, Math.min(maxR, cur + 1), maxR)
              }}
            >+</button>
          </div>
        </div>
        <div className="f">
          <span className="lbl">Tamaño</span>
          <div className="stepper size-row">
            <label className="lbl" htmlFor="i-w">Ancho</label>
            <input
              id="i-w"
              type="number"
              min={minNodeSize(n.type).w}
              max={NODE_MAX_W}
              value={g?.w ?? measureNode(n).w}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!Number.isFinite(v)) return
                mutate((m) => {
                  const node = m.nodes.find((x) => x.id === sel.id)
                  if (!node) return
                  const sized = clampNodeSize(node.type, v, node.h ?? g?.h ?? measureNode(node).h)
                  node.w = sized.w
                  node.h = sized.h
                }, { key: 'size' + sel.id })
              }}
            />
            <label className="lbl" htmlFor="i-h">Alto</label>
            <input
              id="i-h"
              type="number"
              min={minNodeSize(n.type).h}
              max={NODE_MAX_H}
              value={g?.h ?? measureNode(n).h}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!Number.isFinite(v)) return
                mutate((m) => {
                  const node = m.nodes.find((x) => x.id === sel.id)
                  if (!node) return
                  const sized = clampNodeSize(node.type, node.w ?? g?.w ?? measureNode(node).w, v)
                  node.w = sized.w
                  node.h = sized.h
                }, { key: 'size' + sel.id })
              }}
            />
          </div>
          <button
            type="button"
            style={{ marginTop: 6 }}
            disabled={n.w == null && n.h == null}
            title="Vuelve al tamaño automático según el texto"
            onClick={() =>
              mutate((m) => {
                const node = m.nodes.find((x) => x.id === sel.id)
                if (!node) return
                delete node.w
                delete node.h
              })
            }
          >
            Automático
          </button>
          {(n.w != null || n.h != null) && (
            <p className="size-hint">Tamaño manual · máx. {NODE_MAX_W}×{NODE_MAX_H} px</p>
          )}
        </div>
        <div className="f">
          <label className="lbl" htmlFor="i-note">Nota</label>
          <textarea
            id="i-note"
            rows={3}
            placeholder="Responsable, regla, detalle…"
            value={n.note || ''}
            onChange={(e) => {
              const v = e.target.value
              mutate((m) => {
                const node = m.nodes.find((x) => x.id === sel.id)
                if (!node) return
                if (v) node.note = v
                else delete node.note
              }, { key: 'note' + sel.id })
            }}
          />
        </div>
        {conns.length > 0 && (
          <div className="f">
            <span className="lbl">Conexiones</span>
            <div className="conns">{conns}</div>
          </div>
        )}
        <div className="row">
          <button
            type="button"
            onClick={() => {
              let newId = ''
              mutate((m) => {
                const src = m.nodes.find((o) => o.id === sel.id)
                if (!src) return
                let k = 1
                while (m.nodes.some((o) => o.id === 'n' + k)) k++
                const placed = placeFree(m, src.lane, (src.step || 1) + 1, src.row || 1)
                const c = {
                  ...src,
                  id: 'n' + k,
                  label: src.label + ' (copia)',
                  step: placed.step,
                  row: placed.row,
                }
                m.nodes.push(c)
                newId = c.id
              })
              if (newId) select({ kind: 'node', id: newId })
            }}
          >
            Duplicar
          </button>
          <button type="button" className="danger" onClick={deleteSel}>Eliminar</button>
        </div>
      </>
    )
  }

  if (sel.kind === 'edge') {
    const e = model.edges[sel.i]
    if (!e) return null
    const a = model.nodes.find((x) => x.id === e.from)
    const b = model.nodes.find((x) => x.id === e.to)
    return (
      <>
        <div className="insp-head">
          <span className="insp-chip">Conexión</span>
          <button className="x" type="button" onClick={() => select(null)}>Cerrar</button>
        </div>
        <p style={{ margin: '0 0 12px', fontWeight: 600 }}>
          {(a?.label || '?') + ' → ' + (b?.label || '?')}
        </p>
        <div className="f">
          <label className="lbl" htmlFor="i-elabel">Etiqueta (opcional)</label>
          <input
            id="i-elabel"
            type="text"
            value={e.label || ''}
            placeholder="Sí, No, Si aplica…"
            onChange={(ev) => {
              const v = ev.target.value
              mutate((m) => {
                const ed = m.edges[sel.i]
                if (!ed) return
                if (v) ed.label = v
                else delete ed.label
              }, { key: 'el' + sel.i })
            }}
          />
        </div>
        <div className="f">
          <span className="lbl">Puntos de conexión</span>
          <div className="ports-grid">
            <label className="lbl" htmlFor="i-fport">Sale por</label>
            <select
              id="i-fport"
              value={e.fromPort || ''}
              onChange={(ev) => {
                const v = ev.target.value as Port | ''
                mutate((m) => {
                  const ed = m.edges[sel.i]
                  if (!ed) return
                  if (v) ed.fromPort = v
                  else delete ed.fromPort
                })
              }}
            >
              <option value="">Automático</option>
              {PORTS.map((p) => (
                <option key={p} value={p}>{PORT_NAMES[p]}</option>
              ))}
            </select>
            <label className="lbl" htmlFor="i-tport">Entra por</label>
            <select
              id="i-tport"
              value={e.toPort || ''}
              onChange={(ev) => {
                const v = ev.target.value as Port | ''
                mutate((m) => {
                  const ed = m.edges[sel.i]
                  if (!ed) return
                  if (v) ed.toPort = v
                  else delete ed.toPort
                })
              }}
            >
              <option value="">Automático</option>
              {PORTS.map((p) => (
                <option key={p} value={p}>{PORT_NAMES[p]}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          <button
            type="button"
            onClick={() =>
              mutate((m) => {
                const ed = m.edges[sel.i]
                if (!ed) return
                const t = ed.from
                ed.from = ed.to
                ed.to = t
                const fp = ed.fromPort
                const tp = ed.toPort
                if (tp) ed.fromPort = tp
                else delete ed.fromPort
                if (fp) ed.toPort = fp
                else delete ed.toPort
              })
            }
          >
            Invertir dirección
          </button>
          <button type="button" className="danger" onClick={deleteSel}>Eliminar</button>
        </div>
      </>
    )
  }

  const l = model.lanes[sel.i]
  if (!l) return null
  const cnt = model.nodes.filter((n) => n.lane === l.id).length
  return (
    <>
      <div className="insp-head">
        <span className="insp-chip">Carril</span>
        <button className="x" type="button" onClick={() => select(null)}>Cerrar</button>
      </div>
      <div className="f">
        <label className="lbl" htmlFor="i-lname">Nombre</label>
        <input
          id="i-lname"
          type="text"
          value={l.name}
          onChange={(e) => {
            const v = e.target.value
            mutate((m) => {
              m.lanes[sel.i].name = v || ' '
            }, { key: 'ln' + sel.i })
          }}
        />
      </div>
      <div className="f">
        <label className="lbl" htmlFor="i-lrows">Filas de grid</label>
        <div className="stepper">
          <button
            type="button"
            aria-label="Menos filas"
            disabled={laneRows(l) <= MIN_LANE_ROWS}
            onClick={() => setLaneRows(ctrl, sel.i, laneRows(l) - 1)}
          >−</button>
          <input
            id="i-lrows"
            type="number"
            min={MIN_LANE_ROWS}
            max={MAX_LANE_ROWS}
            value={laneRows(l)}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (Number.isFinite(v)) setLaneRows(ctrl, sel.i, v)
            }}
          />
          <button
            type="button"
            aria-label="Más filas"
            disabled={laneRows(l) >= MAX_LANE_ROWS}
            onClick={() => setLaneRows(ctrl, sel.i, laneRows(l) + 1)}
          >+</button>
        </div>
        <p className="size-hint">Por defecto {DEFAULT_LANE_ROWS}. Máx. {MAX_LANE_ROWS}.</p>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          disabled={sel.i === 0}
          onClick={() => {
            const li = sel.i
            const to = li - 1
            mutate((m) => {
              const t = m.lanes[li]
              m.lanes[li] = m.lanes[to]
              m.lanes[to] = t
            })
            select({ kind: 'lane', i: to })
          }}
        >
          Subir
        </button>
        <button
          type="button"
          disabled={sel.i === model.lanes.length - 1}
          onClick={() => {
            const li = sel.i
            const to = li + 1
            mutate((m) => {
              const t = m.lanes[li]
              m.lanes[li] = m.lanes[to]
              m.lanes[to] = t
            })
            select({ kind: 'lane', i: to })
          }}
        >
          Bajar
        </button>
        <button type="button" onClick={() => addNode('task' as NodeType)}>
          Agregar tarea aquí
        </button>
      </div>
      {confirmLane && (
        <p className="warnnote">
          Se eliminarán {cnt} pasos de este carril y sus conexiones. Pulsa de nuevo para confirmar.
        </p>
      )}
      <div className="row">
        <button type="button" className="danger" onClick={deleteSel}>
          {confirmLane ? 'Confirmar y eliminar' : 'Eliminar carril'}
        </button>
      </div>
    </>
  )
}

function setCell(
  ctrl: EditorController,
  id: string,
  step: number,
  row: number,
  maxRow?: number,
) {
  ctrl.mutate((m) => {
    const n = m.nodes.find((x) => x.id === id)
    if (!n) return
    const rows = maxRow ?? laneRows(m.lanes.find((l) => l.id === n.lane))
    const placed = placeFree(m, n.lane, step, clamp(row, 1, rows), n)
    n.step = placed.step
    n.row = placed.row
  }, { key: 'cell' + id })
}

function setLaneRows(ctrl: EditorController, laneIndex: number, rowsRaw: number) {
  ctrl.mutate((m) => {
    const lane = m.lanes[laneIndex]
    if (!lane) return
    const rows = clamp(Math.round(rowsRaw), MIN_LANE_ROWS, MAX_LANE_ROWS)
    if (rows === DEFAULT_LANE_ROWS) delete lane.rows
    else lane.rows = rows
    m.nodes.forEach((n) => {
      if (n.lane !== lane.id || n.row == null) return
      if (n.row > rows) n.row = rows
    })
  }, { key: 'lrows' + laneIndex })
}
