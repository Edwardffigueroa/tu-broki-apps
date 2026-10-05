import { GRUPO_PALETTE } from '../lib/constants'
import { colorDeGrupo } from '../lib/utils'
import { useRoadmap } from '../state/RoadmapStore'

export function GroupColorPicker() {
  const { state, setColorGrupo } = useRoadmap()
  if (!state.colorPickerGrupo || !state.colorPickerAnchor) return null
  const grupo = state.colorPickerGrupo
  const actual = colorDeGrupo(grupo, state.grupoColores)
  const manual = !!state.grupoColores[grupo]

  return (
    <div
      className="grupo-color-popover show"
      role="dialog"
      aria-label="Elegir color del grupo"
      style={{
        top: state.colorPickerAnchor.top,
        left: state.colorPickerAnchor.left,
      }}
    >
      <p className="gct">Color del grupo</p>
      <div className="grupo-color-swatches">
        {GRUPO_PALETTE.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.nombre}
            className={`grupo-color-swatch${manual && actual.id === p.id ? ' is-active' : ''}`}
            style={{ background: p.swatch }}
            onClick={() => setColorGrupo(grupo, p.id)}
          />
        ))}
      </div>
      <button
        type="button"
        className="btn btn-sm btn-ghost gct-auto"
        onClick={() => setColorGrupo(grupo, null)}
      >
        Automático
      </button>
    </div>
  )
}
