import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CRONO_LABELS_W_KEY,
  CRONO_LABELS_W_MAX,
  CRONO_LABELS_W_MIN,
  CRONO_SCALE_KEY,
} from '../lib/constants'
import type { CronoScale, Task } from '../lib/types'
import {
  addDays,
  barEstadoClass,
  barGeometry,
  colorDeGrupo,
  computeCronoRange,
  cronoPxPerDay,
  daysBetween,
  filteredPadres,
  hijos,
  isPlaceholderTitle,
  todayStr,
} from '../lib/utils'
import { useRoadmap } from '../state/RoadmapStore'

export function CronoView() {
  const {
    state,
    setUi,
    select,
    updateTask,
    toggleExpand,
    reorderPadres,
    renameGrupo,
  } = useRoadmap()

  const list = useMemo(
    () => filteredPadres(state.tareas, state.search, state.filtroEstado, state.filtroGrupos),
    [state.tareas, state.search, state.filtroEstado, state.filtroGrupos],
  )

  const range = useMemo(() => computeCronoRange(state.tareas), [state.tareas])
  const px = cronoPxPerDay(state.cronoScale)
  const trackW = Math.max(range.days * px, 600)
  const bodyRef = useRef<HTMLDivElement>(null)
  const scrollPos = useRef<{ top: number; left: number } | null>(null)
  const justReordered = useRef(false)
  const [liveBars, setLiveBars] = useState<Record<string, { left: number; width: number }>>({})
  const [dropTarget, setDropTarget] = useState<{ id: string; before: boolean } | null>(null)
  const dragId = useRef<string | null>(null)

  // Preserve scroll across expand
  useEffect(() => {
    const el = bodyRef.current
    if (!el || !scrollPos.current) return
    el.scrollTop = scrollPos.current.top
    el.scrollLeft = scrollPos.current.left
    requestAnimationFrame(() => {
      if (!el || !scrollPos.current) return
      el.scrollTop = scrollPos.current.top
      el.scrollLeft = scrollPos.current.left
    })
  }, [state.expandedTasks, state.tareas, state.cronoScale])

  const captureScroll = () => {
    const el = bodyRef.current
    if (el) scrollPos.current = { top: el.scrollTop, left: el.scrollLeft }
  }

  const groups = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of list) {
      const g = t.grupo || 'Sin grupo'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(t)
    }
    return map
  }, [list])

  const sinFechas = list.filter((t) => t.tipo !== 'hito' && !t.fecha_inicio)

  const setScale = (cronoScale: CronoScale) => {
    setUi({ cronoScale })
    try {
      localStorage.setItem(CRONO_SCALE_KEY, cronoScale)
    } catch {
      /* */
    }
  }

  const onLabelsResize = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = state.cronoLabelsW
    const target = e.currentTarget as HTMLElement
    target.classList.add('is-active')
    document.body.classList.add('crono-resizing')
    target.setPointerCapture(e.pointerId)
    let last = startW
    const onMove = (ev: PointerEvent) => {
      last = Math.min(CRONO_LABELS_W_MAX, Math.max(CRONO_LABELS_W_MIN, startW + (ev.clientX - startX)))
      setUi({ cronoLabelsW: last })
      document.documentElement.style.setProperty('--crono-labels-w', `${last}px`)
    }
    const onUp = () => {
      target.classList.remove('is-active')
      document.body.classList.remove('crono-resizing')
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      try {
        localStorage.setItem(CRONO_LABELS_W_KEY, String(last))
      } catch {
        /* */
      }
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
  }

  const onBarPointerDown = (t: Task, e: React.PointerEvent) => {
    if (t.tipo === 'hito') {
      select(t.id)
      return
    }
    if (!t.fecha_inicio || !t.fecha_fin) return
    e.preventDefault()
    const handle =
      ((e.target as HTMLElement).dataset.handle as 'left' | 'right' | 'move' | undefined) || 'move'
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const origIni = t.fecha_inicio
    const origFin = t.fecha_fin
    const startX = e.clientX
    let lastX = startX

    const onMove = (ev: PointerEvent) => {
      lastX = ev.clientX
      const dDays = Math.round((ev.clientX - startX) / px)
      let ini = origIni
      let fin = origFin
      if (handle === 'move') {
        ini = addDays(origIni, dDays)
        fin = addDays(origFin, dDays)
      } else if (handle === 'left') {
        ini = addDays(origIni, dDays)
        if (ini > origFin) ini = origFin
      } else {
        fin = addDays(origFin, dDays)
        if (fin < origIni) fin = origIni
      }
      const geom = barGeometry(
        { ...t, fecha_inicio: ini, fecha_fin: fin },
        range,
        px,
      )
      if (geom && geom.kind === 'bar') {
        setLiveBars((prev) => ({ ...prev, [t.id]: { left: geom.left, width: geom.width } }))
      }
      ;(el as HTMLElement & { _draft?: { ini: string; fin: string } })._draft = { ini, fin }
    }
    const onUp = () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      const draft = (el as HTMLElement & { _draft?: { ini: string; fin: string } })._draft
      setLiveBars((prev) => {
        const next = { ...prev }
        delete next[t.id]
        return next
      })
      if (draft) {
        updateTask(t.id, { fecha_inicio: draft.ini, fecha_fin: draft.fin })
      }
      if (Math.abs(lastX - startX) < 4) select(t.id)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  }

  const headerCells = () => {
    const cells: React.ReactNode[] = []
    if (state.cronoScale === 'dias') {
      for (let i = 0; i < range.days; i++) {
        const d = addDays(range.min, i)
        const dt = new Date(d + 'T12:00:00')
        const dow = dt.getDay()
        const weekend = dow === 0 || dow === 6
        const isToday = d === todayStr()
        cells.push(
          <div
            key={d}
            className={`month day-cell${weekend ? ' weekend' : ''}${isToday ? ' today-cell' : ''}`}
            style={{ width: px, minWidth: px }}
          >
            <strong>{dt.getDate()}</strong>
            <span>{dt.toLocaleDateString('es-CO', { weekday: 'short' })}</span>
          </div>,
        )
      }
    } else if (state.cronoScale === 'meses') {
      let i = 0
      while (i < range.days) {
        const d = addDays(range.min, i)
        const dt = new Date(d + 'T12:00:00')
        const month = dt.getMonth()
        const year = dt.getFullYear()
        let span = 0
        while (i + span < range.days) {
          const d2 = addDays(range.min, i + span)
          const dt2 = new Date(d2 + 'T12:00:00')
          if (dt2.getMonth() !== month || dt2.getFullYear() !== year) break
          span++
        }
        cells.push(
          <div key={d} className="month" style={{ width: span * px, minWidth: span * px }}>
            {dt.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
          </div>,
        )
        i += span
      }
    } else {
      for (let i = 0; i < range.days; i += 7) {
        const d = addDays(range.min, i)
        const span = Math.min(7, range.days - i)
        const dt = new Date(d + 'T12:00:00')
        cells.push(
          <div key={d} className="month" style={{ width: span * px, minWidth: span * px }}>
            Sem. {dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            <span>
              → {addDays(d, span - 1).slice(5)}
            </span>
          </div>,
        )
      }
    }
    return cells
  }

  const todayLeft = daysBetween(range.min, todayStr()) * px

  const renderBar = (t: Task, isSub = false) => {
    const geom = barGeometry(t, range, px)
    const live = liveBars[t.id]
    if (!geom && !live) return null
    if (geom?.kind === 'milestone' || (t.tipo === 'hito' && t.fecha_inicio)) {
      const left = geom && geom.kind === 'milestone' ? geom.left : 0
      return (
        <div
          className="milestone"
          style={{ left }}
          data-bar={t.id}
          onClick={() => select(t.id)}
          title={t.titulo}
        />
      )
    }
    const left = live?.left ?? (geom && geom.kind === 'bar' ? geom.left : 0)
    const width = live?.width ?? (geom && geom.kind === 'bar' ? geom.width : 10)
    return (
      <div
        className={`bar ${barEstadoClass(t.estado)}${isSub ? ' sub-bar' : ''}`}
        style={{ left, width }}
        data-bar={t.id}
        onPointerDown={(e) => onBarPointerDown(t, e)}
      >
        <i className="handle left" data-handle="left" />
        {!isSub && <span>{t.titulo}</span>}
        <i className="handle right" data-handle="right" />
      </div>
    )
  }

  return (
    <div className="crono" style={{ ['--crono-labels-w' as string]: `${state.cronoLabelsW}px` }}>
      <div className="crono-main">
        <div className="crono-toolbar">
          <span className="muted" style={{ fontWeight: 700, fontSize: 12 }}>
            Escala
          </span>
          {(['dias', 'semanas', 'meses'] as CronoScale[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`btn btn-sm${state.cronoScale === s ? ' btn-primary' : ''}`}
              onClick={() => setScale(s)}
            >
              {s === 'dias' ? 'Días' : s === 'semanas' ? 'Semanas' : 'Meses'}
            </button>
          ))}
          <label style={{ marginLeft: 12, fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={state.showSubInCrono}
              onChange={(e) => setUi({ showSubInCrono: e.target.checked })}
            />
            Mostrar subtareas
          </label>
        </div>
        <div className="crono-body" ref={bodyRef}>
          <div className="crono-labels">
            <div className="lab-head">Tareas</div>
            {[...groups.entries()].map(([grupo, tasks]) => {
              const c = colorDeGrupo(grupo, state.grupoColores)
              return (
                <div key={grupo}>
                  <div className="lab-group">
                    <button
                      type="button"
                      className="grupo-color-btn"
                      style={{ background: c.swatch }}
                      onClick={(e) => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                        setUi({
                          colorPickerGrupo: grupo,
                          colorPickerAnchor: { top: r.bottom + 6, left: r.left },
                        })
                      }}
                    />
                    <GrupoInput nombre={grupo} onRename={(n) => renameGrupo(grupo, n)} />
                  </div>
                  {tasks.map((t) => {
                    const kids = hijos(state.tareas, t.id)
                    const expanded = state.expandedTasks.includes(t.id)
                    return (
                      <div key={t.id}>
                        <div
                          className={`lab-task${dropTarget?.id === t.id ? (dropTarget.before ? ' drop-before' : ' drop-after') : ''}${isPlaceholderTitle(t.titulo) ? ' is-placeholder' : ''}`}
                          data-reorder={t.id}
                          draggable
                          onDragStart={() => {
                            dragId.current = t.id
                          }}
                          onDragOver={(e) => {
                            e.preventDefault()
                            const before =
                              e.nativeEvent.offsetY <
                              (e.currentTarget as HTMLElement).offsetHeight / 2
                            setDropTarget({ id: t.id, before })
                          }}
                          onDragLeave={() => setDropTarget(null)}
                          onDrop={(e) => {
                            e.preventDefault()
                            const src = dragId.current
                            if (src && dropTarget) {
                              justReordered.current = true
                              reorderPadres(src, dropTarget.id, dropTarget.before)
                            }
                            setDropTarget(null)
                            dragId.current = null
                          }}
                          onClick={() => {
                            if (justReordered.current) {
                              justReordered.current = false
                              return
                            }
                            select(t.id)
                          }}
                        >
                          <span className="drag-handle">⠿</span>
                          {t.tipo !== 'hito' && (
                            <button
                              type="button"
                              className="expand"
                              onClick={(e) => {
                                e.stopPropagation()
                                captureScroll()
                                toggleExpand(t.id)
                              }}
                            >
                              {kids.length ? (expanded ? '▾' : '▸') : '·'}
                            </button>
                          )}
                          <span className="t">
                            {t.tipo === 'hito' ? '◆ ' : ''}
                            {t.titulo}
                          </span>
                          {kids.length > 0 && <span className="sub-count">{kids.length}</span>}
                        </div>
                        {expanded &&
                          state.showSubInCrono &&
                          kids.map((k) => (
                            <div
                              key={k.id}
                              className="lab-task sub"
                              onClick={() => select(k.id)}
                            >
                              <span className="t">{k.titulo}</span>
                            </div>
                          ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          <div className="crono-labels-resizer" onPointerDown={onLabelsResize} title="Ancho de etiquetas" />
          <div className="crono-track" style={{ width: trackW }} data-range-min={range.min} data-px={px}>
            <div className="crono-head" style={{ width: trackW }}>
              {headerCells()}
            </div>
            <div className="crono-rows" style={{ width: trackW, position: 'relative' }}>
              <div
                className="today-line"
                style={{ left: todayLeft, position: 'absolute', top: 0, bottom: 0, width: 2, background: 'var(--red)', zIndex: 2, pointerEvents: 'none', opacity: 0.7 }}
              />
              {[...groups.entries()].map(([grupo, tasks]) => (
                <div key={grupo}>
                  <div className="crono-row group" />
                  {tasks.map((t) => {
                    const kids = hijos(state.tareas, t.id)
                    const expanded = state.expandedTasks.includes(t.id)
                    return (
                      <div key={t.id}>
                        <div className="crono-row">{renderBar(t)}</div>
                        {expanded &&
                          state.showSubInCrono &&
                          kids.map((k) => (
                            <div key={k.id} className="crono-row">
                              {renderBar(k, true)}
                            </div>
                          ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {sinFechas.length > 0 && (
        <aside className="sin-fechas">
          <h3>Sin fechas</h3>
          <p className="hint">Tareas sin inicio. Programar las pone a partir de hoy.</p>
          {sinFechas.map((t) => (
            <div key={t.id} className="item">
              <div className="tit" onClick={() => select(t.id)} style={{ cursor: 'pointer' }}>
                {t.titulo}
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  const ini = todayStr()
                  const est = typeof t.estimacion_dias === 'number' ? t.estimacion_dias : 3
                  updateTask(t.id, {
                    fecha_inicio: ini,
                    fecha_fin: addDays(ini, Math.max(est, 1) - 1),
                  })
                }}
              >
                Programar
              </button>
            </div>
          ))}
        </aside>
      )}
    </div>
  )
}

function GrupoInput({ nombre, onRename }: { nombre: string; onRename: (n: string) => void }) {
  const [val, setVal] = useState(nombre)
  return (
    <input
      className="group-name-input"
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        if (val.trim() && val.trim() !== nombre) onRename(val.trim())
        else setVal(nombre)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

