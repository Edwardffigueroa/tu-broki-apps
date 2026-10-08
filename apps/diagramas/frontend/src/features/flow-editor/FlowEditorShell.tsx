import { useEffect, useState } from 'react'
import { DocsList } from '../editor/DocsPanel'
import type { FlowController } from './FlowCtx'
import { FlowTopBar } from './FlowTopBar'
import { FlowCanvas } from './FlowCanvas'
import { Palette } from './panels/Palette'
import { LintPanel } from './panels/LintPanel'
import { FlowJsonPanel } from './panels/FlowJsonPanel'
import { FlowInspector } from './inspector/FlowInspector'

const LS_LEFT = 'diagramas.flow.panel.left'
const LS_RIGHT = 'diagramas.flow.panel.right'

function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    if (v === '0') return false
    if (v === '1') return true
  } catch {
    /* */
  }
  return fallback
}

function writePref(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0')
  } catch {
    /* */
  }
}

type LeftTab = 'palette' | 'lint' | 'json'

export function FlowEditorShell({
  ctrl,
  onBack,
  onOpenDiagram,
}: {
  ctrl: FlowController
  onBack: () => void
  onOpenDiagram: (id: string) => void
}) {
  const [leftOpen, setLeftOpen] = useState(() => readPref(LS_LEFT, true))
  const [rightOpen, setRightOpen] = useState(() => readPref(LS_RIGHT, true))
  const [leftTab, setLeftTab] = useState<LeftTab>('palette')

  useEffect(() => {
    writePref(LS_LEFT, leftOpen)
  }, [leftOpen])

  useEffect(() => {
    writePref(LS_RIGHT, rightOpen)
  }, [rightOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        ctrl.undo()
      }
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault()
        ctrl.redo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        ctrl.copy()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault()
        ctrl.cut()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        ctrl.paste()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        ctrl.duplicate()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        ctrl.selectAll()
      }
      if (e.key.toLowerCase() === 'f') {
        e.preventDefault()
        ctrl.fitWithHeaders()
      }
      if (e.key === '0') {
        e.preventDefault()
        // zoom 100% handled via fit - simplified
      }
      if (e.key === 'Escape') ctrl.setHighlight(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctrl])

  return (
    <div className="fs-shell">
      <FlowTopBar ctrl={ctrl} onBack={onBack} onOpenDiagram={onOpenDiagram} />
      <div className="fs-main">
        {leftOpen && (
          <aside className={`fs-panel fs-panel-left${leftTab === 'json' ? ' fs-panel-wide' : ''}`}>
            <div className="fs-tabs">
              <button type="button" className={leftTab === 'palette' ? 'active' : ''} onClick={() => setLeftTab('palette')}>Paleta</button>
              <button type="button" className={leftTab === 'lint' ? 'active' : ''} onClick={() => setLeftTab('lint')}>Revisión</button>
              <button
                type="button"
                className={leftTab === 'json' ? 'active' : ''}
                onClick={() => {
                  setLeftTab('json')
                  ctrl.formatJson()
                }}
              >
                JSON
              </button>
            </div>
            {leftTab === 'palette' && <Palette />}
            {leftTab === 'lint' && <LintPanel />}
            {leftTab === 'json' && <FlowJsonPanel />}
          </aside>
        )}
        <button
          type="button"
          className="fs-panel-toggle left"
          aria-label={leftOpen ? 'Ocultar panel izquierdo' : 'Mostrar panel izquierdo'}
          aria-expanded={leftOpen}
          onClick={() => setLeftOpen(!leftOpen)}
        >
          {leftOpen ? '‹' : '›'}
        </button>
        <main className="fs-stage" aria-label="Lienzo del diagrama">
          <FlowCanvas ctrl={ctrl} />
        </main>
        <button
          type="button"
          className="fs-panel-toggle right"
          aria-label={rightOpen ? 'Ocultar panel derecho' : 'Mostrar panel derecho'}
          aria-expanded={rightOpen}
          onClick={() => setRightOpen(!rightOpen)}
        >
          {rightOpen ? '›' : '‹'}
        </button>
        {rightOpen && (
          <aside className="fs-panel fs-panel-right">
            <FlowInspector />
          </aside>
        )}
      </div>
      <DocsList
        docs={ctrl.model.docs || []}
        onChange={(fn, key) => {
          ctrl.mutate((m) => {
            const list = m.docs || []
            const next = fn(list)
            if (next.length) m.docs = next
            else delete m.docs
            return m
          }, { key: key || 'docs' })
        }}
      />
      {ctrl.toast && <div className="toast">{ctrl.toast}</div>}
    </div>
  )
}
