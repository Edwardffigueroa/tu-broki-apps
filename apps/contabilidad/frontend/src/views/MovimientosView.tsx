import {
  CATS,
  PUC_ING,
  SERVICIOS,
  catOf,
  fmtDate,
  mLong,
  money,
  monthsInData,
  svc,
} from '@finanzas'
import { useContabilidad } from '../state/ContabilidadStore'
import type { Movimiento } from '../lib/types'

export function MovimientosView({
  onNew,
  onEdit,
}: {
  onNew: (tipo: 'ingreso' | 'gasto') => void
  onEdit: (m: Movimiento) => void
}) {
  const { movs, cfg, filt, setFilt, exportCsv, showToast } = useContabilidad()
  const ms = monthsInData(movs).slice().reverse()
  let list = movs.slice()
  if (filt.tipo) list = list.filter((m) => m.tipo === filt.tipo)
  if (filt.mes) list = list.filter((m) => (m.fecha || '').slice(0, 7) === filt.mes)
  if (filt.estado) {
    list = list.filter((m) =>
      filt.estado === 'fecha' ? m.fechaPendiente : m.estado === filt.estado,
    )
  }
  if (filt.cat) {
    list = list.filter((m) =>
      m.tipo === 'ingreso' ? m.servicio === filt.cat : m.categoria === filt.cat,
    )
  }
  if (filt.q) {
    const q = filt.q.toLowerCase()
    list = list.filter((m) =>
      [m.concepto, m.tercero, m.notas, m.quien, svc(m.servicio, cfg)?.nombre, m.categoria]
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }
  list.sort(
    (a, b) =>
      (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || 0) - (a.creado || 0),
  )
  const tI = list.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + (+m.monto || 0), 0)
  const tG = list.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + (+m.monto || 0), 0)

  return (
    <>
      <div className="top">
        <div>
          <h1>Movimientos</h1>
          <p className="lede">
            Libro diario de TuBroki. Los ingresos se registran con IVA incluido; el sistema separa el
            IVA y el costo directo del servicio.
          </p>
        </div>
        <div className="controls">
          <button className="btn pri" type="button" onClick={() => onNew('ingreso')}>
            + Ingreso
          </button>
          <button className="btn" type="button" onClick={() => onNew('gasto')}>
            + Gasto
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => void exportCsv().catch((e) => showToast(e.message || 'Error'))}
          >
            Exportar CSV
          </button>
        </div>
      </div>
      <div className="filters">
        <input
          type="search"
          placeholder="Buscar concepto, cliente, proveedor…"
          value={filt.q}
          aria-label="Buscar"
          onChange={(e) => setFilt({ q: e.target.value })}
        />
        <select
          aria-label="Tipo"
          value={filt.tipo}
          onChange={(e) => setFilt({ tipo: e.target.value })}
        >
          <option value="">Ingresos y gastos</option>
          <option value="ingreso">Solo ingresos</option>
          <option value="gasto">Solo gastos</option>
        </select>
        <select aria-label="Mes" value={filt.mes} onChange={(e) => setFilt({ mes: e.target.value })}>
          <option value="">Todos los meses</option>
          {ms.map((k) => (
            <option key={k} value={k}>
              {mLong(k)}
            </option>
          ))}
        </select>
        <select
          aria-label="Servicio o cuenta"
          value={filt.cat}
          onChange={(e) => setFilt({ cat: e.target.value })}
        >
          <option value="">Todos los servicios y cuentas</option>
          <optgroup label="Servicios (ingresos)">
            {SERVICIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.n}. {s.nombre}
              </option>
            ))}
          </optgroup>
          <optgroup label="Cuentas de gasto">
            {CATS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </optgroup>
        </select>
        <select
          aria-label="Estado"
          value={filt.estado}
          onChange={(e) => setFilt({ estado: e.target.value })}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente (por cobrar / pagar)</option>
          <option value="pagado">Cobrado / pagado</option>
          <option value="fecha">Fecha por confirmar</option>
        </select>
      </div>
      {list.length ? (
        <>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Cuenta</th>
                  <th>Concepto</th>
                  <th>Pagó / recibió</th>
                  <th>Estado</th>
                  <th className="n">Monto</th>
                </tr>
              </thead>
              <tbody>
                {list.map((m) => {
                  const isI = m.tipo === 'ingreso'
                  const s = isI ? svc(m.servicio, cfg) : null
                  const c = !isI ? catOf(m.categoria) : null
                  return (
                    <tr key={m.id} className="clickable" onClick={() => onEdit(m)}>
                      <td className="num">
                        {fmtDate(m.fecha)}
                        {m.fechaPendiente ? (
                          <span className="cell-sub flag">Fecha por confirmar</span>
                        ) : null}
                      </td>
                      <td>
                        <span className="puc">{isI ? PUC_ING : c!.puc}</span>
                      </td>
                      <td>
                        {m.concepto || (s ? s.nombre : '')}
                        <span className="cell-sub">
                          {isI
                            ? `${s ? s.nombre : 'Servicio'}${+(m.cantidad || 0) > 1 ? ` × ${m.cantidad}` : ''}`
                            : c!.nombre}
                          {m.tercero ? ` · ${m.tercero}` : ''}
                        </span>
                      </td>
                      <td>{m.quien || ''}</td>
                      <td>
                        {isI ? (
                          m.estado === 'pendiente' ? (
                            <span className="pill warn">Por cobrar</span>
                          ) : (
                            <span className="pill ok">Cobrado</span>
                          )
                        ) : m.estado === 'pendiente' ? (
                          <span className="pill warn">Por pagar</span>
                        ) : (
                          <span className="pill neutral">Pagado</span>
                        )}
                      </td>
                      <td className={`n ${isI ? '' : 'neg'}`}>
                        {isI ? money(+m.monto) : money(-m.monto!)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="sumrow">
            <span>{list.length} movimientos</span>
            <span>
              Ingresos <b>{money(tI)}</b>
            </span>
            <span>
              Gastos <b className="neg">{money(-tG)}</b>
            </span>
            <span>
              Neto <b className={tI - tG < 0 ? 'neg' : ''}>{money(tI - tG)}</b>
            </span>
          </div>
        </>
      ) : (
        <div className="panel empty">
          <h3>
            {movs.length
              ? 'Ningún movimiento coincide con los filtros'
              : 'Aún no hay movimientos'}
          </h3>
          <p>
            {movs.length
              ? 'Prueba con otro mes o limpia la búsqueda.'
              : 'Registra el primer ingreso o gasto con los botones de arriba.'}
          </p>
        </div>
      )}
      <p className="note">
        Montos entre paréntesis = salidas de dinero. Códigos según el PUC colombiano: 4155 ingresos,
        51xx gastos, 5235 servicios.
      </p>
    </>
  )
}
