import { ESTADOS } from '../lib/constants'
import { colorDeGrupo, gruposExistentes } from '../lib/utils'
import { useRoadmap } from '../state/RoadmapStore'

export function FiltersBar() {
  const { state, setUi } = useRoadmap()
  const grupos = gruposExistentes(state.tareas)
  const disponibles = grupos.filter((g) => !state.filtroGrupos.includes(g))

  return (
    <div className="filters-bar" aria-label="Buscar y filtrar">
      <input
        className="search-box"
        id="search"
        type="search"
        placeholder="Buscar…  (/)"
        title="Buscar por título, descripción o responsable"
        value={state.search}
        onChange={(e) => setUi({ search: e.target.value })}
      />
      <select
        className="filter-select"
        title="Filtrar por estado"
        value={state.filtroEstado}
        onChange={(e) => setUi({ filtroEstado: e.target.value })}
      >
        <option value="">Todos los estados</option>
        {ESTADOS.map((e) => (
          <option key={e} value={e}>
            {e}
          </option>
        ))}
      </select>
      <div className="grupo-multi">
        <div className="grupo-chips">
          {state.filtroGrupos.map((g) => {
            const c = colorDeGrupo(g, state.grupoColores)
            return (
              <button
                key={g}
                type="button"
                className="filter-chip"
                style={{ background: c.bg, color: c.fg, borderColor: c.border }}
                onClick={() =>
                  setUi({ filtroGrupos: state.filtroGrupos.filter((x) => x !== g) })
                }
              >
                <span className="chip-label">{g}</span>
                <span className="chip-x">×</span>
              </button>
            )
          })}
        </div>
        <select
          className="filter-select"
          title="Añadir un grupo al filtro. Solo aparecen los que ya tienes en el tablero."
          value=""
          onChange={(e) => {
            const v = e.target.value
            if (!v) return
            if (!state.filtroGrupos.includes(v)) {
              setUi({ filtroGrupos: [...state.filtroGrupos, v] })
            }
          }}
        >
          <option value="">+ Filtrar grupo…</option>
          {disponibles.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
