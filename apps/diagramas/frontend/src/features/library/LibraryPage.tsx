import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AuthError,
  actualizarDiagrama,
  actualizarGrupo,
  crearDiagrama,
  crearEtiqueta,
  crearGrupo,
  duplicarDiagrama,
  eliminarDiagrama,
  eliminarGrupo,
  irAAcceso,
  listarDiagramas,
  listarEtiquetas,
  listarGrupos,
  logout,
  obtenerDiagrama,
} from '../../api/client'
import { diagramasKeys } from '../../api/queryClient'
import { ThemeToggle } from '../../components/ThemeToggle'
import { fechaCorta } from '../../lib/constants'
import type { DiagramaResumen, Etiqueta, Grupo } from '../../lib/types'
import { EXAMPLES, normalize } from '../../core/carriles'
import { modeloVacioFlow } from '@flow'
import { copiarClasicoAPro } from '../interop/convertir'
import type { DiagramaTipo } from '../../lib/types'

/** Carpeta virtual: diagramas con grupo_id null. */
const SIN_CARPETA = '__sin_carpeta__'

function Icon({ name, filled }: { name: string; filled?: boolean }) {
  return (
    <span
      className="material-symbols-outlined"
      style={filled ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 20" } : undefined}
      aria-hidden="true"
    >
      {name}
    </span>
  )
}

function SwimlanePreview({ pro }: { pro: boolean }) {
  return (
    <div className="card-preview" aria-hidden="true">
      <div className="card-preview-inner">
        <div className="card-lane">
          <span>Actor</span>
          <i className="a" />
        </div>
        <div className={`card-lane${pro ? ' shift-1' : ''}`}>
          <span>{pro ? 'App' : 'Front'}</span>
          <i className="b" />
        </div>
        <div className={`card-lane${pro ? ' shift-2' : ' shift-1'}`}>
          <span>{pro ? 'Pago' : 'Back'}</span>
          <i className="c" />
        </div>
      </div>
    </div>
  )
}

export function LibraryPage({
  onOpen,
}: {
  onOpen: (id: string) => void
}) {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [etiquetaId, setEtiquetaId] = useState<string | null>(null)
  const [archivados, setArchivados] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cardMenuId, setCardMenuId] = useState<string | null>(null)
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null)
  const [cardError, setCardError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem('diagramas.library.view') === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const [nameModal, setNameModal] = useState<null | {
    kind: 'grupo' | 'etiqueta' | 'rename-grupo'
    value: string
    id?: string
  }>(null)

  useEffect(() => {
    try {
      localStorage.setItem('diagramas.library.view', viewMode)
    } catch {
      /* */
    }
  }, [viewMode])

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), q ? 250 : 0)
    return () => clearTimeout(t)
  }, [q])

  const grupoApi = grupoId === SIN_CARPETA ? 'none' : grupoId
  const listParams = {
    q: qDebounced,
    grupo: grupoApi,
    etiqueta: etiquetaId,
    archivados,
  }

  const gruposQ = useQuery({
    queryKey: diagramasKeys.grupos(),
    queryFn: listarGrupos,
    staleTime: 60_000,
  })
  const etiquetasQ = useQuery({
    queryKey: diagramasKeys.etiquetas(),
    queryFn: listarEtiquetas,
    staleTime: 60_000,
  })
  const listQ = useQuery({
    queryKey: diagramasKeys.list(listParams),
    queryFn: () =>
      listarDiagramas({
        q: listParams.q,
        grupo: listParams.grupo,
        etiqueta: listParams.etiqueta,
        archivados: listParams.archivados,
      }),
  })

  /** Conteos de carpetas: lista sin filtro de carpeta (reutiliza cache si ya está). */
  const overviewParams = {
    q: '',
    grupo: null as string | null,
    etiqueta: null as string | null,
    archivados: false,
  }
  const overviewQ = useQuery({
    queryKey: diagramasKeys.list(overviewParams),
    queryFn: () => listarDiagramas({ archivados: false }),
    staleTime: 60_000,
    enabled: !archivados,
  })

  const diagramas = listQ.data ?? []
  const grupos = gruposQ.data ?? []
  const etiquetas = etiquetasQ.data ?? []
  const loading = (listQ.isPending && !listQ.data) || (gruposQ.isPending && !gruposQ.data)
  const queryError =
    listQ.error || gruposQ.error || etiquetasQ.error
      ? (listQ.error || gruposQ.error || etiquetasQ.error) instanceof Error
        ? ((listQ.error || gruposQ.error || etiquetasQ.error) as Error).message
        : 'No se pudo cargar'
      : null
  const displayError = error || queryError

  const countsByGrupo = useMemo(() => {
    const m = new Map<string, number>()
    // Vista carpetas: conteos siguen el filtro/búsqueda actual.
    // Dentro de una carpeta: overview global (sin q) para badges del sidebar.
    const source =
      !archivados && !grupoId ? diagramas : overviewQ.data ?? []
    let sinCarpeta = 0
    for (const item of source) {
      if (!item.grupo_id) {
        sinCarpeta += 1
        continue
      }
      m.set(item.grupo_id, (m.get(item.grupo_id) || 0) + 1)
    }
    m.set(SIN_CARPETA, sinCarpeta)
    return m
  }, [archivados, diagramas, grupoId, overviewQ.data])

  async function invalidateLibrary() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: diagramasKeys.lists() }),
      qc.invalidateQueries({ queryKey: diagramasKeys.grupos() }),
      qc.invalidateQueries({ queryKey: diagramasKeys.etiquetas() }),
    ])
  }

  useEffect(() => {
    if (!menuOpen && !cardMenuId && !folderMenuId) return
    const close = () => {
      setMenuOpen(false)
      setCardMenuId(null)
      setFolderMenuId(null)
    }
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [menuOpen, cardMenuId, folderMenuId])

  const grupoMap = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos])
  const mostrandoCarpetas = !archivados && grupoId === null
  const mostrandoDiagramas = archivados || grupoId !== null

  function showToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  async function nuevo(tipo: DiagramaTipo = 'swimlane') {
    setMenuOpen(false)
    setBusy(true)
    const grupoDestino = !grupoId || grupoId === SIN_CARPETA ? null : grupoId
    try {
      const body =
        tipo === 'swimlane-flow'
          ? {
              titulo: 'Nuevo diagrama Pro',
              grupo_id: grupoDestino,
              tipo: 'swimlane-flow' as const,
              modelo: modeloVacioFlow('Nuevo diagrama Pro'),
            }
          : {
              titulo: 'Nuevo diagrama',
              grupo_id: grupoDestino,
              tipo: 'swimlane' as const,
              modelo: normalize(EXAMPLES.vacio).m,
            }
      const d = await crearDiagrama(body)
      qc.setQueryData(diagramasKeys.detail(d.id), d)
      void invalidateLibrary()
      onOpen(d.id)
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo crear')
    } finally {
      setBusy(false)
    }
  }

  async function onDuplicar(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setCardMenuId(null)
    try {
      const d = await duplicarDiagrama(id)
      qc.setQueryData(diagramasKeys.detail(d.id), d)
      void invalidateLibrary()
      showToast('Diagrama duplicado')
      onOpen(d.id)
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo duplicar')
    }
  }

  async function onCopiarAPro(d: DiagramaResumen, e: React.MouseEvent) {
    e.stopPropagation()
    setCardMenuId(null)
    setCardError(null)
    try {
      const full = await obtenerDiagrama(d.id)
      const created = await copiarClasicoAPro(d, { modelo: full.modelo, grupo_id: full.grupo_id })
      qc.setQueryData(diagramasKeys.detail(created.id), created)
      void invalidateLibrary()
      showToast('Copia Pro creada')
      onOpen(created.id)
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setCardError(err instanceof Error ? err.message : 'Error')
    }
  }

  async function onArchivar(d: DiagramaResumen, e: React.MouseEvent) {
    e.stopPropagation()
    setCardMenuId(null)
    try {
      await actualizarDiagrama(d.id, {
        revision: d.revision,
        archived: !d.archived_at,
      })
      await invalidateLibrary()
      showToast(d.archived_at ? 'Restaurado' : 'Archivado')
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo archivar')
    }
  }

  async function onEliminar(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setCardMenuId(null)
    if (!confirm('¿Eliminar este diagrama? Esta acción no se puede deshacer.')) return
    try {
      await eliminarDiagrama(id)
      qc.removeQueries({ queryKey: diagramasKeys.detail(id) })
      await invalidateLibrary()
      showToast('Eliminado')
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    }
  }

  async function onMoverGrupo(d: DiagramaResumen, e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    const value = e.target.value || null
    try {
      await actualizarDiagrama(d.id, { revision: d.revision, grupo_id: value })
      await invalidateLibrary()
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo mover')
    }
  }

  async function onToggleEtiqueta(d: DiagramaResumen, et: Etiqueta, e: React.MouseEvent) {
    e.stopPropagation()
    const on = d.etiquetas.some((x) => x.id === et.id)
    const next = on ? d.etiquetas.filter((x) => x.id !== et.id).map((x) => x.id) : [...d.etiquetas.map((x) => x.id), et.id]
    try {
      await actualizarDiagrama(d.id, { revision: d.revision, etiqueta_ids: next })
      await invalidateLibrary()
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo actualizar etiqueta')
    }
  }

  function openAddGrupo() {
    setMenuOpen(false)
    setCardMenuId(null)
    setFolderMenuId(null)
    setNameModal({ kind: 'grupo', value: '' })
  }

  function openAddEtiqueta() {
    setMenuOpen(false)
    setCardMenuId(null)
    setFolderMenuId(null)
    setNameModal({ kind: 'etiqueta', value: '' })
  }

  function openRenameGrupo(g: Grupo, e: React.MouseEvent) {
    e.stopPropagation()
    setFolderMenuId(null)
    setNameModal({ kind: 'rename-grupo', value: g.nombre, id: g.id })
  }

  async function onEliminarGrupo(g: Grupo, e: React.MouseEvent) {
    e.stopPropagation()
    setFolderMenuId(null)
    if (
      !window.confirm(
        `¿Eliminar la carpeta «${g.nombre}»? Los diagramas no se borran; quedan sin carpeta.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await eliminarGrupo(g.id)
      if (grupoId === g.id) setGrupoId(null)
      showToast('Carpeta eliminada')
      await invalidateLibrary()
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo eliminar la carpeta')
    } finally {
      setBusy(false)
    }
  }

  async function submitNameModal() {
    if (!nameModal) return
    const nombre = nameModal.value.trim()
    if (!nombre) {
      setError(
        nameModal.kind === 'etiqueta'
          ? 'Escribe un nombre para la etiqueta'
          : 'Escribe un nombre para la carpeta',
      )
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (nameModal.kind === 'grupo') {
        await crearGrupo(nombre)
        showToast('Carpeta creada')
      } else if (nameModal.kind === 'rename-grupo' && nameModal.id) {
        await actualizarGrupo(nameModal.id, { nombre })
        showToast('Carpeta renombrada')
      } else {
        await crearEtiqueta(nombre)
        showToast('Etiqueta creada')
      }
      setNameModal(null)
      await invalidateLibrary()
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setBusy(false)
    }
  }

  const espacioLabel =
    grupoId === SIN_CARPETA
      ? 'Sin carpeta'
      : grupoId
        ? grupoMap.get(grupoId)?.nombre || 'Carpeta'
        : archivados
          ? 'Papelera'
          : 'Todas las carpetas'

  return (
    <div className="library">
      <aside className="library-side" aria-label="Navegación">
        <div>
          <div className="library-brand">
            <div className="library-brand-mark">
              <Icon name="account_tree" filled />
            </div>
            <div className="library-brand-text">
              <strong>Diagramas</strong>
              <span>TuBroki Studio</span>
            </div>
          </div>

          <div className="library-space">
            <Icon name="hub" />
            <div>
              <small>Espacio actual</small>
              <strong>Diagramas & Arquitectura</strong>
            </div>
          </div>

          <nav className="side-nav">
            <div className="side-label">Navegación</div>
            <div className="side-list">
              <button
                type="button"
                className={'side-item' + (grupoId === null && !archivados ? ' active' : '')}
                onClick={() => {
                  setGrupoId(null)
                  setArchivados(false)
                }}
              >
                <span className="side-item-left">
                  <Icon name="folder" />
                  Todas las carpetas
                </span>
              </button>
              <button
                type="button"
                className={'side-item' + (archivados ? ' active' : '')}
                onClick={() => {
                  setGrupoId(null)
                  setEtiquetaId(null)
                  setArchivados(true)
                }}
              >
                <span className="side-item-left">
                  <Icon name="delete" />
                  Papelera
                </span>
              </button>
            </div>
          </nav>
        </div>

        <div className="library-side-foot">
          <div className="library-sync">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="cloud_done" />
              Sincronizado
            </span>
            <button type="button" className="ghost" style={{ padding: '2px 6px', color: 'var(--accent)' }} onClick={openAddGrupo}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                <Icon name="add" /> Nuevo
              </span>
            </button>
          </div>
          <button type="button" className="ghost" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="library-main">
        <header className="library-top">
          <div className="library-search-wrap">
            <Icon name="search" />
            <input
              className="search"
              type="search"
              placeholder="Buscar diagramas, swimlanes…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Buscar diagramas"
            />
            <div className="library-search-kbd" aria-hidden="true">
              <kbd>⌘</kbd>
              <kbd>K</kbd>
            </div>
          </div>
          <div className="library-top-actions">
            <ThemeToggle />
            <div className="library-new-wrap">
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen((v) => !v)
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="add_box" />
                  Nuevo diagrama
                  <Icon name="expand_more" />
                </span>
              </button>
              {menuOpen && (
                <div className="library-new-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                  <div className="menu-label">Elegir lienzo</div>
                  <button type="button" role="menuitem" onClick={() => void nuevo('swimlane')}>
                    <span className="menu-ico sky">
                      <Icon name="splitscreen" />
                    </span>
                    <span>
                      <strong>Carriles clásico</strong>
                      <small>Swimlane por actores</small>
                    </span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => void nuevo('swimlane-flow')}>
                    <span className="menu-ico">
                      <Icon name="account_tree" />
                    </span>
                    <span>
                      <strong>Carriles Pro · beta</strong>
                      <small>Lienzo React Flow</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="library-body">
          <div className="library-glow a" />
          <div className="library-glow b" />
          <div className="library-content">
            <div className="library-hero">
              <div>
                <div className="library-crumb">
                  <span>Workspace</span>
                  <Icon name="chevron_right" />
                  <em>{espacioLabel}</em>
                </div>
                <h1>Gestor de Diagramas</h1>
              </div>
              <div className="library-hero-actions">
                <button type="button" onClick={openAddGrupo}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="create_new_folder" />
                    Nueva carpeta
                  </span>
                </button>
              </div>
            </div>

            <div className="library-pills" role="group" aria-labelledby="library-pills-label">
              <span id="library-pills-label" className="library-pills-label">
                Filtra por etiqueta
              </span>
              <button
                type="button"
                className={'pill' + (etiquetaId === null ? ' active' : '')}
                onClick={() => setEtiquetaId(null)}
              >
                Todas
              </button>
              {etiquetas.map((et) => (
                <button
                  key={et.id}
                  type="button"
                  className={'pill' + (etiquetaId === et.id ? ' active' : '')}
                  onClick={() => setEtiquetaId(et.id === etiquetaId ? null : et.id)}
                >
                  {et.nombre}
                </button>
              ))}
              <button type="button" className="pill pill-add" onClick={openAddEtiqueta}>
                + Etiqueta
              </button>
            </div>

            {!archivados && (
              <section className="library-section">
                <div className="library-section-head">
                  <h2>
                    <Icon name="folder" />
                    Carpetas de trabajo
                    <span className="badge">{grupos.length} activas</span>
                  </h2>
                </div>
                <div className="folder-grid">
                  <div
                    className={
                      'folder-card folder-card-virtual' +
                      (grupoId === SIN_CARPETA ? ' active' : '')
                    }
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setGrupoId(SIN_CARPETA)
                      setArchivados(false)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setGrupoId(SIN_CARPETA)
                        setArchivados(false)
                      }
                    }}
                  >
                    <div className="folder-ico">
                      <Icon name="folder_off" />
                    </div>
                    <h3>Sin carpeta</h3>
                    <p>
                      {countsByGrupo.get(SIN_CARPETA) || 0} diagrama
                      {(countsByGrupo.get(SIN_CARPETA) || 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                  {grupos.map((g) => (
                    <div
                      key={g.id}
                      className={
                        'folder-card' +
                        (grupoId === g.id ? ' active' : '') +
                        (folderMenuId === g.id ? ' menu-open' : '')
                      }
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setGrupoId(g.id)
                        setArchivados(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setGrupoId(g.id)
                          setArchivados(false)
                        }
                      }}
                    >
                      <button
                        type="button"
                        className="card-menu-btn"
                        aria-label={`Opciones de ${g.nombre}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setCardMenuId(null)
                          setFolderMenuId((id) => (id === g.id ? null : g.id))
                        }}
                      >
                        <Icon name="more_horiz" />
                      </button>
                      {folderMenuId === g.id && (
                        <div className="card-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                          <button type="button" onClick={(e) => openRenameGrupo(g, e)}>
                            Renombrar
                          </button>
                          <button type="button" className="danger" onClick={(e) => void onEliminarGrupo(g, e)}>
                            Eliminar
                          </button>
                        </div>
                      )}
                      <div
                        className="folder-ico"
                        style={{
                          background: g.color ? `${g.color}22` : undefined,
                          color: g.color || undefined,
                        }}
                      >
                        <Icon name="folder_special" />
                      </div>
                      <h3>{g.nombre}</h3>
                      <p>
                        {countsByGrupo.get(g.id) || 0} diagrama
                        {(countsByGrupo.get(g.id) || 0) === 1 ? '' : 's'}
                      </p>
                    </div>
                  ))}
                </div>
                {grupos.length === 0 && (
                  <p className="library-hint">
                    Aún no hay carpetas propias. Los diagramas sueltos están en «Sin carpeta».
                    {' '}
                    <button type="button" className="ghost" style={{ padding: '0 4px' }} onClick={openAddGrupo}>
                      Crear carpeta
                    </button>
                  </p>
                )}
                {mostrandoCarpetas && grupos.length > 0 && (
                  <p className="library-hint">Elige una carpeta para ver sus diagramas.</p>
                )}
              </section>
            )}

            {mostrandoDiagramas && (
              <section className="library-section">
                <div className="library-section-head">
                  <h2>
                    <Icon name="auto_awesome_motion" />
                    {archivados ? 'Diagramas archivados' : 'Diagramas'}
                  </h2>
                  <div className="view-switch" role="group" aria-label="Vista de diagramas">
                    <button
                      type="button"
                      className={viewMode === 'grid' ? 'active' : undefined}
                      title="Vista en cuadrícula"
                      aria-pressed={viewMode === 'grid'}
                      onClick={() => setViewMode('grid')}
                    >
                      <Icon name="grid_view" />
                    </button>
                    <button
                      type="button"
                      className={viewMode === 'list' ? 'active' : undefined}
                      title="Vista en lista"
                      aria-pressed={viewMode === 'list'}
                      onClick={() => setViewMode('list')}
                    >
                      <Icon name="view_agenda" />
                    </button>
                  </div>
                </div>

                {loading && <div className="loading-center">Cargando…</div>}
                {displayError && <p style={{ color: 'var(--err)' }}>{displayError}</p>}
                {!loading && !diagramas.length && (
                  <div className="empty">
                    <h2>{archivados ? 'La papelera está vacía' : 'Esta carpeta está vacía'}</h2>
                    <p>
                      {archivados
                        ? 'Los diagramas que archives aparecen aquí.'
                        : 'Crea un diagrama de carriles para mapear procesos. Queda guardado en esta carpeta.'}
                    </p>
                    {!archivados && (
                      <>
                        <button type="button" className="primary" onClick={() => void nuevo('swimlane')}>
                          Crear el primero
                        </button>
                        <div style={{ marginTop: 8 }}>
                          <button type="button" className="ghost" onClick={() => void nuevo('swimlane-flow')}>
                            o prueba Carriles Pro
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {!loading && diagramas.length > 0 && (
                  <div className={viewMode === 'list' ? 'cards cards-list' : 'cards'}>
                    {diagramas.map((d) => {
                      const pro = d.tipo === 'swimlane-flow'
                      return (
                        <div
                          key={d.id}
                          className={'card' + (cardMenuId === d.id ? ' menu-open' : '')}
                          role="button"
                          tabIndex={0}
                          onClick={() => onOpen(d.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              onOpen(d.id)
                            }
                          }}
                        >
                          <button
                            type="button"
                            className="card-menu-btn"
                            aria-label="Opciones del diagrama"
                            onClick={(e) => {
                              e.stopPropagation()
                              setFolderMenuId(null)
                              setCardMenuId((id) => (id === d.id ? null : d.id))
                            }}
                          >
                            <Icon name="more_horiz" />
                          </button>
                          {archivados && d.archived_at && (
                            <button
                              type="button"
                              className="card-restore-btn"
                              onClick={(e) => void onArchivar(d, e)}
                            >
                              <Icon name="unarchive" />
                              Restaurar
                            </button>
                          )}
                          {cardMenuId === d.id && (
                            <div className="card-menu" role="menu" onClick={(e) => e.stopPropagation()}>
                              <button type="button" onClick={(e) => void onDuplicar(d.id, e)}>
                                Duplicar
                              </button>
                              {(d.tipo || 'swimlane') === 'swimlane' && (
                                <button type="button" onClick={(e) => void onCopiarAPro(d, e)}>
                                  Crear copia en Pro
                                </button>
                              )}
                              <button type="button" onClick={(e) => void onArchivar(d, e)}>
                                {d.archived_at ? 'Restaurar' : 'Archivar'}
                              </button>
                              <label>
                                Mover a carpeta
                                <select
                                  value={d.grupo_id || ''}
                                  onChange={(e) => void onMoverGrupo(d, e)}
                                  aria-label="Mover de grupo"
                                >
                                  <option value="">Sin carpeta</option>
                                  {grupos.map((g) => (
                                    <option key={g.id} value={g.id}>{g.nombre}</option>
                                  ))}
                                </select>
                              </label>
                              <div className="menu-tags-block" role="group" aria-label="Asignar etiqueta">
                                <span className="menu-tags-label">Asignar etiqueta</span>
                                {etiquetas.length > 0 ? (
                                  <div className="menu-tags">
                                    {etiquetas.map((et) => {
                                      const on = d.etiquetas.some((x) => x.id === et.id)
                                      return (
                                        <button
                                          key={et.id}
                                          type="button"
                                          className={on ? 'on' : undefined}
                                          aria-pressed={on}
                                          onClick={(e) => void onToggleEtiqueta(d, et, e)}
                                        >
                                          {et.nombre}
                                        </button>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    className="menu-tags-empty"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setCardMenuId(null)
                                      openAddEtiqueta()
                                    }}
                                  >
                                    No hay etiquetas · Crear una
                                  </button>
                                )}
                              </div>
                              <button type="button" className="danger" onClick={(e) => void onEliminar(d.id, e)}>
                                Eliminar
                              </button>
                            </div>
                          )}
                          <SwimlanePreview pro={pro} />
                          <div className="card-body">
                            <div className="card-meta">
                              <span className={`chip ${pro ? 'chip-pro' : 'muted'}`}>
                                {pro ? 'Pro · beta' : 'Swimlane'}
                              </span>
                              {d.grupo_id && grupoMap.get(d.grupo_id) && (
                                <span className="chip muted">{grupoMap.get(d.grupo_id)!.nombre}</span>
                              )}
                              {d.etiquetas.map((et) => (
                                <span key={et.id} className="chip">{et.nombre}</span>
                              ))}
                              {d.archived_at && <span className="chip muted">Archivado</span>}
                            </div>
                            <h2 className="card-title">{d.titulo}</h2>
                            <div className="card-meta">
                              <span>{fechaCorta(d.updated_at)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )}

            {cardError && <p style={{ color: 'var(--err)' }}>No se pudo crear la copia: {cardError}</p>}
          </div>
        </div>
        {toast && <div className="toast library-toast">{toast}</div>}
      </div>

      {nameModal && (
        <div
          className="library-modal-backdrop"
          role="presentation"
          onClick={() => !busy && setNameModal(null)}
        >
          <form
            className="library-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-name-modal-title"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault()
              void submitNameModal()
            }}
          >
            <h2 id="library-name-modal-title">
              {nameModal.kind === 'grupo'
                ? 'Nueva carpeta'
                : nameModal.kind === 'rename-grupo'
                  ? 'Renombrar carpeta'
                  : 'Nueva etiqueta'}
            </h2>
            <p>
              {nameModal.kind === 'etiqueta'
                ? 'Las etiquetas ayudan a filtrar diagramas.'
                : 'Las carpetas agrupan tus diagramas.'}
            </p>
            <label>
              Nombre
              <input
                autoFocus
                value={nameModal.value}
                disabled={busy}
                placeholder={nameModal.kind === 'etiqueta' ? 'Ej. demo' : 'Ej. Verificación'}
                onChange={(e) => setNameModal({ ...nameModal, value: e.target.value })}
              />
            </label>
            <div className="library-modal-actions">
              <button type="button" className="ghost" disabled={busy} onClick={() => setNameModal(null)}>
                Cancelar
              </button>
              <button type="submit" className="primary" disabled={busy}>
                {busy
                  ? 'Guardando…'
                  : nameModal.kind === 'rename-grupo'
                    ? 'Guardar'
                    : 'Crear'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
