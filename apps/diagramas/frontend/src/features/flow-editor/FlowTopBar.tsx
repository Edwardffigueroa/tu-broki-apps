import { useEffect, useState } from 'react'
import { buildFlowAiPrompt, toNarrative, toText } from '@flow'
import { ThemeToggle } from '../../components/ThemeToggle'
import { BASE } from '../../lib/constants'
import type { SaveStatus } from '../../lib/types'
import type { FlowController } from './FlowCtx'
import { ExportClasicoModal } from './ExportClasicoModal'

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

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden="true">
      {name}
    </span>
  )
}

export function FlowTopBar({
  ctrl,
  onBack,
  onOpenDiagram,
}: {
  ctrl: FlowController
  onBack: () => void
  onOpenDiagram: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exampleOpen, setExampleOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const close = () => {
      setMenuOpen(false)
      setExampleOpen(false)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuOpen])

  async function copyText(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text)
      ctrl.showToast(msg)
    } catch {
      ctrl.showToast('No se pudo copiar')
    }
  }

  return (
    <>
      <header className="fs-topbar">
        <button type="button" className="fs-btn fs-btn-ghost" onClick={onBack}>
          <Icon name="arrow_back" />
          Biblioteca
        </button>

        <input
          className="fs-title-input"
          value={ctrl.model.title}
          disabled={ctrl.readOnly}
          onChange={(e) => ctrl.setTitle(e.target.value)}
          aria-label="Título del diagrama"
        />

        <span className={`fs-pill save-pill status-${ctrl.saveStatus}`}>
          <span className="fs-pill-dot" aria-hidden="true" />
          {saveLabel(ctrl.saveStatus)}
        </span>
        <span className="fs-badge-pro">Pro · beta</span>

        <div className="fs-topbar-actions">
          <div className="fs-btn-group" role="group" aria-label="Historial">
            <button
              type="button"
              className="fs-btn fs-btn-icon"
              onClick={() => ctrl.undo()}
              disabled={!ctrl.canUndo}
              title="Deshacer"
            >
              <Icon name="undo" />
            </button>
            <button
              type="button"
              className="fs-btn fs-btn-icon"
              onClick={() => ctrl.redo()}
              disabled={!ctrl.canRedo}
              title="Rehacer"
            >
              <Icon name="redo" />
            </button>
          </div>

          <button
            type="button"
            className={`fs-btn ${ctrl.readOnly ? 'fs-btn-primary' : 'fs-btn-soft'}`}
            onClick={() => ctrl.setReadOnly(!ctrl.readOnly)}
          >
            <Icon name={ctrl.readOnly ? 'edit' : 'visibility'} />
            {ctrl.readOnly ? 'Editar' : 'Modo lectura'}
          </button>

          <button
            type="button"
            className="fs-btn fs-btn-soft"
            onClick={() => ctrl.fitWithHeaders()}
            title="Ajustar vista (F)"
          >
            <Icon name="fit_screen" />
            Ajustar
          </button>

          <ThemeToggle className="fs-btn fs-btn-soft" />

          <div className="fs-menu-wrap">
            <button
              type="button"
              className="fs-btn fs-btn-icon"
              aria-label="Más opciones"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation()
                setMenuOpen((v) => !v)
              }}
            >
              <Icon name="more_horiz" />
            </button>
            {menuOpen && (
              <div className="fs-dropdown" role="menu" onClick={(e) => e.stopPropagation()}>
                <button type="button" role="menuitem" onClick={() => void copyText(toText(ctrl.model), 'JSON copiado')}>
                  <Icon name="data_object" />
                  Copiar JSON
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void copyText(toNarrative(ctrl.model), 'Texto copiado')}
                >
                  <Icon name="description" />
                  Copiar texto para IA
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void copyText(buildFlowAiPrompt(ctrl.model), 'Prompt copiado')}
                >
                  <Icon name="auto_awesome" />
                  Copiar prompt IA
                </button>
                <button type="button" role="menuitem" onClick={() => setExampleOpen(!exampleOpen)}>
                  <Icon name="folder_open" />
                  Cargar ejemplo
                  <Icon name={exampleOpen ? 'expand_less' : 'expand_more'} />
                </button>
                {exampleOpen && (
                  <div className="fs-dropdown-sub">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        ctrl.loadExample('mini')
                        setMenuOpen(false)
                      }}
                    >
                      Mini
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        ctrl.loadExample('arriendo')
                        setMenuOpen(false)
                      }}
                    >
                      Arriendo de punta a punta
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setExportOpen(true)
                    setMenuOpen(false)
                  }}
                >
                  <Icon name="ios_share" />
                  Exportar copia a Carriles clásico
                </button>
                <a href={BASE + '/'} className="fs-link-muted">
                  <Icon name="home" />
                  Ir al launcher
                </a>
              </div>
            )}
          </div>
        </div>
      </header>
      {ctrl.readOnly && (
        <div className="fs-readonly-banner">
          Modo lectura — no puedes mover ni conectar
          <button type="button" className="fs-btn fs-btn-primary" onClick={() => ctrl.setReadOnly(false)}>
            <Icon name="edit" />
            Editar
          </button>
        </div>
      )}
      {exportOpen && (
        <ExportClasicoModal
          model={ctrl.model}
          onClose={() => setExportOpen(false)}
          onOpenDiagram={onOpenDiagram}
        />
      )}
    </>
  )
}
