import { useEffect, useRef, useState } from 'react'
import { nextDocId, type DocCard } from '../../core/carriles'
import { mdToSafeHtml, renderMermaidIn } from '../../lib/markdown'
import type { EditorController } from './useEditorController'

type Mode = 'edit' | 'preview'

function DocPreview({ body }: { body: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const html = mdToSafeHtml(body || '_Sin contenido aún._')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    void renderMermaidIn(el)
  }, [html])

  return <div ref={ref} className="doc-preview md-preview" dangerouslySetInnerHTML={{ __html: html }} />
}

export function DocsList({
  docs,
  onChange,
}: {
  docs: DocCard[]
  onChange: (fn: (docs: DocCard[]) => DocCard[], key?: string) => void
}) {
  const [modes, setModes] = useState<Record<string, Mode>>({})

  const modeOf = (id: string): Mode => modes[id] || 'preview'

  const setMode = (id: string, mode: Mode) => {
    setModes((prev) => ({ ...prev, [id]: mode }))
  }

  const addDoc = () => {
    let newId = ''
    onChange((list) => {
      const next = [...list]
      newId = nextDocId(next)
      next.push({
        id: newId,
        title: 'Nueva nota del proceso',
        body:
          'Escribe en **Markdown**. Puedes pegar un diagrama:\n\n```mermaid\nflowchart LR\n  A[Inicio] --> B[Fin]\n```\n',
      })
      return next
    })
    if (newId) setMode(newId, 'edit')
  }

  const removeDoc = (id: string) => {
    onChange((list) => {
      const next = list.filter((d) => d.id !== id)
      return next
    })
  }

  const updateDoc = (id: string, patch: { title?: string; body?: string }) => {
    onChange(
      (list) => {
        const next = list.map((d) => {
          if (d.id !== id) return d
          const copy = { ...d }
          if (patch.title != null) {
            const t = patch.title.trim()
            if (t) copy.title = t.slice(0, 120)
            else delete copy.title
          }
          if (patch.body != null) copy.body = patch.body
          return copy
        })
        return next
      },
      `doc:${id}`,
    )
  }

  return (
    <section className="docs-panel" aria-label="Documentación del proceso">
      <div className="docs-head">
        <div>
          <h2>Documentación del proceso</h2>
          <p className="docs-hint">
            Notas generales en Markdown (no de un paso). Vista previa como en la Wiki, con Mermaid.
          </p>
        </div>
        <button type="button" className="primary" onClick={addDoc}>
          + Agregar nota
        </button>
      </div>

      {!docs.length && (
        <div className="docs-empty">
          <p>Todavía no hay notas del proceso. Agrega una card para explicar el flujo, reglas o un Mermaid auxiliar.</p>
          <button type="button" onClick={addDoc}>
            Crear primera nota
          </button>
        </div>
      )}

      <div className="docs-list">
        {docs.map((d) => {
          const mode = modeOf(d.id)
          return (
            <article key={d.id} className="doc-card" data-mode={mode}>
              <header className="doc-card-head">
                <input
                  className="doc-title"
                  type="text"
                  value={d.title || ''}
                  placeholder="Título de la nota"
                  aria-label="Título de la nota"
                  onChange={(e) => updateDoc(d.id, { title: e.target.value })}
                  onFocus={() => setMode(d.id, 'edit')}
                />
                <div className="doc-actions">
                  <button
                    type="button"
                    className={mode === 'edit' ? 'primary' : ''}
                    onClick={() => setMode(d.id, 'edit')}
                  >
                    Markdown
                  </button>
                  <button
                    type="button"
                    className={mode === 'preview' ? 'primary' : ''}
                    onClick={() => setMode(d.id, 'preview')}
                  >
                    Vista previa
                  </button>
                  <button type="button" className="danger" onClick={() => removeDoc(d.id)} title="Eliminar nota">
                    Eliminar
                  </button>
                </div>
              </header>
              {mode === 'edit' ? (
                <textarea
                  className="doc-editor"
                  spellCheck
                  value={d.body}
                  placeholder={'Escribe en Markdown…\n\n```mermaid\nflowchart LR\n  A --> B\n```'}
                  aria-label={`Markdown de ${d.title || d.id}`}
                  onChange={(e) => updateDoc(d.id, { body: e.target.value })}
                />
              ) : (
                <DocPreview body={d.body} />
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}

export function DocsPanel({ ctrl }: { ctrl: EditorController }) {
  const { model, mutate } = ctrl
  return (
    <DocsList
      docs={model.docs || []}
      onChange={(fn, key) => {
        mutate((m) => {
          if (!m.docs) m.docs = []
          m.docs = fn(m.docs)
          if (!m.docs.length) delete m.docs
        }, { key })
      }}
    />
  )
}
