import { useState } from 'react'
import { ContabilidadProvider, useContabilidad } from './state/ContabilidadStore'
import { NavIcon, VIEWS } from './components/NavIcons'
import { MovDrawer } from './components/MovDrawer'
import { ResumenView } from './views/ResumenView'
import { MovimientosView } from './views/MovimientosView'
import { ResultadosView } from './views/ResultadosView'
import { ServiciosView } from './views/ServiciosView'
import { MetasView } from './views/MetasView'
import { CatalogoView } from './views/CatalogoView'
import type { Movimiento } from './lib/types'
import './styles/app.css'

function Shell() {
  const { loading, error, view, setView, toast } = useContabilidad()
  const [drawer, setDrawer] = useState<Partial<Movimiento> | null>(null)

  const onNew = (tipo: 'ingreso' | 'gasto') => setDrawer({ tipo })
  const onEdit = (m: Movimiento) => setDrawer({ ...m })

  return (
    <div className="app">
      <aside>
        <div className="logo">
          <span className="tu">tu</span>
          <span className="bk">Broki</span>
          <span className="dot" />
        </div>
        <div className="sub">Finanzas · TUBROKI SAS</div>
        <nav>
          {VIEWS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-current={view === id}
              onClick={() => setView(id)}
            >
              <NavIcon view={id} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="live">
            <i />
            <span>Datos compartidos</span>
          </div>
          <div style={{ marginTop: 8 }}>
            NIT 901.023.056-3
            <br />
            Cali, Valle del Cauca
          </div>
        </div>
      </aside>
      <main>
        {loading ? (
          <div className="empty">
            <h3>Cargando los libros de TuBroki…</h3>
            <p>Movimientos, metas y catálogo de servicios.</p>
          </div>
        ) : error ? (
          <div className="panel empty">
            <h3>No se pudieron cargar los datos</h3>
            <p>{error}</p>
          </div>
        ) : (
          <>
            {view === 'resumen' && <ResumenView onNew={onNew} onEdit={onEdit} />}
            {view === 'movimientos' && <MovimientosView onNew={onNew} onEdit={onEdit} />}
            {view === 'resultados' && <ResultadosView />}
            {view === 'servicios' && <ServiciosView />}
            {view === 'metas' && <MetasView />}
            {view === 'catalogo' && <CatalogoView />}
          </>
        )}
      </main>
      {drawer && <MovDrawer initial={drawer} onClose={() => setDrawer(null)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default function App() {
  return (
    <ContabilidadProvider>
      <Shell />
    </ContabilidadProvider>
  )
}
