import { useCallback, useEffect, useState } from 'react'
import { AuthError, irAAcceso, obtenerDiagrama } from './api/client'
import { normalize, type DiagramModel } from './core/carriles'
import { EditorPage } from './features/editor/EditorPage'
import { LibraryPage } from './features/library/LibraryPage'
import './styles/tokens.css'
import './styles/library.css'
import './styles/editor.css'

function parseRoute(): { view: 'library' } | { view: 'editor'; id: string } {
  const path = window.location.pathname.replace(/\/+$/, '') || '/diagramas'
  const base = '/diagramas'
  if (path === base || path === base + '/') return { view: 'library' }
  const rest = path.slice(base.length).replace(/^\//, '')
  if (rest && !rest.includes('/')) return { view: 'editor', id: rest }
  return { view: 'library' }
}

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  const [tab, setTab] = useState<'diagram' | 'json'>('diagram')
  const [editorData, setEditorData] = useState<{
    id: string
    model: DiagramModel
    revision: number
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path)
    setRoute(parseRoute())
  }, [])

  useEffect(() => {
    const onPop = () => setRoute(parseRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (route.view !== 'editor') {
      setEditorData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const d = await obtenerDiagrama(route.id)
        if (cancelled) return
        const m = normalize(d.modelo).m
        if (!m.title) m.title = d.titulo
        setEditorData({ id: d.id, model: m, revision: d.revision })
      } catch (e) {
        if (cancelled) return
        if (e instanceof AuthError) {
          irAAcceso()
          return
        }
        setError(e instanceof Error ? e.message : 'No se pudo abrir el diagrama')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [route])

  if (route.view === 'library') {
    return (
      <div className="app-shell">
        <LibraryPage
          onOpen={(id) => {
            navigate('/diagramas/' + id)
          }}
        />
      </div>
    )
  }

  if (loading || !editorData) {
    return (
      <div className="app-shell">
        <div className="loading-center">{error || 'Abriendo diagrama…'}</div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <EditorPage
        key={editorData.id + ':' + editorData.revision}
        diagramId={editorData.id}
        initialModel={editorData.model}
        initialRevision={editorData.revision}
        tab={tab}
        setTab={setTab}
      />
    </div>
  )
}
