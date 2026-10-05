import { useMemo, useState } from 'react'
import {
  addMonths,
  catOf,
  curMonthKey,
  fijoMes,
  fmtDate,
  goalStatus,
  inPeriod,
  mLabel,
  mLong,
  marginAfterCac,
  metaTotal,
  money,
  monthsCount,
  niceStep,
  pct,
  periodLabel,
  pnl,
  short,
  svc,
  unitMargin,
} from '@finanzas'
import { PeriodSelect } from '../components/PeriodSelect'
import { useContabilidad } from '../state/ContabilidadStore'
import type { Movimiento } from '../lib/types'

function roundTop(x: number, top: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2)
  return `M${x},${top + h}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${top + h}Z`
}

function Chart({ movs, cfg }: { movs: Movimiento[]; cfg: unknown }) {
  const cur = curMonthKey()
  const months: string[] = []
  for (let i = 7; i >= 0; i--) months.push(addMonths(cur, -i))
  const data = months.map((k) => {
    const r = pnl(
      movs.filter((m) => m.fecha && m.fecha.slice(0, 7) === k),
      cfg,
    )
    return { k, inc: r.ventas, out: r.costos + r.gastos, op: r.utilOp }
  })
  const W = 640
  const H = 240
  const pl = 56
  const pr = 10
  const pt = 12
  const pb = 28
  let max = Math.max(1, ...data.map((d) => Math.max(d.inc, d.out, d.op)))
  let min = Math.min(0, ...data.map((d) => d.op))
  const step = niceStep((max - min) / 4)
  max = Math.ceil(max / step) * step
  min = Math.floor(min / step) * step
  const y = (v: number) => pt + ((max - v) / (max - min)) * (H - pt - pb)
  const gw = (W - pl - pr) / data.length
  const bw = Math.min(18, (gw - 14) / 2)
  const [tip, setTip] = useState<{ html: string; x: number; y: number } | null>(null)

  const grid: string[] = []
  for (let v = min; v <= max + 1; v += step) {
    grid.push(
      `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"${v === 0 ? '' : ' stroke-dasharray="2 4"'}/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" font-size="10.5" fill="var(--muted)">${short(v).replace('$', '')}</text>`,
    )
  }
  let bars = ''
  const pts: [number, number][] = []
  let hits = ''
  data.forEach((d, i) => {
    const cx = pl + gw * i + gw / 2
    const bar = (x: number, v: number, col: string) => {
      const h = Math.abs(y(v) - y(0))
      if (h < 0.5) return ''
      const top = Math.min(y(v), y(0))
      return `<path d="${roundTop(x, top, bw, h)}" fill="${col}"/>`
    }
    bars += bar(cx - bw - 1, d.inc, 'var(--s-in)') + bar(cx + 1, d.out, 'var(--s-out)')
    pts.push([cx, y(d.op)])
    grid.push(
      `<text x="${cx}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${d.k === cur ? 'var(--ink)' : 'var(--muted)'}" font-weight="${d.k === cur ? 600 : 400}">${mLabel(d.k)}</text>`,
    )
    hits += `<rect x="${pl + gw * i}" y="${pt}" width="${gw}" height="${H - pt - pb}" fill="transparent" data-i="${i}"/>`
  })
  const line =
    `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>` +
    pts
      .map(
        (p) =>
          `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="var(--ink)" stroke="var(--surface)" stroke-width="2"/>`,
      )
      .join('')

  return (
    <div className="chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Ventas netas, egresos y utilidad operacional por mes"
        dangerouslySetInnerHTML={{ __html: grid.join('') + bars + line + hits }}
        onMouseMove={(e) => {
          const t = (e.target as Element).closest('rect[data-i]')
          if (!t) {
            setTip(null)
            return
          }
          const d = data[+t.getAttribute('data-i')!]
          const wr = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
          let x = e.clientX - wr.left + 14
          if (x + 190 > wr.width) x = e.clientX - wr.left - 194
          setTip({
            html: `<b>${mLong(d.k)}</b><div><span>Ventas netas</span><span>${money(d.inc)}</span></div><div><span>Egresos</span><span>${money(d.out)}</span></div><div><span>Utilidad op.</span><span>${money(d.op)}</span></div>`,
            x,
            y: Math.max(0, e.clientY - wr.top - 40),
          })
        }}
        onMouseLeave={() => setTip(null)}
      />
      {tip && (
        <div className="tip" style={{ left: tip.x, top: tip.y }} dangerouslySetInnerHTML={{ __html: tip.html }} />
      )}
    </div>
  )
}

export function ResumenView({
  onNew,
  onEdit,
}: {
  onNew: (tipo: 'ingreso' | 'gasto') => void
  onEdit: (m: Movimiento) => void
}) {
  const { movs, cfg, period, setPeriod, setView, metas } = useContabilidad()
  const now = useMemo(() => new Date(), [])
  const cur = curMonthKey(now)
  const list = movs.filter((m) => inPeriod(m, period))
  const r = pnl(list, cfg)
  const F = fijoMes(cfg)
  const nm = monthsCount(movs, period)
  const v03ref = svc('v03', cfg)
  const ratio =
    r.ventasBrutas > 0
      ? r.utilBruta / r.ventasBrutas
      : v03ref.precio > 0
        ? unitMargin(v03ref, cfg) / v03ref.precio
        : NaN
  const peBruto = ratio > 0 ? F / ratio : NaN

  const c = (() => {
    const rr = pnl(
      movs.filter((m) => m.fecha && m.fecha.slice(0, 7) === cur),
      cfg,
    )
    const need = F + rr.mkt
    return {
      r: rr,
      F,
      mkt: rr.mkt,
      need,
      mc: rr.utilBruta,
      falta: need - rr.utilBruta,
      cov: need ? rr.utilBruta / need : 0,
    }
  })()
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const left = dim - now.getDate() + 1
  const eq = (['v03', 'v02', 'v09', 'v04'] as const)
    .map((id) => svc(id, cfg))
    .filter((s) => marginAfterCac(s, cfg) > 0)
    .map((s) => ({ s, n: Math.ceil(Math.max(0, c.falta) / marginAfterCac(s, cfg)) }))
  const v03 = svc('v03', cfg)
  const ratioCac = v03.precio > 0 ? marginAfterCac(v03, cfg) / v03.precio : NaN
  const brutas = ratioCac > 0 ? Math.max(0, c.falta) / ratioCac : NaN
  const ok = c.falta <= 0
  const st = ok ? 'ok' : c.cov >= 0.5 ? 'warn' : 'bad'

  const mt = metas[cur]
  const rm = pnl(
    movs.filter((m) => m.fecha && m.fecha.slice(0, 7) === cur),
    cfg,
  )

  const mix = Object.entries(r.porServ)
    .map(([id, v]) => ({ s: svc(id, cfg), ...(v as { u: number; neto: number; bruto: number; costo: number; n: number }) }))
    .filter((x) => x.s)
    .sort((a, b) => b.neto - a.neto)
  const maxMix = Math.max(1, ...mix.map((x) => x.neto))
  const gc = Object.entries(r.gastosCat).sort((a, b) => (b[1] as number) - (a[1] as number))
  const maxG = Math.max(1, ...gc.map((x) => x[1] as number))

  const insights: [string, string, string][] = []
  const mu = unitMargin(v03ref, cfg)
  if (!list.length) insights.push(['info', 'i', 'Sin movimientos en este periodo.'])
  else {
    if (r.utilOp < 0) {
      const equiv =
        mu > 0
          ? ` Cubrirlo equivale a <b>${Math.ceil(-r.utilOp / mu)} ventas más de "Todo para arrendar"</b> (deja ${money(mu)} de margen cada una).`
          : ''
      insights.push([
        'bad',
        '!',
        `Este periodo <b>perdemos ${money(-r.utilOp)}</b> a nivel operacional.${equiv}`,
      ])
    } else {
      insights.push([
        'ok',
        '✓',
        `La operación deja <b>${money(r.utilOp)}</b> de utilidad operacional (${pct(r.ventas ? r.utilOp / r.ventas : NaN)} de las ventas netas).`,
      ])
    }
    if (r.ventas > 0) {
      insights.push([
        r.mcPct >= 0.8 ? 'ok' : 'warn',
        '%',
        `Por cada $100 que vendemos sin IVA, <b>$${Math.round(r.mcPct * 100)} quedan</b> después de los costos variables.`,
      ])
    }
    const mkt = r.gastosCat['Marketing'] || 0
    if (mkt > 0) {
      if (r.nNuevos) {
        const over = Number.isFinite(r.cacObjProm) && r.cacReal > r.cacObjProm
        insights.push([
          over ? 'warn' : 'ok',
          '$',
          `CAC real: <b>${money(r.cacReal)}</b> por cliente nuevo (${money(mkt)} ÷ ${r.nNuevos}). Objetivo ${money(r.cacObjProm)}. ${over ? 'Revisar canal antes de subir pauta.' : 'Dentro del objetivo.'}`,
        ])
      } else {
        insights.push([
          'warn',
          '$',
          `Hay <b>${money(mkt)}</b> en marketing y ningún cliente nuevo en el periodo.`,
        ])
      }
    }
    const pend = movs.filter((m) => m.fechaPendiente).length
    if (pend) {
      insights.push([
        'warn',
        '?',
        `<b>${pend} movimientos</b> tienen fecha por confirmar.`,
      ])
    }
    const burn = r.gastos / nm
    if (r.utilOp < 0) {
      insights.push([
        'info',
        '◷',
        `Gasto operacional promedio: <b>${money(burn)}/mes</b>. Costos fijos presupuestados: ${money(F)}/mes.`,
      ])
    }
  }

  const pend = movs
    .filter((m) => m.estado === 'pendiente')
    .sort((a, b) => (+b.monto || 0) - (+a.monto || 0))

  return (
    <>
      <div className="top">
        <div>
          <h1>Resumen financiero</h1>
          <p className="lede">
            {periodLabel(period)} · cifras en pesos colombianos, ventas netas sin IVA.
          </p>
        </div>
        <div className="controls">
          <PeriodSelect period={period} movs={movs} onChange={setPeriod} />
          <button className="btn pri" type="button" onClick={() => onNew('ingreso')}>
            + Ingreso
          </button>
          <button className="btn" type="button" onClick={() => onNew('gasto')}>
            + Gasto
          </button>
        </div>
      </div>

      {!movs.length ? (
        <div className="panel empty">
          <h3>Aún no hay movimientos</h3>
          <p>
            Registra la primera venta o el primer gasto, y aquí verás utilidad, márgenes y avance de
            metas.
          </p>
          <button className="btn pri" type="button" onClick={() => onNew('ingreso')}>
            Registrar primer ingreso
          </button>
        </div>
      ) : (
        <>
          <div className="panel cover">
            <div className="cover-main">
              <span className="eyebrow">Costos de {mLong(cur)}</span>
              <div className={`cover-big ${ok ? 'pos' : 'neg'}`}>
                {ok ? 'Cubiertos' : `Faltan ${money(c.falta)}`}
              </div>
              <p className="mini" style={{ margin: 0 }}>
                {ok ? (
                  <>
                    Este mes sobran <b>{money(-c.falta)}</b> después de pagar costos fijos y
                    marketing.
                  </>
                ) : (
                  'Es lo que falta en margen de contribución para pagar los costos fijos del mes y lo invertido en marketing.'
                )}
              </p>
              <div className="progress" style={{ height: 12, marginTop: 6 }}>
                <div
                  className={`bar ${st}`}
                  style={{ width: `${Math.max(0, Math.min(100, c.cov * 100))}%` }}
                />
              </div>
              <div className="cover-row">
                <span>
                  Cubierto <b>{money(Math.max(0, c.mc))}</b> · {pct(Math.max(0, c.cov), 0)}
                </span>
                <span>
                  Fijos <b>{money(c.F)}</b>
                  {c.mkt ? (
                    <>
                      {' '}
                      + marketing <b>{money(c.mkt)}</b>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
            <div className="cover-side">
              {ok ? (
                <p className="mini" style={{ margin: 0 }}>
                  Todo lo que vendan de aquí al cierre del mes es utilidad, descontando solo sus
                  costos variables.
                </p>
              ) : (
                <>
                  <p className="mini" style={{ margin: 0 }}>
                    {Number.isFinite(brutas) ? (
                      <>
                        Para cubrirlo en los <b>{left} días</b> que quedan necesitan vender cerca de{' '}
                        <b>{money(brutas)}</b> con IVA (unos {money(brutas / left)} por día).
                        Equivale a cualquiera de estas opciones, ya descontando el CAC:
                      </>
                    ) : (
                      <>
                        Quedan <b>{left} días</b>. Revisa el precio y costo de &quot;Todo para
                        arrendar&quot; en Catálogo para estimar cuánto vender.
                      </>
                    )}
                  </p>
                  <ul className="eqlist">
                    {eq.map((x) => (
                      <li key={x.s.id}>
                        <b>{x.n}</b>
                        <span>
                          × {x.s.nombre}
                          <span className="cell-sub">
                            deja {money(marginAfterCac(x.s, cfg))} c/u después de CAC
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <button
                className="btn ghost"
                type="button"
                style={{ paddingLeft: 0, alignSelf: 'flex-start' }}
                onClick={() => setView('catalogo')}
              >
                Ver detalle de costos fijos →
              </button>
            </div>
          </div>

          <div className="grid kpis" style={{ marginTop: 16 }}>
            <div className="kpi">
              <span className="lbl">Ventas netas</span>
              <span className="val">{money(r.ventas)}</span>
              <span className="foot">
                {r.nVentas} ventas · con IVA {short(r.ventasBrutas)}
              </span>
            </div>
            <div className="kpi">
              <span className="lbl">Margen de contribución</span>
              <span className={`val ${r.utilBruta < 0 ? 'neg' : ''}`}>{money(r.utilBruta)}</span>
              <span className="foot">{pct(r.mcPct)} de las ventas netas</span>
            </div>
            <div className="kpi">
              <span className="lbl">Utilidad operacional</span>
              <span className={`val ${r.utilOp < 0 ? 'neg' : ''}`}>{money(r.utilOp)}</span>
              <span className="foot">Con gastos registrados ({short(r.gastos)})</span>
            </div>
            <div className="kpi">
              <span className="lbl">CAC real</span>
              <span
                className={`val ${Number.isFinite(r.cacReal) && Number.isFinite(r.cacObjProm) && r.cacReal > r.cacObjProm ? 'neg' : ''}`}
              >
                {Number.isFinite(r.cacReal) ? money(r.cacReal) : r.mkt ? 'Sin clientes' : '$0'}
              </span>
              <span className="foot">
                {short(r.mkt)} en marketing ÷ {r.nNuevos} clientes nuevos
                {Number.isFinite(r.cacObjProm) ? ` · objetivo ${short(r.cacObjProm)}` : ''}
              </span>
            </div>
            <div className="kpi">
              <span className="lbl">Caja del periodo</span>
              <span className={`val ${r.caja < 0 ? 'neg' : ''}`}>{money(r.caja)}</span>
              <span className="foot">
                Por cobrar {short(r.porCobrar)} · por pagar {short(r.porPagar)}
              </span>
            </div>
            <div className="kpi">
              <span className="lbl">Punto de equilibrio</span>
              <span className="val">
                {Number.isFinite(peBruto) ? short(peBruto) : '—'}
                <small className="muted" style={{ fontSize: 13 }}>
                  {' '}
                  /mes
                </small>
              </span>
              <span className="foot">
                Ventas con IVA para cubrir {short(F)} de costos fijos
              </span>
            </div>
          </div>

          <div className="grid two" style={{ marginTop: 16 }}>
            <div className="panel">
              <h2>Ingresos vs. egresos por mes</h2>
              <p className="hint">Últimos 8 meses. Egresos = costos variables + gastos registrados.</p>
              <div className="legend">
                <span>
                  <i style={{ background: 'var(--s-in)' }} />
                  Ventas netas
                </span>
                <span>
                  <i style={{ background: 'var(--s-out)' }} />
                  Egresos
                </span>
                <span>
                  <i style={{ background: 'var(--ink)', borderRadius: '50%' }} />
                  Utilidad operacional
                </span>
              </div>
              <Chart movs={movs} cfg={cfg} />
            </div>
            <div className="panel">
              <h2>Lectura del CFO</h2>
              <p className="hint">Lo que dicen los números de {periodLabel(period).toLowerCase()}.</p>
              <ul className="insights">
                {insights.map(([kind, ico, html], i) => (
                  <li key={i}>
                    <span className={`ico ${kind}`}>{ico}</span>
                    <span dangerouslySetInnerHTML={{ __html: html }} />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="grid cols2" style={{ marginTop: 16 }}>
            <div className="panel">
              <h2>Meta de {mLong(cur)}</h2>
              <p className="hint">Ventas brutas del mes contra la meta que definieron.</p>
              {mt && metaTotal(mt, cfg) > 0 ? (
                (() => {
                  const tgt = metaTotal(mt, cfg)
                  const p = rm.ventasBrutas / tgt
                  const pace = (() => {
                    const d = now.getDate()
                    return d / dim
                  })()
                  const proj = pace > 0 ? rm.ventasBrutas / pace : 0
                  const gst = goalStatus(proj / tgt)
                  return (
                    <div className="goal">
                      <div className="row">
                        <span className="big">{money(rm.ventasBrutas)}</span>
                        <span className="mini">
                          de {money(tgt)} · {pct(p, 0)}
                        </span>
                      </div>
                      <div className="progress">
                        <div className={`bar ${gst.c}`} style={{ width: `${Math.min(100, p * 100)}%` }} />
                        <div className="pace" style={{ left: `${pace * 100}%` }} />
                      </div>
                      <div className="row mini">
                        <span className={`pill ${gst.c}`}>{gst.t}</span>
                        <span>
                          Proyección al cierre: <b>{money(proj)}</b>
                        </span>
                      </div>
                      <button
                        className="btn ghost"
                        type="button"
                        style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
                        onClick={() => setView('metas')}
                      >
                        Ver metas por servicio →
                      </button>
                    </div>
                  )
                })()
              ) : (
                <>
                  <p className="mini">No hay meta para {mLong(cur)}.</p>
                  <button className="btn" type="button" onClick={() => setView('metas')}>
                    Definir meta del mes
                  </button>
                </>
              )}
            </div>
            <div className="panel">
              <h2>Qué servicios venden más</h2>
              <p className="hint">Ventas netas por servicio en el periodo.</p>
              <div className="hbars">
                {mix.length ? (
                  mix.slice(0, 6).map((x) => (
                    <div className="hbar" key={x.s.id}>
                      <span className="t">
                        {x.s.nombre} <span className="muted">× {x.u}</span>
                      </span>
                      <span className="v">{short(x.neto)}</span>
                      <div className="track">
                        <div className="fill" style={{ width: `${(x.neto / maxMix) * 100}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="mini">Sin ventas en el periodo.</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid cols2" style={{ marginTop: 16 }}>
            <div className="panel">
              <h2>En qué se va el dinero</h2>
              <p className="hint">Gastos operacionales por cuenta.</p>
              <div className="hbars">
                {gc.length ? (
                  gc.map(([cat, v]) => (
                    <div className="hbar" key={cat}>
                      <span className="t">
                        {catOf(cat).nombre} <span className="puc">{catOf(cat).puc}</span>
                      </span>
                      <span className="v">
                        {short(v as number)} · {pct((v as number) / r.gastos, 0)}
                      </span>
                      <div className="track">
                        <div className="fill out" style={{ width: `${((v as number) / maxG) * 100}%` }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="mini">Sin gastos en el periodo.</p>
                )}
              </div>
            </div>
            <div className="panel">
              <h2>Cuentas abiertas</h2>
              <p className="hint">Todo el historial.</p>
              {!pend.length ? (
                <p className="mini">No hay cuentas por cobrar ni por pagar.</p>
              ) : (
                <>
                  <div className="sumrow" style={{ justifyContent: 'flex-start', paddingTop: 0 }}>
                    <span>
                      Por cobrar{' '}
                      <b>
                        {money(
                          pend
                            .filter((m) => m.tipo === 'ingreso')
                            .reduce((s, m) => s + (+m.monto || 0), 0),
                        )}
                      </b>
                    </span>
                    <span>
                      Por pagar{' '}
                      <b>
                        {money(
                          pend
                            .filter((m) => m.tipo === 'gasto')
                            .reduce((s, m) => s + (+m.monto || 0), 0),
                        )}
                      </b>
                    </span>
                  </div>
                  <div className="tbl-wrap">
                    <table>
                      <tbody>
                        {pend.slice(0, 6).map((m) => (
                          <tr
                            key={m.id}
                            className="clickable"
                            onClick={() => onEdit(m)}
                          >
                            <td>
                              {m.tipo === 'ingreso' ? (
                                <span className="pill in">Por cobrar</span>
                              ) : (
                                <span className="pill out">Por pagar</span>
                              )}
                            </td>
                            <td>
                              {m.concepto || svc(m.servicio, cfg)?.nombre || ''}
                              <span className="cell-sub">
                                {fmtDate(m.fecha)}
                                {m.tercero ? ` · ${m.tercero}` : ''}
                              </span>
                            </td>
                            <td className="n">{money(+m.monto)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}
