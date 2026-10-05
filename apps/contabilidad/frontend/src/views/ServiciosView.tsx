import {
  LINEAS,
  SERVICIOS,
  inPeriod,
  marginAfterCac,
  money,
  netOf,
  pct,
  periodLabel,
  pnl,
  short,
  svc,
  unitMargin,
} from '@finanzas'
import { PeriodSelect } from '../components/PeriodSelect'
import { useContabilidad } from '../state/ContabilidadStore'

export function ServiciosView() {
  const { movs, cfg, period, setPeriod } = useContabilidad()
  const list = movs.filter((m) => inPeriod(m, period))
  const r = pnl(list, cfg)
  const totMC = Object.values(r.porServ).reduce((s, v) => s + (v.neto - v.costo), 0)
  const rows = SERVICIOS.map((b) => {
    const s = svc(b.id, cfg)
    const v = r.porServ[b.id] || { u: 0, neto: 0, costo: 0 }
    return { s, v, mc: v.neto - v.costo }
  }).sort((a, b) => b.mc - a.mc || a.s.n - b.s.n)
  const maxMC = Math.max(1, ...rows.map((x) => x.mc))
  const byLine = LINEAS.map((l) => {
    let n = 0
    let c = 0
    let u = 0
    for (const [id, v] of Object.entries(r.porServ)) {
      if (svc(id, cfg)?.linea === l) {
        n += v.neto
        c += v.costo
        u += v.u
      }
    }
    return { l, n, mc: n - c, u }
  })
  const maxL = Math.max(1, ...byLine.map((x) => x.n))

  return (
    <>
      <div className="top">
        <div>
          <h1>Rentabilidad por servicio</h1>
          <p className="lede">
            Cuánto deja cada servicio y comisión: por unidad (catálogo) y en lo vendido en{' '}
            {periodLabel(period).toLowerCase()}.
          </p>
        </div>
        <div className="controls">
          <PeriodSelect period={period} movs={movs} onChange={setPeriod} />
        </div>
      </div>
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <div className="kpi">
          <span className="lbl">Ventas netas</span>
          <span className="val">{money(r.ventas)}</span>
          <span className="foot">{r.unidades} unidades vendidas</span>
        </div>
        <div className="kpi">
          <span className="lbl">Margen de contribución</span>
          <span className={`val ${r.utilBruta < 0 ? 'neg' : ''}`}>{money(r.utilBruta)}</span>
          <span className="foot">{pct(r.mcPct)} de las ventas netas</span>
        </div>
        <div className="kpi">
          <span className="lbl">Ticket promedio</span>
          <span className="val">
            {r.nVentas ? money(r.ventasBrutas / r.nVentas) : '—'}
          </span>
          <span className="foot">Con IVA, por venta registrada</span>
        </div>
        <div className="kpi">
          <span className="lbl">Servicios activos</span>
          <span className="val">
            {Object.keys(r.porServ).length}{' '}
            <small className="muted" style={{ fontSize: 13 }}>
              de {SERVICIOS.length}
            </small>
          </span>
          <span className="foot">Con al menos una venta</span>
        </div>
      </div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>Ventas por línea de negocio</h2>
        <p className="hint">Ventas netas y margen por línea.</p>
        <div className="hbars">
          {byLine.map((x) => (
            <div className="hbar" key={x.l}>
              <span className="t">
                {x.l} <span className="muted">· {x.u} unid.</span>
              </span>
              <span className="v">
                {short(x.n)} · margen {short(x.mc)}
              </span>
              <div className="track">
                <div className="fill" style={{ width: `${(x.n / maxL) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Servicio</th>
              <th className="n">Precio</th>
              <th className="n">Margen / unidad</th>
              <th className="n">CAC</th>
              <th className="n">Margen desp. CAC</th>
              <th className="n">Unid.</th>
              <th className="n">Ventas netas</th>
              <th className="n">Margen real</th>
              <th>Aporte</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ s, v, mc }) => {
              const um = unitMargin(s, cfg)
              const up = s.precio ? um / netOf(s.precio, cfg) : NaN
              const ms = r.mktServ[s.id] || 0
              const n = r.porServ[s.id]?.n || 0
              return (
                <tr key={s.id}>
                  <td className="num muted">{s.n}</td>
                  <td style={{ minWidth: 210 }}>
                    {s.nombre}
                    {s.interno ? <span className="pill neutral"> interno</span> : null}
                    <span className="cell-sub">
                      {s.linea} · {s.para}
                    </span>
                  </td>
                  <td className="n">{s.precio ? money(s.precio) : 'Gratis'}</td>
                  <td className={`n ${um < 0 ? 'neg' : ''}`}>
                    {money(um)}
                    <span className="cell-sub">{s.precio ? pct(up, 0) : ''}</span>
                  </td>
                  <td className="n">
                    {s.cac ? money(s.cac) : <span className="muted">$0</span>}
                    {ms ? (
                      <span className={`cell-sub ${n && ms / n > s.cac ? 'neg' : ''}`}>
                        real {n ? money(ms / n) : 'sin ventas'}
                      </span>
                    ) : null}
                  </td>
                  <td className={`n ${marginAfterCac(s, cfg) < 0 ? 'neg' : ''}`}>
                    {money(marginAfterCac(s, cfg))}
                  </td>
                  <td className="n">{v.u || <span className="muted">0</span>}</td>
                  <td className="n">
                    {v.neto ? money(v.neto) : <span className="muted">—</span>}
                  </td>
                  <td className={`n ${mc < 0 ? 'neg' : ''}`}>
                    {mc ? money(mc) : <span className="muted">—</span>}
                  </td>
                  <td style={{ minWidth: 120 }}>
                    {mc > 0 ? (
                      <>
                        <div className="progress" style={{ height: 6 }}>
                          <div className="bar" style={{ width: `${(mc / maxMC) * 100}%` }} />
                        </div>
                        <span className="cell-sub">
                          {pct(totMC ? mc / totMC : 0, 0)} del margen
                        </span>
                      </>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
