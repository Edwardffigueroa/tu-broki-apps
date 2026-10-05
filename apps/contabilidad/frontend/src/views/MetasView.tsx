import { useMemo, useState } from 'react'
import {
  SERVICIOS,
  addMonths,
  curMonthKey,
  fijoMes,
  goalStatus,
  mLong,
  money,
  paceFrac,
  pct,
  pnl,
  short,
  svc,
  unitMargin,
  metaTotal,
} from '@finanzas'
import { useContabilidad } from '../state/ContabilidadStore'

const META_VACIA = { unidades: {}, ventas: 0, utilidad: 0 }

/** Remonta el editor al cambiar de mes para que el borrador arranque desde la meta guardada. */
export function MetasView() {
  const { metaMonth } = useContabilidad()
  return <MetasEditor key={metaMonth} />
}

function MetasEditor() {
  const { movs, cfg, metas, metaMonth, setMetaMonth, upsertMeta, showToast } = useContabilidad()
  const now = useMemo(() => new Date(), [])
  const cur = curMonthKey(now)
  const k = metaMonth
  const mt = metas[k] || META_VACIA
  const [unidades, setUnidades] = useState<Record<string, number>>(() => ({ ...mt.unidades }))
  const [ventas, setVentas] = useState(mt.ventas || 0)
  const [utilidad, setUtilidad] = useState(mt.utilidad || 0)
  const [saving, setSaving] = useState(false)

  const r = pnl(
    movs.filter((m) => m.fecha && m.fecha.slice(0, 7) === k),
    cfg,
  )
  const draftMeta = { unidades, ventas, utilidad }
  const tgt = metaTotal(draftMeta, cfg)
  const pace = paceFrac(k, now)
  const proj = pace > 0 ? r.ventasBrutas / pace : 0
  const months: string[] = []
  for (let i = -6; i <= 3; i++) months.push(addMonths(cur, i))
  const sold = (id: string) => r.porServ[id]?.u || 0
  const remaining = Math.max(0, tgt - r.ventasBrutas)
  const dim = new Date(+k.slice(0, 4), +k.slice(5, 7), 0).getDate()
  const daysLeft = k === cur ? dim - now.getDate() + 1 : k > cur ? dim : 0
  const st = goalStatus(tgt ? proj / tgt : NaN)
  const F = fijoMes(cfg)

  let br = 0
  let mc = 0
  let u = 0
  let cac = 0
  for (const [id, n] of Object.entries(unidades)) {
    if (!n) continue
    const s = svc(id, cfg)
    br += s.precio * n
    mc += unitMargin(s, cfg) * n
    u += n
    if (!s.recurrente) cac += (s.cac || 0) * n
  }

  const suggest = () => {
    const mix: Record<string, number> = {
      v03: 2,
      v02: 2,
      v05: 4,
      v06: 2,
      v07: 3,
      v13: 3,
      v08: 1,
    }
    const base = Object.entries(mix).reduce((s, [id, n]) => {
      const sv = svc(id, cfg)
      return s + (unitMargin(sv, cfg) - (sv.recurrente ? 0 : sv.cac || 0)) * n
    }, 0)
    if (!(base > 0)) {
      showToast('Con los precios y costos actuales la mezcla no deja margen. Revisa el Catálogo.')
      return
    }
    const factor = Math.max(1, Math.ceil((F / base) * 10) / 10)
    const next: Record<string, number> = {}
    for (const [id, n] of Object.entries(mix)) next[id] = Math.ceil(n * factor)
    setUnidades(next)
    setUtilidad(0)
    showToast('Meta sugerida cargada. Revísenla y guarden.')
  }

  const save = async () => {
    if (saving) return
    const clean: Record<string, number> = {}
    for (const [id, n] of Object.entries(unidades)) {
      if (n > 0) clean[id] = Math.round(n)
    }
    setSaving(true)
    try {
      await upsertMeta(k, { unidades: clean, ventas: +ventas || 0, utilidad: +utilidad || 0 })
      showToast(`Meta de ${mLong(k)} guardada`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Metas de ventas</h1>
          <p className="lede">
            Definan cuántas unidades de cada servicio quieren vender en el mes. La meta en pesos se
            calcula sola con los precios del catálogo.
          </p>
        </div>
        <div className="controls">
          <select
            aria-label="Mes de la meta"
            value={k}
            onChange={(e) => setMetaMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {mLong(m)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid kpis">
        <div className="kpi hero">
          <span className="lbl">Meta de ventas (con IVA)</span>
          <span className="val">{tgt ? money(tgt) : 'Sin meta'}</span>
          <span className="foot">{mLong(k)}</span>
        </div>
        <div className="kpi">
          <span className="lbl">Vendido</span>
          <span className="val">{money(r.ventasBrutas)}</span>
          <span className="foot">
            {tgt ? `${pct(r.ventasBrutas / tgt, 0)} de la meta` : `${r.nVentas} ventas`}
          </span>
        </div>
        <div className="kpi">
          <span className="lbl">Proyección al cierre</span>
          <span className="val">{k > cur ? '—' : money(proj)}</span>
          <span className="foot">
            {tgt && k <= cur ? <span className={`pill ${st.c}`}>{st.t}</span> : 'Al ritmo actual'}
          </span>
        </div>
        <div className="kpi">
          <span className="lbl">Falta vender</span>
          <span className="val">{tgt ? money(remaining) : '—'}</span>
          <span className="foot">
            {tgt && daysLeft > 0
              ? `${money(remaining / daysLeft)} por día · ${daysLeft} días`
              : ''}
          </span>
        </div>
      </div>
      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '18px 18px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
            }}
          >
            <div>
              <h2>Meta por servicio</h2>
              <p className="hint" style={{ margin: 0 }}>
                Escribe las unidades y guarda.
              </p>
            </div>
            <div className="controls">
              <button className="btn" type="button" onClick={suggest}>
                Sugerir meta de equilibrio
              </button>
              <button className="btn pri" type="button" disabled={saving} onClick={() => void save()}>
                {saving ? 'Guardando…' : 'Guardar meta'}
              </button>
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Servicio</th>
                  <th className="n">Meta unid.</th>
                  <th className="n">Vendidas</th>
                  <th>Avance</th>
                  <th className="n">Falta en $</th>
                </tr>
              </thead>
              <tbody>
                {SERVICIOS.map((b) => {
                  const s = svc(b.id, cfg)
                  const goal = +(unidades[b.id] || 0)
                  const uu = sold(b.id)
                  const f = goal ? uu / goal : NaN
                  const gst = goalStatus(goal ? (pace > 0 ? uu / pace / goal : 0) : NaN)
                  return (
                    <tr key={b.id}>
                      <td className="num muted">{s.n}</td>
                      <td>
                        {s.nombre}
                        <span className="cell-sub">
                          {s.precio ? money(s.precio) : 'Gratis'} c/u
                        </span>
                      </td>
                      <td className="n">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="unit-in"
                          value={goal || ''}
                          placeholder="0"
                          onChange={(e) =>
                            setUnidades((prev) => ({
                              ...prev,
                              [b.id]: Math.max(0, Math.floor(+e.target.value || 0)),
                            }))
                          }
                        />
                      </td>
                      <td className="n">{uu}</td>
                      <td style={{ minWidth: 140 }}>
                        {goal ? (
                          <>
                            <div className="progress" style={{ height: 6 }}>
                              <div
                                className={`bar ${gst.c}`}
                                style={{ width: `${Math.min(100, f * 100)}%` }}
                              />
                              {pace < 1 && pace > 0 ? (
                                <div className="pace" style={{ left: `${pace * 100}%` }} />
                              ) : null}
                            </div>
                            <span className="cell-sub">
                              {pct(f, 0)} · {gst.t}
                            </span>
                          </>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="n">
                        {goal ? money(Math.max(0, goal - uu) * s.precio) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="grid" style={{ alignContent: 'start' }}>
          <div className="panel">
            <h2>Metas en pesos</h2>
            <p className="hint">Opcional: fija la meta de ventas a mano.</p>
            <div className="field">
              <label htmlFor="mVentas">Meta de ventas brutas (COP)</label>
              <input
                id="mVentas"
                type="number"
                min={0}
                step={1000}
                value={ventas || ''}
                onChange={(e) => setVentas(+e.target.value || 0)}
              />
            </div>
            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="mUtil">Meta de utilidad operacional (COP)</label>
              <input
                id="mUtil"
                type="number"
                step={1000}
                value={utilidad || ''}
                onChange={(e) => setUtilidad(+e.target.value || 0)}
              />
            </div>
            <div className="calc" style={{ marginTop: 12 }}>
              <div>
                <span>Unidades en la meta</span>
                <b>{u}</b>
              </div>
              <div>
                <span>Ventas brutas por unidades</span>
                <b>{money(br)}</b>
              </div>
              <div>
                <span>Margen de contribución esperado</span>
                <b>{money(mc)}</b>
              </div>
              <div>
                <span>(–) Presupuesto de marketing (CAC × unidades)</span>
                <b>{money(-cac)}</b>
              </div>
              <div>
                <span>(–) Costos fijos del mes</span>
                <b>{money(-F)}</b>
              </div>
              <div>
                <span>Utilidad operacional esperada</span>
                <b className={mc - cac - F < 0 ? 'neg' : 'pos'}>{money(mc - cac - F)}</b>
              </div>
            </div>
          </div>
          <div className="panel">
            <h2>Cumplimiento histórico</h2>
            <p className="hint">Meses con meta definida.</p>
            <div className="hbars">
              {months
                .filter((m) => m <= cur && metas[m] && metaTotal(metas[m], cfg) > 0)
                .map((m) => {
                  const rr = pnl(
                    movs.filter((x) => x.fecha && x.fecha.slice(0, 7) === m),
                    cfg,
                  )
                  const t = metaTotal(metas[m], cfg)
                  const f = rr.ventasBrutas / t
                  const s2 = goalStatus(
                    m === cur ? (paceFrac(m, now) ? f / paceFrac(m, now) : 0) : f,
                  )
                  return (
                    <div className="hbar" key={m}>
                      <span className="t">{mLong(m)}</span>
                      <span className="v">
                        {money(rr.ventasBrutas)} de {short(t)} · {pct(f, 0)}
                      </span>
                      <div className="track">
                        <div
                          className="fill"
                          style={{
                            width: `${Math.min(100, f * 100)}%`,
                            background: `var(--${s2.c === 'ok' ? 'pos' : s2.c === 'warn' ? 'warn' : 'neg'})`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      </div>
      <p className="note">
        &quot;Sugerir meta de equilibrio&quot; arma una mezcla de arriendo y escala hasta cubrir
        costos fijos ({money(F)}).
      </p>
    </>
  )
}
