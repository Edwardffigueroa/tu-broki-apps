import { useMemo, useRef, useState } from 'react'
import {
  PLACEHOLDER_TITULO,
  TITULO_W_KEY,
  TITULO_W_MAX,
  TITULO_W_MIN,
  ESTADOS,
  PRIORIDADES,
} from '../lib/constants'
import type { Estado, Prioridad, Task } from '../lib/types'
import {
  colorDeGrupo,
  estadoClass,
  filteredPadres,
  hijos,
  isPlaceholderTitle,
  prioClass,
} from '../lib/utils'
import { useRoadmap } from '../state/RoadmapStore'

function groupTasks(list: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>()
  for (const t of list) {
    const g = t.grupo || 'Sin grupo'
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(t)
  }
  return map
}

export function TablaView() {
  const {
    state,
    updateTask,
    select,
    toggleExpand,
    toggleCollapseGroup,
    addSubtarea,
    renameGrupo,
    setUi,
    crearTarea,
    reorderPadres,
  } = useRoadmap()

  const list = useMemo(
    () => filteredPadres(state.tareas, state.search, state.filtroEstado, state.filtroGrupos),
    [state.tareas, state.search, state.filtroEstado, state.filtroGrupos],
  )
  const groups = useMemo(() => groupTasks(list), [list])
  const [newGroupName, setNewGroupName] = useState('')
  const dragId = useRef<string | null>(null)
  const [dropHint, setDropHint] = useState<{ id: string; before: boolean } | null>(null)
  const justReordered = useRef(false)

  const onTituloResize = (e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = state.tablaTituloW
    const target = e.currentTarget as HTMLElement
    target.classList.add('is-active')
    document.body.classList.add('titulo-resizing')
    target.setPointerCapture(e.pointerId)
    let last = startW
    const onMove = (ev: PointerEvent) => {
      last = Math.min(TITULO_W_MAX, Math.max(TITULO_W_MIN, startW + (ev.clientX - startX)))
      setUi({ tablaTituloW: last })
      document.documentElement.style.setProperty('--titulo-w', `${last}px`)
    }
    const onUp = () => {
      target.classList.remove('is-active')
      document.body.classList.remove('titulo-resizing')
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      try {
        localStorage.setItem(TITULO_W_KEY, String(last))
      } catch {
        /* */
      }
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
  }

  const createNewGroup = () => {
    const name = newGroupName.trim()
    if (!name) return
    crearTarea({ grupo: name, titulo: PLACEHOLDER_TITULO })
    setNewGroupName('')
  }

  return (
    <>
      <div className="table-wrap" style={{ ['--titulo-w' as string]: `${state.tablaTituloW}px` }}>
        {state.showHint && (
          <div className="hint-banner">
            <div>
              <strong>Tip rápido</strong>
              <p>
                Haz clic en una fila para abrir el panel. Arrastra ⠿ para reordenar. Escribe en las
                celdas para editar.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                try {
                  localStorage.setItem('tubroki_roadmap_hint_v1', '1')
                } catch {
                  /* */
                }
                setUi({ showHint: false })
              }}
            >
              Entendido
            </button>
          </div>
        )}
        <table className="tbl">
          <thead>
            <tr>
              <th className="th-title">
                Título
                <div
                  className="th-title-resizer"
                  onPointerDown={onTituloResize}
                  title="Arrastra para cambiar el ancho"
                />
              </th>
              <th>Responsable</th>
              <th>Estado</th>
              <th># Est.</th>
              <th>Prioridad</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Subtareas</th>
            </tr>
          </thead>
          <tbody>
            {groups.size === 0 && (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--ink-faint)' }}>
                  Ninguna tarea coincide con el filtro.
                </td>
              </tr>
            )}
            {[...groups.entries()].map(([grupo, tasks]) => {
              const collapsed = state.collapsedGroups.includes(grupo)
              const c = colorDeGrupo(grupo, state.grupoColores)
              return (
                <GroupBlock
                  key={grupo}
                  grupo={grupo}
                  tasks={tasks}
                  collapsed={collapsed}
                  color={c}
                  state={state}
                  dropHint={dropHint}
                  dragIdRef={dragId}
                  justReordered={justReordered}
                  onCollapse={() => toggleCollapseGroup(grupo)}
                  onColorClick={(el) => {
                    const r = el.getBoundingClientRect()
                    setUi({
                      colorPickerGrupo: grupo,
                      colorPickerAnchor: { top: r.bottom + 6, left: r.left },
                    })
                  }}
                  onRename={(n) => renameGrupo(grupo, n)}
                  onSelect={select}
                  onUpdate={updateTask}
                  onToggleExpand={toggleExpand}
                  onAddSub={addSubtarea}
                  onAddInGroup={() => crearTarea({ grupo })}
                  onDropHint={setDropHint}
                  onReorder={(src, tgt, before) => {
                    justReordered.current = true
                    reorderPadres(src, tgt, before)
                    setDropHint(null)
                    dragId.current = null
                  }}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="new-group-bar">
        <input
          className="search-box"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') createNewGroup()
          }}
          placeholder="Nombre del nuevo grupo…"
          style={{ minWidth: 200 }}
        />
        <button type="button" className="btn btn-sm" onClick={createNewGroup}>
          + Nuevo grupo
        </button>
        <span className="hint-tip">Crea el grupo y te abre una tarea placeholder dentro.</span>
      </div>
    </>
  )
}

function GroupBlock({
  grupo,
  tasks,
  collapsed,
  color,
  state,
  dropHint,
  dragIdRef,
  justReordered,
  onCollapse,
  onColorClick,
  onRename,
  onSelect,
  onUpdate,
  onToggleExpand,
  onAddSub,
  onAddInGroup,
  onDropHint,
  onReorder,
}: {
  grupo: string
  tasks: Task[]
  collapsed: boolean
  color: { swatch: string; bg: string; fg: string; border: string }
  state: ReturnType<typeof useRoadmap>['state']
  dropHint: { id: string; before: boolean } | null
  dragIdRef: React.MutableRefObject<string | null>
  justReordered: React.MutableRefObject<boolean>
  onCollapse: () => void
  onColorClick: (el: HTMLElement) => void
  onRename: (n: string) => void
  onSelect: (id: string) => void
  onUpdate: (id: string, p: Partial<Task>) => void
  onToggleExpand: (id: string) => void
  onAddSub: (id: string) => void
  onAddInGroup: () => void
  onDropHint: (h: { id: string; before: boolean } | null) => void
  onReorder: (src: string, tgt: string, before: boolean) => void
}) {
  return (
    <>
      <tr className="group-header">
        <td colSpan={8}>
          <div className="gh">
            <button
              type="button"
              className={`collapse-btn${collapsed ? '' : ' is-open'}`}
              onClick={onCollapse}
              title="Colapsar / expandir"
              aria-label={collapsed ? 'Expandir grupo' : 'Colapsar grupo'}
            >
              {collapsed ? '▶' : '▼'}
            </button>
            <button
              type="button"
              className="grupo-color-btn"
              title="Cambiar color"
              style={{ background: color.swatch }}
              onClick={(e) => onColorClick(e.currentTarget)}
            />
            <GrupoRename
              nombre={grupo}
              onRename={onRename}
              style={{
                background: color.bg,
                color: color.fg,
                borderColor: color.border,
              }}
            />
            <span className="count">
              {tasks.length} tarea{tasks.length === 1 ? '' : 's'}
            </span>
          </div>
        </td>
      </tr>
      {!collapsed &&
        tasks.flatMap((t) => {
          const kids = hijos(state.tareas, t.id)
          const expanded = state.expandedTasks.includes(t.id)
          const rows = [
            <TaskRow
              key={t.id}
              t={t}
              isSub={false}
              appear={state.appearIds.includes(t.id)}
              selected={state.selectedId === t.id}
              kids={kids}
              expanded={expanded}
              dropClass={
                dropHint?.id === t.id
                  ? dropHint.before
                    ? ' drop-before'
                    : ' drop-after'
                  : ''
              }
              onSelect={() => {
                if (justReordered.current) {
                  justReordered.current = false
                  return
                }
                onSelect(t.id)
              }}
              onUpdate={(p) => onUpdate(t.id, p)}
              onToggleExpand={() => onToggleExpand(t.id)}
              onAddSub={() => onAddSub(t.id)}
              onDragStart={() => {
                dragIdRef.current = t.id
              }}
              onDragOver={(before) => onDropHint({ id: t.id, before })}
              onDragLeave={() => onDropHint(null)}
              onDrop={() => {
                const src = dragIdRef.current
                if (src && dropHint) onReorder(src, dropHint.id, dropHint.before)
                else onDropHint(null)
              }}
              onDragEnd={() => {
                dragIdRef.current = null
                onDropHint(null)
              }}
            />,
          ]
          if (expanded) {
            for (const k of kids) {
              rows.push(
                <TaskRow
                  key={k.id}
                  t={k}
                  isSub
                  appear={state.appearIds.includes(k.id)}
                  selected={state.selectedId === k.id}
                  kids={[]}
                  expanded={false}
                  dropClass=""
                  onSelect={() => onSelect(k.id)}
                  onUpdate={(p) => onUpdate(k.id, p)}
                  onToggleExpand={() => {}}
                  onAddSub={() => {}}
                />,
              )
            }
          }
          return rows
        })}
      {!collapsed && (
        <tr className="add-row">
          <td colSpan={8}>
            <button type="button" className="add-link" onClick={onAddInGroup}>
              + Añadir tarea en {grupo}
            </button>
          </td>
        </tr>
      )}
    </>
  )
}

function GrupoRename({
  nombre,
  onRename,
  style,
}: {
  nombre: string
  onRename: (n: string) => void
  style?: React.CSSProperties
}) {
  const [val, setVal] = useState(nombre)
  return (
    <input
      className="group-name-input"
      style={style}
      value={val}
      title="Haz clic para renombrar el grupo"
      aria-label="Nombre del grupo"
      onChange={(e) => setVal(e.target.value)}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => {
        if (val.trim() && val.trim() !== nombre) onRename(val.trim())
        else setVal(nombre)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setVal(nombre)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
    />
  )
}

function TaskRow({
  t,
  isSub,
  appear,
  selected,
  kids,
  expanded,
  dropClass,
  onSelect,
  onUpdate,
  onToggleExpand,
  onAddSub,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  t: Task
  isSub: boolean
  appear: boolean
  selected: boolean
  kids: Task[]
  expanded: boolean
  dropClass: string
  onSelect: () => void
  onUpdate: (p: Partial<Task>) => void
  onToggleExpand: () => void
  onAddSub: () => void
  onDragStart?: () => void
  onDragOver?: (before: boolean) => void
  onDragLeave?: () => void
  onDrop?: () => void
  onDragEnd?: () => void
}) {
  const progLocal =
    kids.length > 0
      ? { done: kids.filter((k) => k.estado === 'Hecha').length, total: kids.length }
      : null
  const ph = isPlaceholderTitle(t.titulo)
  const isHito = t.tipo === 'hito'
  const canReorder = !isSub

  return (
    <tr
      className={`task-row${isSub ? ' sub-row' : ''}${selected ? ' selected' : ''}${ph ? ' is-placeholder' : ''}${appear ? ' row-appear' : ''}${dropClass}`}
      draggable={canReorder}
      onDragStart={(e) => {
        if (!canReorder) return
        onDragStart?.()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', t.id)
        ;(e.currentTarget as HTMLElement).classList.add('dragging')
      }}
      onDragEnd={(e) => {
        ;(e.currentTarget as HTMLElement).classList.remove('dragging')
        onDragEnd?.()
      }}
      onDragOver={(e) => {
        if (!canReorder || !onDragOver) return
        e.preventDefault()
        const before = e.nativeEvent.offsetY < (e.currentTarget as HTMLElement).offsetHeight / 2
        onDragOver(before)
      }}
      onDragLeave={() => onDragLeave?.()}
      onDrop={(e) => {
        e.preventDefault()
        onDrop?.()
      }}
      onClick={(e) => {
        const tag = (e.target as HTMLElement).tagName
        if (['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA'].includes(tag)) return
        if ((e.target as HTMLElement).closest('.row-drag')) return
        onSelect()
      }}
    >
      <td>
        <div className="cell-title">
          {canReorder && (
            <span className="row-drag" title="Arrastra para reordenar" aria-hidden="true">
              ⠿
            </span>
          )}
          {!isSub && !isHito && kids.length > 0 ? (
            <button
              type="button"
              className="expand"
              onClick={(e) => {
                e.stopPropagation()
                onToggleExpand()
              }}
              title={expanded ? 'Ocultar subtareas' : 'Ver subtareas'}
              aria-expanded={expanded}
            >
              {expanded ? '▼' : '▶'}
            </button>
          ) : (
            !isSub && <span className="expand-spacer" aria-hidden="true" />
          )}
          {isHito && (
            <span
              className="chip"
              style={{
                background: 'var(--brand-soft)',
                color: 'var(--brand)',
                borderColor: 'var(--brand-border)',
              }}
              title="Hito"
            >
              ◆
            </span>
          )}
          <input
            className="title-input"
            value={t.titulo}
            placeholder={PLACEHOLDER_TITULO}
            onChange={(e) => onUpdate({ titulo: e.target.value })}
            onFocus={(e) => {
              if (isPlaceholderTitle(e.target.value)) e.target.select()
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                ;(e.target as HTMLInputElement).blur()
              }
            }}
          />
        </div>
      </td>
      <td>
        <input
          className="cell-inline"
          value={t.responsable}
          placeholder="—"
          style={{ maxWidth: 120 }}
          onChange={(e) => onUpdate({ responsable: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td>
        <select
          className={`cell-select ${estadoClass(t.estado)}`}
          value={t.estado}
          onChange={(e) => onUpdate({ estado: e.target.value as Estado })}
          onClick={(e) => e.stopPropagation()}
        >
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          className="cell-inline"
          type="number"
          min={0}
          step={0.5}
          style={{ maxWidth: 64 }}
          value={t.estimacion_dias === '' ? '' : t.estimacion_dias}
          disabled={isHito}
          onChange={(e) =>
            onUpdate({
              estimacion_dias: e.target.value === '' ? '' : Number(e.target.value),
            })
          }
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td>
        <select
          className={`cell-select ${prioClass(t.prioridad)}`}
          value={t.prioridad}
          onChange={(e) => onUpdate({ prioridad: e.target.value as Prioridad })}
          onClick={(e) => e.stopPropagation()}
        >
          {PRIORIDADES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input
          className="cell-date"
          type="date"
          value={t.fecha_inicio}
          onChange={(e) => onUpdate({ fecha_inicio: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td>
        <input
          className="cell-date"
          type="date"
          value={t.fecha_fin}
          disabled={isHito}
          title={isHito ? 'Los hitos usan solo la fecha de inicio' : undefined}
          onChange={(e) => onUpdate({ fecha_fin: e.target.value })}
          onClick={(e) => e.stopPropagation()}
        />
      </td>
      <td>
        {progLocal ? (
          <span className="prog" title={`${progLocal.done}/${progLocal.total}`}>
            <span className="prog-bar">
              <i style={{ width: `${Math.round((100 * progLocal.done) / progLocal.total)}%` }} />
            </span>
            {progLocal.done}/{progLocal.total}
          </span>
        ) : isSub || isHito ? null : (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            title="Añadir subtarea"
            onClick={(e) => {
              e.stopPropagation()
              onAddSub()
            }}
          >
            + sub
          </button>
        )}
      </td>
    </tr>
  )
}
