import { useEffect, useRef, useState } from 'react'
import { ESTADOS, GRUPOS_SUGERIDOS, PRIORIDADES } from '../lib/constants'
import type { Estado, Prioridad, Task, Tipo } from '../lib/types'
import { gruposExistentes, hijos, isPlaceholderTitle } from '../lib/utils'
import { useRoadmap } from '../state/RoadmapStore'

export function TaskDrawer() {
  const {
    state,
    select,
    updateTask,
    addSubtarea,
    duplicar,
    eliminar,
    reorderSubtareas,
    showToast,
  } = useRoadmap()
  const t = state.tareas.find((x) => x.id === state.selectedId) || null
  const open = !!t
  const dragSub = useRef<string | null>(null)
  const [dropHint, setDropHint] = useState<{ id: string; before: boolean } | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, select])

  if (!t) {
    return (
      <>
        <div className="overlay" />
        <aside className="drawer" aria-label="Detalle de la tarea" />
      </>
    )
  }

  const isSub = !!t.padre_id
  const kids = hijos(state.tareas, t.id)
  const grupos = [...new Set([...GRUPOS_SUGERIDOS, ...gruposExistentes(state.tareas)])].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )

  const softUpdate = (patch: Partial<Task>) => updateTask(t.id, patch)

  return (
    <>
      <div className={`overlay${open ? ' show' : ''}`} onClick={() => select(null)} />
      <aside className={`drawer${open ? ' show' : ''}`} aria-label="Detalle de la tarea">
        <div className="drawer-head">
          <h2>
            {t.tipo === 'hito' ? '◆ ' : ''}
            {t.titulo}
          </h2>
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            title="Cerrar (Esc)"
            onClick={() => select(null)}
          >
            ✕
          </button>
        </div>
        <div className="drawer-body">
          <div className="field">
            <label>Título</label>
            <input value={t.titulo} onChange={(e) => softUpdate({ titulo: e.target.value })} />
          </div>
          <div className="field">
            <label>Descripción</label>
            <textarea
              placeholder="Qué hay que hacer, contexto, links…"
              value={t.descripcion}
              onChange={(e) => softUpdate({ descripcion: e.target.value })}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Tipo</label>
              <select
                value={t.tipo}
                disabled={isSub}
                onChange={(e) => {
                  const tipo = e.target.value as Tipo
                  softUpdate({
                    tipo,
                    ...(tipo === 'hito'
                      ? { fecha_fin: t.fecha_inicio, estimacion_dias: '' as const }
                      : {}),
                  })
                }}
              >
                <option value="tarea">Tarea</option>
                <option value="hito">Hito</option>
              </select>
            </div>
            <div className="field">
              <label>Grupo</label>
              <input
                list="gruposDatalist"
                value={t.grupo}
                onChange={(e) => softUpdate({ grupo: e.target.value })}
              />
              <datalist id="gruposDatalist">
                {grupos.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Estado</label>
              <select
                value={t.estado}
                onChange={(e) => softUpdate({ estado: e.target.value as Estado })}
              >
                {ESTADOS.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Prioridad</label>
              <select
                value={t.prioridad}
                onChange={(e) => softUpdate({ prioridad: e.target.value as Prioridad })}
              >
                {PRIORIDADES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Responsable</label>
              <input
                value={t.responsable}
                onChange={(e) => softUpdate({ responsable: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Estimación (días)</label>
              <input
                type="number"
                min={0}
                disabled={t.tipo === 'hito'}
                value={t.estimacion_dias === '' ? '' : t.estimacion_dias}
                onChange={(e) =>
                  softUpdate({
                    estimacion_dias: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Inicio</label>
              <input
                type="date"
                value={t.fecha_inicio}
                onChange={(e) => softUpdate({ fecha_inicio: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Fin</label>
              <input
                type="date"
                value={t.fecha_fin}
                disabled={t.tipo === 'hito'}
                onChange={(e) => softUpdate({ fecha_fin: e.target.value })}
              />
            </div>
          </div>

          {!isSub && t.tipo !== 'hito' && (
            <div className="field">
              <label>Subtareas</label>
              <ul className="subtasks-list">
                {kids.map((k) => (
                  <li
                    key={k.id}
                    className={`subtask-item${k.estado === 'Hecha' ? ' done' : ''}${
                      dropHint?.id === k.id
                        ? dropHint.before
                          ? ' drop-before'
                          : ' drop-after'
                        : ''
                    }`}
                    draggable
                    onDragStart={() => {
                      dragSub.current = k.id
                    }}
                    onDragOver={(e) => {
                      e.preventDefault()
                      const before =
                        e.nativeEvent.offsetY < (e.currentTarget as HTMLElement).offsetHeight / 2
                      setDropHint({ id: k.id, before })
                    }}
                    onDragLeave={() => setDropHint(null)}
                    onDrop={(e) => {
                      e.preventDefault()
                      const src = dragSub.current
                      if (src && dropHint) reorderSubtareas(src, dropHint.id, dropHint.before)
                      setDropHint(null)
                      dragSub.current = null
                    }}
                  >
                    <span className="sub-drag" title="Arrastrar">
                      ⠿
                    </span>
                    <input
                      type="checkbox"
                      checked={k.estado === 'Hecha'}
                      onChange={(e) => {
                        updateTask(k.id, { estado: e.target.checked ? 'Hecha' : 'Por hacer' })
                        if (e.target.checked) {
                          const allDone = kids
                            .filter((x) => x.id !== k.id)
                            .every((x) => x.estado === 'Hecha')
                          if (allDone && kids.length) {
                            showToast('¿Marcar la tarea padre como Hecha?', () =>
                              updateTask(t.id, { estado: 'Hecha' }),
                            )
                          }
                        }
                      }}
                    />
                    <input
                      className={`st-title${isPlaceholderTitle(k.titulo) ? ' is-placeholder' : ''}`}
                      value={k.titulo}
                      onChange={(e) => updateTask(k.id, { titulo: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() => eliminar(k.id)}
                      title="Eliminar"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="add-sub">
                <input
                  placeholder="Nueva subtarea… (Enter)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const v = (e.target as HTMLInputElement).value.trim()
                      addSubtarea(t.id, v || undefined)
                      ;(e.target as HTMLInputElement).value = ''
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <div className="drawer-foot">
          <button className="btn btn-sm" type="button" onClick={() => duplicar(t.id)}>
            Duplicar
          </button>
          <button className="btn btn-sm btn-danger" type="button" onClick={() => eliminar(t.id)}>
            Eliminar
          </button>
          <button
            className="btn btn-sm btn-primary"
            type="button"
            style={{ marginLeft: 'auto' }}
            onClick={() => select(null)}
          >
            Listo
          </button>
        </div>
      </aside>
    </>
  )
}
