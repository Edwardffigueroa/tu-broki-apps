import { useMemo } from 'react'
import {
  CATS,
  PUC_COSTO,
  PUC_ING,
  curMonthKey,
  fijoMes,
  mLabel,
  money,
  monthsInData,
  pct,
  pnl,
} from '@finanzas'
import { useContabilidad } from '../state/ContabilidadStore'

type Pnl = ReturnType<typeof pnl>

function Cell({ v }: { v: number }) {
  if (v === 0) return <td className="n muted">—</td>
  return <td className={`n ${v < 0 ? 'neg' : ''}`}>{money(v)}</td>
}

function Row({
  lbl,
  fn,
  all,
  cls = '',
  puc = '',
}: {
  lbl: string
  fn: (r: Pnl) => number
  all: Pnl[]
  cls?: string
  puc?: string
}) {
  return (
    <tr className={cls}>
      <td>
        {puc ? <span className="puc">{puc}</span> : null} {lbl}
      </td>
      {all.map((r, i) => (
        <Cell key={i} v={fn(r)} />
      ))}
    </tr>
  )
}

export function ResultadosView() {
  const { movs, cfg, period, setPeriod } = useContabilidad()
  const now = useMemo(() => new Date(), [])
  const cur = curMonthKey(now)
  const year = /(\d{4})/.exec(period)?.[1] ?? String(now.getFullYear())
  const years = [...new Set([year, ...monthsInData(movs, now).map((k) => k.slice(0, 4))])]
    .sort()
    .reverse()
  const ms: string[] = []
  for (let m = 1; m <= 12; m++) {
    const k = `${year}-${String(m).padStart(2, '0')}`
    if (k <= cur || movs.some((x) => (x.fecha || '').startsWith(k))) ms.push(k)
  }
  const firstData = movs
    .filter((m) => (m.fecha || '').startsWith(year))
    .map((m) => m.fecha!.slice(0, 7))
    .sort()[0]
  const cols = ms.filter((k) => !firstData || k >= firstData)
  const per = cols.map((k) =>
    pnl(
      movs.filter((m) => m.fecha && m.fecha.slice(0, 7) === k),
      cfg,
    ),
  )
  const tot = pnl(
    movs.filter((m) => (m.fecha || '').startsWith(year)),
    cfg,
  )
  const all = [...per, tot]
  const catsUsed = CATS.filter((c) => all.some((r) => r.gastosCat[c.id]))
  const F = fijoMes(cfg)

  return (
    <>
      <div className="top">
        <div>
          <h1>Estado de resultados</h1>
          <p className="lede">
            P&G mensual del {year}, de ventas a utilidad neta. La renta se provisiona solo sobre
            meses con utilidad.
          </p>
        </div>
        <div className="controls">
          <select
            aria-label="Año"
            value={year}
            onChange={(e) => setPeriod(`y:${e.target.value}`)}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="tbl-wrap">
        <table className="pl">
          <thead>
            <tr>
              <th>Cuenta</th>
              {cols.map((k) => (
                <th key={k} className="n">
                  {mLabel(k)}
                </th>
              ))}
              <th className="n">Total {year}</th>
            </tr>
          </thead>
          <tbody>
            <Row all={all} lbl="Ventas brutas (con IVA)" fn={(r) => r.ventasBrutas} cls="ind" />
            <Row all={all} lbl="(–) IVA generado" fn={(r) => -r.iva} cls="ind" puc="2408" />
            <Row
              all={all}
              lbl="Ingresos operacionales netos"
              fn={(r) => r.ventas}
              cls="sec"
              puc={PUC_ING}
            />
            <Row
              all={all}
              lbl="(–) Costos variables (antecedentes, firma, notificaciones, 4x1000, Wompi)"
              fn={(r) => -r.costos}
              cls="ind"
              puc={PUC_COSTO}
            />
            <Row all={all} lbl="Margen de contribución" fn={(r) => r.utilBruta} cls="sec" />
            <tr className="pct">
              <td>% margen de contribución</td>
              {all.map((r, i) => (
                <td key={i} className="n">
                  {r.ventas ? pct(r.utilBruta / r.ventas) : '—'}
                </td>
              ))}
            </tr>
            {catsUsed.map((c) => (
              <Row
                key={c.id}
                all={all}
                lbl={`(–) ${c.nombre}`}
                fn={(r) => -(r.gastosCat[c.id] || 0)}
                cls="ind"
                puc={c.puc}
              />
            ))}
            <Row all={all} lbl="Total gastos registrados" fn={(r) => -r.gastos} cls="sec" />
            <Row all={all} lbl="Utilidad operacional (EBITDA)" fn={(r) => r.utilOp} cls="sec" />
            <tr className="pct">
              <td>Margen operacional</td>
              {all.map((r, i) => (
                <td key={i} className="n">
                  {r.ventas ? pct(r.utilOp / r.ventas) : '—'}
                </td>
              ))}
            </tr>
            <Row
              all={all}
              lbl={`(–) ICA Cali (${pct(cfg.ica, 1)} de ingresos)`}
              fn={(r) => -r.ica}
              cls="ind"
              puc="5115"
            />
            <Row all={all} lbl="Utilidad antes de impuestos" fn={(r) => r.uai} cls="ind" />
            <Row
              all={all}
              lbl={`(–) Provisión impuesto de renta (${pct(cfg.renta, 0)})`}
              fn={(r) => -r.renta}
              cls="ind"
              puc="5405"
            />
            <Row all={all} lbl="Utilidad neta" fn={(r) => r.utilNeta} cls="total" />
          </tbody>
        </table>
      </div>

      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 16, margin: '28px 0 4px' }}>
        Cobertura de costos
      </h2>
      <p className="lede" style={{ margin: '0 0 12px' }}>
        Margen de contribución contra costos fijos presupuestados ({money(F)}/mes) + marketing.
      </p>
      <div className="tbl-wrap">
        <table className="pl">
          <thead>
            <tr>
              <th>Concepto</th>
              {cols.map((k) => (
                <th key={k} className="n">
                  {mLabel(k)}
                </th>
              ))}
              <th className="n">Total {year}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Margen de contribución</td>
              {all.map((r, i) => (
                <Cell key={i} v={r.utilBruta} />
              ))}
            </tr>
            <tr className="ind">
              <td>(–) Costos fijos presupuestados</td>
              {cols.map((_, i) => (
                <Cell key={i} v={-F} />
              ))}
              <Cell v={-F * cols.length} />
            </tr>
            <tr className="ind">
              <td>
                <span className="puc">523560</span> (–) Inversión en marketing (CAC)
              </td>
              {all.map((r, i) => (
                <Cell key={i} v={-r.mkt} />
              ))}
            </tr>
            <tr className="total">
              <td>Falta (–) o sobra</td>
              {all.map((r, i) => (
                <Cell
                  key={i}
                  v={r.utilBruta - r.mkt - F * (i === cols.length ? cols.length : 1)}
                />
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 16, margin: '28px 0 4px' }}>
        Adquisición de clientes (CAC)
      </h2>
      <div className="tbl-wrap">
        <table className="pl">
          <thead>
            <tr>
              <th>Indicador</th>
              {cols.map((k) => (
                <th key={k} className="n">
                  {mLabel(k)}
                </th>
              ))}
              <th className="n">Total {year}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Inversión en marketing</td>
              {all.map((r, i) => (
                <Cell key={i} v={r.mkt} />
              ))}
            </tr>
            <tr>
              <td>Clientes nuevos</td>
              {all.map((r, i) => (
                <td key={i} className="n">
                  {r.nNuevos || <span className="muted">—</span>}
                </td>
              ))}
            </tr>
            <tr className="sec">
              <td>CAC real</td>
              {all.map((r, i) => (
                <td
                  key={i}
                  className={`n ${Number.isFinite(r.cacReal) && r.cacReal > r.cacObjProm ? 'neg' : ''}`}
                >
                  {Number.isFinite(r.cacReal) ? money(r.cacReal) : <span className="muted">—</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="note">
        Costos variables = Truora, firma, notificaciones, 4x1000 y Wompi. Mano de obra y portales
        son fijos. Impuestos son estimaciones de gestión.
      </p>
    </>
  )
}
