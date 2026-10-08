import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { obtenerDiagrama } from './api/client'
import { diagramasKeys } from './api/queryClient'
import { normalize, type DiagramModel } from './core/carriles'
import { normalizeFlow, type FlowModel } from '@flow'
import { EditorPage } from './features/editor/EditorPage'
import { LibraryPage } from './features/library/LibraryPage'
import type { DiagramaTipo } from './lib/types'
import './styles/tokens.css'
import './styles/library.css'
import './styles/editor.css'

const FlowEditorPage = lazy(() => import('./features/flow-editor/FlowEditorPage'))

function parseRoute(): { view: 'library' } | { view: 'editor'; id: string } {
  const path = window.location.pathname.replace(/\/+$/, '') || '/diagramas'
  const base = '/diagramas'
  if (path === base || path === base + '/') return { view: 'library' }
  const rest = path.slice(base.length).replace(/^\//, '')
  if (rest && !rest.includes('/')) return { view: 'editor', id: rest }
  return { view: 'library' }
}

function cloneJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export default function App() {
  const [route, setRoute] = useState(parseRoute)
  const [tab, setTab] = useState<'diagram' | 'json'>('diagram')

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path)
    setRoute(parseRoute())
  }, [])

  useEffect(() => {
    const onPop = () => setRoute(parseRoute())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const editorId = route.view === 'editor' ? route.id : ''
  const diagQ = useQuery({
    queryKey: diagramasKeys.detail(editorId),
    queryFn: () => obtenerDiagrama(editorId),
    enabled: route.view === 'editor' && Boolean(editorId),
  })

  const editorParsed = useMemo(() => {
    if (!diagQ.data) return null
    const d = diagQ.data
    const tipo = (d.tipo || 'swimlane') as DiagramaTipo
    if (tipo === 'swimlane-flow') {
      const r = normalizeFlow(d.modelo)
      if (!r.ok) {
        return {
          error: `Este diagrama tiene un formato que no pudimos leer: ${r.error}. Duplica uno que funcione o pega un JSON válido.`,
        } as const
      }
      const model = cloneJson(r.modelo)
      if (!model.title) model.title = d.titulo
      return {
        id: d.id,
        tipo,
        model: model as FlowModel,
        revision: d.revision,
      } as const
    }
    const model = cloneJson(normalize(d.modelo).m)
    if (!model.title) model.title = d.titulo
    return {
      id: d.id,
      tipo: 'swimlane' as const,
      model: model as DiagramModel,
      revision: d.revision,
    } as const
  }, [diagQ.data])

  /**
   * Snapshot al abrir el editor: evita que setQueryData (tras autosave) cambie
   * initialModel/revision del padre y re-inicialice el controller.
   * La key del editor es solo el id (no revision).
   */
  const [editorBoot, setEditorBoot] = useState<
    | {
        id: string
        tipo: 'swimlane' | 'swimlane-flow'
        model: DiagramModel | FlowModel
        revision: number
      }
    | null
  >(null)

  useEffect(() => {
    if (route.view !== 'editor') {
      setEditorBoot(null)
      return
    }
    setEditorBoot(null)
  }, [editorId, route.view])

  useEffect(() => {
    if (route.view !== 'editor' || editorBoot || !editorParsed || 'error' in editorParsed) return
    setEditorBoot({
      id: editorParsed.id,
      tipo: editorParsed.tipo,
      model: editorParsed.model,
      revision: editorParsed.revision,
    })
  }, [route.view, editorBoot, editorParsed])

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

  const loadError =
    editorParsed && 'error' in editorParsed
      ? editorParsed.error
      : diagQ.error
        ? diagQ.error instanceof Error
          ? diagQ.error.message
          : 'No se pudo abrir el diagrama'
        : null

  if (!editorBoot) {
    return (
      <div className="app-shell">
        <div className="loading-center">
          {loadError || 'Abriendo diagrama…'}
          {loadError && (
            <p style={{ marginTop: 16 }}>
              <button type="button" className="primary" onClick={() => navigate('/diagramas')}>
                Volver
              </button>
            </p>
          )}
        </div>
      </div>
    )
  }

  if (editorBoot.tipo === 'swimlane-flow') {
    return (
      <div className="app-shell">
        <Suspense fallback={<div className="loading-center">Abriendo diagrama…</div>}>
          <FlowEditorPage
            key={editorBoot.id}
            diagramId={editorBoot.id}
            initialModel={editorBoot.model as FlowModel}
            initialRevision={editorBoot.revision}
            onBack={() => navigate('/diagramas')}
            onOpenDiagram={(id) => navigate('/diagramas/' + id)}
          />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <EditorPage
        key={editorBoot.id}
        diagramId={editorBoot.id}
        initialModel={editorBoot.model as DiagramModel}
        initialRevision={editorBoot.revision}
        tab={tab}
        setTab={setTab}
      />
    </div>
  )
}
