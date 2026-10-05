import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AuthError,
  crearDiagrama,
  crearEtiqueta,
  crearGrupo,
  duplicarDiagrama,
  eliminarDiagrama,
  eliminarEtiqueta,
  eliminarGrupo,
  irAAcceso,
  listarDiagramas,
  listarEtiquetas,
  listarGrupos,
  logout,
  actualizarDiagrama,
} from '../../api/client'
import { fechaCorta } from '../../lib/constants'
import type { DiagramaResumen, Etiqueta, Grupo } from '../../lib/types'
import { EXAMPLES, normalize } from '../../core/carriles'

function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="1.5" y="3" width="21" height="8" rx="2" fill="var(--lh0)" stroke="var(--ink)" strokeWidth="1.4" />
      <rect x="1.5" y="13" width="21" height="8" rx="2" fill="var(--lh2)" stroke="var(--ink)" strokeWidth="1.4" />
      <circle cx="7" cy="7" r="2" fill="var(--accent)" />
      <path d="M9 7h6.5a1.5 1.5 0 0 1 1.5 1.5V15" fill="none" stroke="var(--accent)" strokeWidth="1.6" />
      <rect x="14" y="15" width="6" height="4" rx="1" fill="var(--accent)" />
    </svg>
  )
}

export function LibraryPage({
  onOpen,
}: {
  onOpen: (id: string) => void
}) {
  const [diagramas, setDiagramas] = useState<DiagramaResumen[]>([])
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([])
  const [q, setQ] = useState('')
  const [grupoId, setGrupoId] = useState<string | null>(null)
  const [etiquetaId, setEtiquetaId] = useState<string | null>(null)
  const [archivados, setArchivados] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [d, g, e] = await Promise.all([
        listarDiagramas({ q, grupo: grupoId, etiqueta: etiquetaId, archivados }),
        listarGrupos(),
        listarEtiquetas(),
      ])
      setDiagramas(d)
      setGrupos(g)
      setEtiquetas(e)
    } catch (err) {
      if (err instanceof AuthError) {
        irAAcceso()
        return
      }
      setError(err instanceof Error ? err.message : 'No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }, [archivados, etiquetaId, grupoId, q])

  useEffect(() => {
    const t = setTimeout(() => {
      void load()
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  const grupoMap = useMemo(() => new Map(grupos.map((g) => [g.id, g])), [grupos])

  async function nuevo() {
    setBusy(true)
    try {
      const d = await crearDiagrama({
        titulo: 'Nuevo diagrama',
        grupo_id: grupoId,
        modelo: normalize(EXAMPLES.vacio).m,
      })
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
    setBusy(true)
    try {
      const d = await duplicarDiagrama(id)
      await load()
      onOpen(d.id)
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo duplicar')
    } finally {
      setBusy(false)
    }
  }

  async function onArchivar(d: DiagramaResumen, e: React.MouseEvent) {
    e.stopPropagation()
    setBusy(true)
    try {
      await actualizarDiagrama(d.id, {
        revision: d.revision,
        archived: !d.archived_at,
      })
      await load()
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo archivar')
    } finally {
      setBusy(false)
    }
  }

  async function onEliminar(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Eliminar este diagrama de forma permanente?')) return
    setBusy(true)
    try {
      await eliminarDiagrama(id)
      await load()
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setBusy(false)
    }
  }

  async function onToggleEtiqueta(d: DiagramaResumen, etiqueta: Etiqueta, e: React.MouseEvent) {
    e.stopPropagation()
    const has = d.etiquetas.some((x) => x.id === etiqueta.id)
    const next = has
      ? d.etiquetas.filter((x) => x.id !== etiqueta.id).map((x) => x.id)
      : [...d.etiquetas.map((x) => x.id), etiqueta.id]
    setBusy(true)
    try {
      await actualizarDiagrama(d.id, { revision: d.revision, etiqueta_ids: next })
      await load()
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo actualizar etiquetas')
    } finally {
      setBusy(false)
    }
  }

  async function onMoverGrupo(d: DiagramaResumen, e: React.ChangeEvent<HTMLSelectElement>) {
    e.stopPropagation()
    const gid = e.target.value || null
    setBusy(true)
    try {
      await actualizarDiagrama(d.id, { revision: d.revision, grupo_id: gid })
      await load()
    } catch (err) {
      if (err instanceof AuthError) irAAcceso()
      else setError(err instanceof Error ? err.message : 'No se pudo mover')
    } finally {
      setBusy(false)
    }
  }

  async function addGrupo() {
    const nombre = prompt('Nombre del grupo')
    if (!nombre?.trim()) return
    try {
      await crearGrupo(nombre.trim())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el grupo')
    }
  }

  async function addEtiqueta() {
    const nombre = prompt('Nombre de la etiqueta')
    if (!nombre?.trim()) return
    try {
      await crearEtiqueta(nombre.trim())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la etiqueta')
    }
  }

  async function removeGrupo(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Eliminar este grupo? Los diagramas quedan sin grupo.')) return
    await eliminarGrupo(id)
    if (grupoId === id) setGrupoId(null)
    await load()
  }

  async function removeEtiqueta(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('¿Eliminar esta etiqueta?')) return
    await eliminarEtiqueta(id)
    if (etiquetaId === id) setEtiquetaId(null)
    await load()
  }

  return (
    <div className="library">
      <aside className="library-side">
        <div className="library-brand">
          <BrandMark />
          <span>Diagramas</span>
        </div>

        <div className="side-section">
          <h3>Grupos</h3>
          <div className="side-list">
            <button
              type="button"
              className={'side-item' + (grupoId === null ? ' active' : '')}
              onClick={() => setGrupoId(null)}
            >
              Todos
            </button>
            {grupos.map((g) => (
              <button
                key={g.id}
                type="button"
                className={'side-item' + (grupoId === g.id ? ' active' : '')}
                onClick={() => setGrupoId(g.id)}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="dot" style={{ background: g.color || 'var(--accent)' }} />
                  {g.nombre}
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  style={{ opacity: 0.5, fontSize: 12 }}
                  onClick={(e) => void removeGrupo(g.id, e)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void removeGrupo(g.id, e as unknown as React.MouseEvent)
                  }}
                >
                  ×
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="side-add" onClick={() => void addGrupo()}>
            + Grupo
          </button>
        </div>

        <div className="side-section">
          <h3>Etiquetas</h3>
          <div className="side-list">
            <button
              type="button"
              className={'side-item' + (etiquetaId === null ? ' active' : '')}
              onClick={() => setEtiquetaId(null)}
            >
              Todas
            </button>
            {etiquetas.map((et) => (
              <button
                key={et.id}
                type="button"
                className={'side-item' + (etiquetaId === et.id ? ' active' : '')}
                onClick={() => setEtiquetaId(et.id)}
              >
                <span>{et.nombre}</span>
                <span
                  role="button"
                  tabIndex={0}
                  style={{ opacity: 0.5, fontSize: 12 }}
                  onClick={(e) => void removeEtiqueta(et.id, e)}
                >
                  ×
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="side-add" onClick={() => void addEtiqueta()}>
            + Etiqueta
          </button>
        </div>

        <label className="side-item" style={{ marginTop: 'auto' }}>
          <input
            type="checkbox"
            checked={archivados}
            onChange={(e) => setArchivados(e.target.checked)}
          />
          Mostrar archivados
        </label>

        <button type="button" className="ghost" onClick={() => void logout()}>
          Cerrar sesión
        </button>
      </aside>

      <div className="library-main">
        <div className="library-top">
          <h1>Biblioteca</h1>
          <input
            className="search"
            type="search"
            placeholder="Buscar por título…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button type="button" className="primary" disabled={busy} onClick={() => void nuevo()}>
            Nuevo diagrama de carriles
          </button>
        </div>

        <div className="library-body">
          {loading && <div className="loading-center">Cargando…</div>}
          {error && <p style={{ color: 'var(--err)' }}>{error}</p>}
          {!loading && !diagramas.length && (
            <div className="empty">
              <h2>Aún no hay diagramas</h2>
              <p>
                Crea un diagrama de carriles para mapear procesos. Quedan guardados, se agrupan y
                se etiquetan — y el JSON queda listo para la IA.
              </p>
              <button type="button" className="primary" onClick={() => void nuevo()}>
                Crear el primero
              </button>
            </div>
          )}
          {!loading && diagramas.length > 0 && (
            <div className="cards">
              {diagramas.map((d) => (
                <div
                  key={d.id}
                  className="card"
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
                  <h2 className="card-title">{d.titulo}</h2>
                  <div className="card-meta">
                    <span className="chip muted">Carriles</span>
                    {d.grupo_id && grupoMap.get(d.grupo_id) && (
                      <span className="chip">{grupoMap.get(d.grupo_id)!.nombre}</span>
                    )}
                    {d.etiquetas.map((et) => (
                      <span key={et.id} className="chip">{et.nombre}</span>
                    ))}
                    {d.archived_at && <span className="chip muted">Archivado</span>}
                    <span>{fechaCorta(d.updated_at)}</span>
                  </div>
                  <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={(e) => void onDuplicar(d.id, e)}>
                      Duplicar
                    </button>
                    <button type="button" onClick={(e) => void onArchivar(d, e)}>
                      {d.archived_at ? 'Restaurar' : 'Archivar'}
                    </button>
                    <select
                      value={d.grupo_id || ''}
                      onChange={(e) => void onMoverGrupo(d, e)}
                      aria-label="Mover de grupo"
                    >
                      <option value="">Sin grupo</option>
                      {grupos.map((g) => (
                        <option key={g.id} value={g.id}>{g.nombre}</option>
                      ))}
                    </select>
                    {etiquetas.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, width: '100%' }}>
                        {etiquetas.map((et) => {
                          const on = d.etiquetas.some((x) => x.id === et.id)
                          return (
                            <button
                              key={et.id}
                              type="button"
                              className={on ? 'primary' : undefined}
                              style={{ fontSize: 11, padding: '2px 7px' }}
                              onClick={(e) => void onToggleEtiqueta(d, et, e)}
                            >
                              {et.nombre}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <button type="button" className="danger" onClick={(e) => void onEliminar(d.id, e)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}