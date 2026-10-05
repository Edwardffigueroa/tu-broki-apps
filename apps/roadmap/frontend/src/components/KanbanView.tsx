import { useRef, useState } from 'react'
import { ESTADOS } from '../lib/constants'
import type { Estado } from '../lib/types'
import {
  estadoClass,
  filteredPadres,
  grupoStyle,
  hijos,
  isPlaceholderTitle,
  prioClass,
  todayStr,
} from '../lib/utils'
import { useRoadmap } from '../state/RoadmapStore'

export function KanbanView() {
  const { state, updateTask, select } = useRoadmap()
  const list = filteredPadres(state.tareas, state.search, state.filtroEstado, state.filtroGrupos)
  const dragId = useRef<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  return (
    <div className="kanban">
      {ESTADOS.map((est) => {
        const cards = list.filter((t) => t.estado === est)
        return (
          <div
            key={est}
            className={`kcol${overCol === est ? ' drag-over' : ''}`}
            data-col={est}
            onDragOver={(e) => {
              e.preventDefault()
              setOverCol(est)
            }}
            onDragLeave={() => setOverCol(null)}
            onDrop={(e) => {
              e.preventDefault()
              setOverCol(null)
              const id = e.dataTransfer.getData('text/plain') || dragId.current
              if (!id) return
              const t = state.tareas.find((x) => x.id === id)
              if (!t || t.estado === est) return
              updateTask(id, { estado: est as Estado })
            }}
          >
            <div className="kcol-head">
              <span className={`chip ${estadoClass(est)}`}>{est}</span>
              <span className="n">{cards.length}</span>
            </div>
            {cards.map((t, i) => {
              const kids = hijos(state.tareas, t.id)
              const prog =
                kids.length > 0
                  ? {
                      done: kids.filter((k) => k.estado === 'Hecha').length,
                      total: kids.length,
                    }
                  : null
              const vencida = !!(t.fecha_fin && t.fecha_fin < todayStr() && t.estado !== 'Hecha')
              const ph = isPlaceholderTitle(t.titulo) ? ' is-placeholder' : ''
              const appear = state.appearIds.includes(t.id) ? ' item-appear' : ''
              return (
                <div
                  key={t.id}
                  className={`kcard${appear}${ph}`}
                  draggable
                  style={
                    state.appearIds.includes(t.id)
                      ? { animationDelay: `${Math.min(i, 12) * 0.03}s` }
                      : undefined
                  }
                  onDragStart={(e) => {
                    dragId.current = t.id
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', t.id)
                  }}
                  onClick={() => select(t.id)}
                >
                  <div className="kt">
                    {t.tipo === 'hito' ? '◆ ' : ''}
                    {t.titulo}
                  </div>
                  <div className="meta">
                    <span className="grupo-chip" style={grupoStyle(t.grupo, state.grupoColores)}>
                      {t.grupo || '—'}
                    </span>
                    <span className={`chip ${prioClass(t.prioridad)}`}>{t.prioridad}</span>
                    {prog && (
                      <span className="prog">
                        <span className="prog-bar">
                          <i
                            style={{
                              width: `${Math.round((100 * prog.done) / prog.total)}%`,
                            }}
                          />
                        </span>
                        {prog.done}/{prog.total}
                      </span>
                    )}
                  </div>
                  {(t.fecha_inicio || t.fecha_fin) && (
                    <div className={`dates${vencida ? ' vencida' : ''}`}>
                      {t.fecha_inicio || '¿?'} → {t.fecha_fin || '¿?'}
                      {vencida ? ' · vencida' : ''}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
