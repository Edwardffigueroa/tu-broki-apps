import { useEffect, useRef, useState } from 'react'
import { BASE } from '../../lib/constants'
import { buildAiPrompt, toNarrative, TYPE_ORDER, TYPES, type NodeType } from '../../core/carriles'
import type { SaveStatus } from '../../lib/types'
import { CanvasSvg, typeIcon } from './CanvasSvg'
import { DocsPanel } from './DocsPanel'
import { Inspector } from './Inspector'
import { useEditorController } from './useEditorController'
import type { DiagramModel } from '../../core/carriles'

const LS_JSON = 'diagramas.panel.json'
const LS_INSP = 'diagramas.panel.inspector'

function readPanelPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* ignore */
  }
  return fallback
}

function writePanelPref(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

function BrandMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="3" width="21" height="8" rx="2" fill="var(--lh0)" stroke="var(--ink)" strokeWidth="1.4" />
      <rect x="1.5" y="13" width="21" height="8" rx="2" fill="var(--lh2)" stroke="var(--ink)" strokeWidth="1.4" />
      <circle cx="7" cy="7" r="2" fill="var(--accent)" />
      <path d="M9 7h6.5a1.5 1.5 0 0 1 1.5 1.5V15" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <rect x="14" y="15" width="6" height="4" rx="1" fill="var(--accent)" />
    </svg>
  )
}

function saveLabel(s: SaveStatus): string {
  switch (s) {
    case 'dirty':
      return 'Sin guardar'
    case 'saving':
      return 'Guardando…'
    case 'saved':
      return 'Guardado'
    case 'error':
      return 'Error al guardar'
    case 'conflict':
      return 'Conflicto'
    default:
      return ''
  }
}

async function copyText(text: string, okMsg: string, toast: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(text)
    toast(okMsg)
  } catch {
    toast('No se pudo copiar. Selecciona el texto y usa Ctrl+C.')
  }
}

export function EditorPage({
  diagramId,
  initialModel,
  initialRevision,
  tab,
  setTab,
}: {
  diagramId: string
  initialModel: DiagramModel
  initialRevision: number
  tab: 'diagram' | 'json'
  setTab: (t: 'diagram' | 'json') => void
}) {
  const ctrl = useEditorController(diagramId, initialModel, initialRevision)
  const stageRef = useRef<HTMLDivElement>(null)
  const [showJson, setShowJson] = useState(() => readPanelPref(LS_JSON, true))
  const [showInspector, setShowInspector] = useState(() => readPanelPref(LS_INSP, true))
  const {
    model,
    sel,
    zoom,
    setZoom,
    jsonText,
    jsonStatus,
    saveStatus,
    toast,
    showToast,
    canUndo,
    canRedo,
    undo,
    redo,
    addNode,
    addLane,
    reorder,
    loadExample,
    onJsonChange,
    formatJson,
    setJsonFocused,
    setTitle,
    deleteSel,
    select,
  } = ctrl

  const toggleJson = () => {
    setShowJson((v) => {
      const next = !v
      writePanelPref(LS_JSON, next)
      return next
    })
  }
  const toggleInspector = () => {
    setShowInspector((v) => {
      const next = !v
      writePanelPref(LS_INSP, next)
      return next
    })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = ((e.target as HTMLElement)?.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select'
      const mod = e.ctrlKey || e.metaKey
      const k = (e.key || '').toLowerCase()
      if (mod && !typing && k === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && !typing && k === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && !typing && k === 's') {
        e.preventDefault()
        void ctrl.persistNow()
        return
      }
      if (typing) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault()
        deleteSel()
      } else if (e.key === 'Escape' && sel) {
        select(null)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [ctrl, deleteSel, redo, sel, select, undo])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    requestAnimationFrame(() => {
      const avail = stage.clientWidth - 34
      const W = Math.max(1, (ctrl.L.maxCol + 2) * 176 + 116)
      if (avail > 0) setZoom(Math.min(1, Math.max(0.3, avail / W)))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="editor" data-tab={tab}>
      <header className="top">
        <a className="brand" href={BASE + '/'} title="Volver a la biblioteca">
          <BrandMark />
          <span>Diagramas</span>
        </a>
        <input
          className="title-input"
          type="text"
          placeholder="Título del diagrama"
          aria-label="Título del diagrama"
          value={model.title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
        />
        <div className="actions">
          <span className={'save-pill ' + saveStatus}>{saveLabel(saveStatus)}</span>
          <button type="button" disabled={!canUndo} onClick={undo} title="Deshacer (Ctrl+Z)">
            Deshacer
          </button>
          <button type="button" disabled={!canRedo} onClick={redo} title="Rehacer (Ctrl+Y)">
            Rehacer
          </button>
          <select
            className="hide-narrow"
            aria-label="Cargar un ejemplo"
            defaultValue=""
            onChange={(e) => {
              const k = e.target.value
              e.target.value = ''
              if (k) loadExample(k)
            }}
          >
            <option value="">Ejemplos…</option>
            <option value="arriendo">Arriendo con TuBroki (no lineal)</option>
            <option value="pedido">Pedido en línea</option>
            <option value="gastos">Aprobación de gastos</option>
            <option value="vacio">Diagrama vacío</option>
          </select>
          <button
            type="button"
            className="primary"
            title="Copia instrucciones para que una IA escriba el JSON"
            onClick={() => void copyText(buildAiPrompt(), 'Prompt copiado. Pégalo en tu IA y describe el proceso.', showToast)}
          >
            Prompt para IA
          </button>
        </div>
      </header>

      <div
        className={'main' + (sel ? ' has-sel' : '')}
        data-json={showJson ? 'on' : 'off'}
        data-insp={showInspector ? 'on' : 'off'}
      >
        <section className="json-panel" aria-label="Editor de JSON" hidden={!showJson}>
          <div className="panel-head">
            <h2>JSON</h2>
            <div>
              <button type="button" onClick={formatJson}>Formatear</button>
              <button type="button" onClick={() => void copyText(jsonText, 'JSON copiado', showToast)}>
                Copiar JSON
              </button>
              <button
                type="button"
                title="Copia una descripción en texto: actores, pasos y conexiones"
                onClick={() => void copyText(toNarrative(model), 'Texto copiado. Listo para pegar en una IA.', showToast)}
              >
                Copiar texto
              </button>
              <button
                type="button"
                className="panel-hide"
                title="Ocultar panel JSON"
                aria-label="Ocultar panel JSON"
                onClick={toggleJson}
              >
                «
              </button>
            </div>
          </div>
          <textarea
            className="json-area"
            spellCheck={false}
            aria-label="Código JSON del diagrama"
            value={jsonText}
            onChange={(e) => onJsonChange(e.target.value)}
            onFocus={() => setJsonFocused(true)}
            onBlur={() => setJsonFocused(false)}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey) {
                e.preventDefault()
                const ta = e.currentTarget
                const start = ta.selectionStart
                const end = ta.selectionEnd
                const next = ta.value.slice(0, start) + '  ' + ta.value.slice(end)
                onJsonChange(next)
                requestAnimationFrame(() => {
                  ta.selectionStart = ta.selectionEnd = start + 2
                })
              }
            }}
          />
          <div className={'status ' + jsonStatus.kind} role="status">
            {jsonStatus.msg}
          </div>
        </section>

        <section className="stage-col" aria-label="Lienzo">
          <div className="toolbar">
            <button
              type="button"
              className={'tbtn panel-toggle' + (showJson ? ' on' : '')}
              aria-pressed={showJson}
              title={showJson ? 'Ocultar JSON' : 'Mostrar JSON'}
              onClick={toggleJson}
            >
              <span>JSON</span>
            </button>
            <button
              type="button"
              className={'tbtn panel-toggle' + (showInspector ? ' on' : '')}
              aria-pressed={showInspector}
              title={showInspector ? 'Ocultar propiedades' : 'Mostrar propiedades'}
              onClick={toggleInspector}
            >
              <span>Propiedades</span>
            </button>
            <span className="sep" />
            {TYPE_ORDER.map((t) => (
              <button
                key={t}
                type="button"
                className="tbtn"
                title={'Agregar ' + TYPES[t].name.toLowerCase()}
                onClick={() => addNode(t as NodeType)}
              >
                {typeIcon(t)}
                <span>{TYPES[t].name}</span>
              </button>
            ))}
            <span className="sep" />
            <button type="button" className="tbtn" onClick={addLane}>
              <span>+ Carril</span>
            </button>
            <button type="button" className="tbtn" title="Recalcula las columnas" onClick={reorder}>
              <span>Ordenar pasos</span>
            </button>
            <span className="sep grow" style={{ background: 'none' }} />
            <button type="button" className="tbtn" aria-label="Alejar" onClick={() => setZoom(zoom / 1.15)}>−</button>
            <span className="zl">{Math.round(zoom * 100)}%</span>
            <button type="button" className="tbtn" aria-label="Acercar" onClick={() => setZoom(zoom * 1.15)}>+</button>
            <button
              type="button"
              className="tbtn"
              onClick={() => {
                const stage = stageRef.current
                if (!stage) return
                const avail = stage.clientWidth - 34
                const W = Math.max(1, (ctrl.L.maxCol + 2) * 176 + 116)
                setZoom(avail > 0 ? Math.min(1, Math.max(0.3, avail / W)) : 1)
              }}
            >
              <span>Ajustar</span>
            </button>
          </div>
          <div className="stage" ref={stageRef}>
            <CanvasSvg ctrl={ctrl} stageRef={stageRef} />
            <DocsPanel ctrl={ctrl} />
          </div>
        </section>

        <aside className="inspector" aria-label="Propiedades" hidden={!showInspector}>
          <div className="insp-toolbar">
            <button
              type="button"
              className="panel-hide"
              title="Ocultar propiedades"
              aria-label="Ocultar propiedades"
              onClick={toggleInspector}
            >
              »
            </button>
          </div>
          <Inspector ctrl={ctrl} />
        </aside>
      </div>

      <nav className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'diagram'}
          onClick={() => setTab('diagram')}
        >
          Diagrama
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'json'}
          onClick={() => setTab('json')}
        >
          JSON
        </button>
      </nav>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
