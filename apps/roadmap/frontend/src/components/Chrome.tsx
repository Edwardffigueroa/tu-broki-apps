import { useRoadmap } from '../state/RoadmapStore'

export function Banner() {
  const { state, load, scheduleSave, setUi } = useRoadmap()
  if (!state.banner.kind) return null

  return (
    <div className={`banner show ${state.banner.kind}`} role="status">
      <span>
        <strong>
          {state.banner.kind === 'err' ? '' : ''}
        </strong>
        {state.banner.message}
      </span>
      {state.banner.action && (
        <button
          className="btn btn-sm"
          type="button"
          onClick={() => {
            if (state.banner.action === 'retry-load') void load()
            else if (state.banner.action === 'retry-save') scheduleSave(true)
            else if (state.banner.action === 'reload') {
              void load().then(() => setUi({ banner: { kind: '', message: '' } }))
            }
          }}
        >
          {state.banner.actionLabel || 'Reintentar'}
        </button>
      )}
    </div>
  )
}

export function Toast() {
  const { state, setUi } = useRoadmap()
  if (!state.toast) return null
  return (
    <div className="toast show">
      <span>{state.toast.message}</span>
      {state.toast.undo && (
        <button
          type="button"
          onClick={() => {
            state.toast?.undo?.()
            setUi({ toast: null })
          }}
        >
          Deshacer
        </button>
      )}
    </div>
  )
}

export function HelpModal() {
  const { state, setUi } = useRoadmap()
  if (!state.helpOpen) return null
  return (
    <div className="modal-backdrop show" role="dialog" aria-modal="true" aria-labelledby="helpTitle">
      <div className="modal">
        <h2 id="helpTitle">Cómo usar este tablero</h2>
        <p>
          Es tu roadmap interno de TuBroki. Las tres pestañas miran los <strong>mismos datos</strong>:
          editas en una y se refleja en las otras.
        </p>
        <ul>
          <li>
            <strong>Tabla</strong> — lista agrupada. Ideal para crear tareas, subtareas y editar campos
            rápido.
          </li>
          <li>
            <strong>Cronograma</strong> — línea de tiempo. Arrastra las barras para cambiar fechas; tira
            de los extremos para alargar o acortar.
          </li>
          <li>
            <strong>Kanban</strong> — columnas por estado. Arrastra la tarjeta a otra columna para
            cambiar el estado.
          </li>
        </ul>
        <p>
          <strong>Atajos</strong>
        </p>
        <ul>
          <li>
            <kbd>N</kbd> nueva tarea · <kbd>/</kbd> buscar · <kbd>Esc</kbd> cerrar panel · <kbd>1</kbd>{' '}
            <kbd>2</kbd> <kbd>3</kbd> cambiar vista
          </li>
        </ul>
        <div className="close-row">
          <button className="btn btn-primary" type="button" onClick={() => setUi({ helpOpen: false })}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
