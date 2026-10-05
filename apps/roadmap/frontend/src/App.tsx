import { useEffect } from 'react'
import { exportCsv, logout } from './api/tareas'
import { Banner, HelpModal, Toast } from './components/Chrome'
import { CronoView } from './components/CronoView'
import { FiltersBar } from './components/FiltersBar'
import { GroupColorPicker } from './components/GroupColorPicker'
import { KanbanView } from './components/KanbanView'
import { TablaView } from './components/TablaView'
import { TaskDrawer } from './components/TaskDrawer'
import type { View } from './lib/types'
import { RoadmapProvider, useRoadmap } from './state/RoadmapStore'
import './styles/app.css'

function Shell() {
  const { state, setView, crearTarea, setUi, select, seedPlaceholders } = useRoadmap()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const typing =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (e.target as HTMLElement)?.isContentEditable
      if (typing) return

      if (e.key === 'Escape') {
        if (state.colorPickerGrupo) {
          setUi({ colorPickerGrupo: null, colorPickerAnchor: null })
          return
        }
        if (state.helpOpen) {
          setUi({ helpOpen: false })
          return
        }
        select(null)
        return
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        crearTarea()
        return
      }
      if (e.key === '/') {
        e.preventDefault()
        document.getElementById('search')?.focus()
        return
      }
      if (e.key === '1') setView('tabla')
      if (e.key === '2') setView('cronograma')
      if (e.key === '3') setView('kanban')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state.colorPickerGrupo, state.helpOpen, setUi, select, crearTarea, setView])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!state.colorPickerGrupo) return
      const pop = document.querySelector('.grupo-color-popover')
      if (pop && !pop.contains(e.target as Node)) {
        setUi({ colorPickerGrupo: null, colorPickerAnchor: null })
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [state.colorPickerGrupo, setUi])

  const saveClass =
    state.saveStatus === 'ok'
      ? 'ok'
      : state.saveStatus === 'saving'
        ? 'saving'
        : state.saveStatus === 'error' ||
            state.saveStatus === 'conflict' ||
            state.saveStatus === 'offline'
          ? 'error'
          : ''

  const tabs: { id: View; label: string; tip: string }[] = [
    { id: 'tabla', label: 'Tabla', tip: 'Atajo: 1' },
    { id: 'cronograma', label: 'Cronograma', tip: 'Atajo: 2' },
    { id: 'kanban', label: 'Kanban', tip: 'Atajo: 3' },
  ]

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <a className="home-link" href="/" title="Volver a Apps" aria-label="Volver a Apps">
            <span className="mark" aria-hidden="true" />
          </a>
          <h1>Roadmap</h1>
          <span className="tag">TuBroki</span>
        </div>
        <nav className="tabs" role="tablist" aria-label="Vistas">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab${state.view === t.id ? ' active' : ''}`}
              role="tab"
              title={t.tip}
              aria-selected={state.view === t.id}
              onClick={() => setView(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <span className={`save-ind ${saveClass}`} title="Estado del guardado automático">
            {state.saveMsg}
          </span>
          <button
            className="btn btn-sm"
            type="button"
            title="Crear un hito (fecha única en el cronograma)"
            onClick={() => crearTarea({ tipo: 'hito' })}
          >
            + Hito
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            title="Nueva tarea (atajo N)"
            onClick={() => crearTarea()}
          >
            + Tarea
          </button>
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            title="Descargar una copia en CSV (Numbers / Excel)"
            onClick={() => void exportCsv().catch(() => setUi({ toast: { message: 'No se pudo exportar' } }))}
          >
            CSV
          </button>
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            title="Ayuda y atajos"
            onClick={() => setUi({ helpOpen: true })}
          >
            ?
          </button>
          <button
            className="btn btn-sm btn-ghost"
            type="button"
            title="Cerrar sesión en este navegador"
            onClick={() => void logout()}
          >
            Salir
          </button>
        </div>
      </header>

      <Banner />
      <FiltersBar />

      <main className="main">
        {state.loading ? (
          <p className="muted" style={{ padding: 24 }}>
            Cargando tablero…
          </p>
        ) : state.view === 'tabla' ? (
          <TablaView />
        ) : state.view === 'cronograma' ? (
          <CronoView />
        ) : (
          <KanbanView />
        )}
      </main>

      <TaskDrawer />
      <GroupColorPicker />
      <HelpModal />
      <Toast />

      {import.meta.env.DEV && (
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          style={{ position: 'fixed', bottom: 8, right: 8, opacity: 0.4, zIndex: 100 }}
          title="Reset placeholders (dev)"
          onClick={() => seedPlaceholders()}
        >
          seed
        </button>
      )}
    </>
  )
}

export default function App() {
  return (
    <RoadmapProvider>
      <Shell />
    </RoadmapProvider>
  )
}
