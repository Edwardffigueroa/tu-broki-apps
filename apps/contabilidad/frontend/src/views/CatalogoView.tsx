import { useState } from 'react'
import {
  FIRMA,
  GRUPOS_FIJO,
  NOTIF,
  SERVICIOS,
  TRUORA,
  fijosList,
  fijoMes,
  money,
  pct,
  svc,
  unitMargin,
  netOf,
} from '@finanzas'
import { useContabilidad } from '../state/ContabilidadStore'
import type { Cfg } from '../lib/types'

type Fijo = { n: string; m: number; g: string; nota?: string }

function fijosFromCfg(cfg: Cfg): Fijo[] {
  return fijosList(cfg).map((f: Fijo) => ({ ...f }))
}

/** Remonta el editor cuando llega una config nueva del servidor (guardado o recarga). */
export function CatalogoView() {
  const { cfgVersion } = useContabilidad()
  return <CatalogoEditor key={cfgVersion} />
}

function CatalogoEditor() {
  const { cfg, upsertCfg, showToast } = useContabilidad()
  const [precios, setPrecios] = useState<Cfg['precios']>(() => ({ ...cfg.precios }))
  const [fijos, setFijos] = useState<Fijo[]>(() => fijosFromCfg(cfg))
  const [ivaIncluido, setIvaIncluido] = useState(cfg.ivaIncluido)
  const [iva, setIva] = useState(cfg.iva * 100)
  const [ica, setIca] = useState(cfg.ica * 100)
  const [renta, setRenta] = useState(cfg.renta * 100)
  const [gmf, setGmf] = useState(cfg.gmf * 100)
  const [wompiPct, setWompiPct] = useState(cfg.wompiPct * 100)
  const [saving, setSaving] = useState(false)

  const draftCfg = {
    ...cfg,
    precios,
    fijos,
    ivaIncluido,
    iva: iva / 100,
    ica: ica / 100,
    renta: renta / 100,
    gmf: gmf / 100,
    wompiPct: wompiPct / 100,
  }

  const by: Record<string, number> = {}
  fijos.forEach((f) => {
    by[f.g || 'Otros'] = (by[f.g || 'Otros'] || 0) + (+f.m || 0)
  })
  const tot = Object.values(by).reduce((a, b) => a + b, 0)

  const save = async () => {
    if (saving) return
    const sinNombre = fijos.filter((f) => !f.n.trim() && f.m > 0)
    if (sinNombre.length) {
      showToast('Hay costos fijos con monto pero sin concepto. Escribe el concepto o quita la línea.')
      return
    }
    setSaving(true)
    try {
      await upsertCfg({
        precios,
        fijos: fijos.filter((f) => f.n.trim()),
        ivaIncluido,
        iva: iva / 100,
        ica: ica / 100,
        renta: renta / 100,
        gmf: gmf / 100,
        wompiPct: wompiPct / 100,
        wompiFijo: cfg.wompiFijo,
      })
      showToast('Catálogo y costos fijos guardados')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Error al guardar')
      setSaving(false)
    }
  }

  const setPrecio = (id: string, key: 'precio' | 'costo' | 'cac', val: number) => {
    setPrecios((p) => ({
      ...p,
      [id]: { ...(p[id] || {}), [key]: val },
    }))
  }

  return (
    <>
      <div className="top">
        <div>
          <h1>Catálogo y supuestos</h1>
          <p className="lede">
            Precios, costos variables, CAC objetivo, costos fijos mensuales e impuestos. Cambios
            afectan márgenes, metas y cobertura.
          </p>
        </div>
        <div className="controls">
          <button className="btn pri" type="button" disabled={saving} onClick={() => void save()}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="panel" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 8px' }}>
          <h2>Servicios y comisiones</h2>
          <p className="hint" style={{ margin: 0 }}>
            Costo variable = Truora {money(TRUORA)}, firma digital {money(FIRMA)} (3 firmas),
            notificaciones {money(NOTIF)}. El 4x1000 y Wompi se suman al registrar la venta.
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Servicio</th>
                <th className="n">Precio (IVA)</th>
                <th className="n">Costo var.</th>
                <th className="n">CAC obj.</th>
                <th className="n">Margen</th>
              </tr>
            </thead>
            <tbody>
              {SERVICIOS.map((b) => {
                const s = svc(b.id, draftCfg)
                const um = unitMargin(s, draftCfg)
                return (
                  <tr key={b.id}>
                    <td className="num muted">{s.n}</td>
                    <td>
                      {s.nombre}
                      <span className="cell-sub">{s.nota}</span>
                    </td>
                    <td className="n">
                      <input
                        type="number"
                        className="money-in"
                        min={0}
                        step={1000}
                        value={s.precio}
                        onChange={(e) => setPrecio(b.id, 'precio', +e.target.value || 0)}
                      />
                    </td>
                    <td className="n">
                      <input
                        type="number"
                        className="money-in"
                        min={0}
                        step={100}
                        value={s.costo}
                        onChange={(e) => setPrecio(b.id, 'costo', +e.target.value || 0)}
                      />
                    </td>
                    <td className="n">
                      <input
                        type="number"
                        className="money-in"
                        min={0}
                        step={1000}
                        value={s.cac || 0}
                        onChange={(e) => setPrecio(b.id, 'cac', +e.target.value || 0)}
                      />
                    </td>
                    <td className={`n ${um < 0 ? 'neg' : ''}`}>
                      {money(um)}
                      <span className="cell-sub">
                        {s.precio ? pct(um / netOf(s.precio, draftCfg), 0) : ''}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid two">
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '18px 18px 10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <h2>Costos fijos mensuales</h2>
              <p className="hint" style={{ margin: 0 }}>
                Total presupuestado: <b>{money(fijoMes(draftCfg))}</b>
              </p>
            </div>
            <button
              className="btn"
              type="button"
              onClick={() => setFijos((f) => [...f, { n: '', m: 0, g: 'Otros' }])}
            >
              + Línea
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Concepto</th>
                  <th>Grupo</th>
                  <th className="n">$/mes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fijos.map((f, i) => (
                  <tr key={i}>
                    <td style={{ minWidth: 240 }}>
                      <input
                        type="text"
                        value={f.n}
                        style={{ width: '100%' }}
                        onChange={(e) => {
                          const next = [...fijos]
                          next[i] = { ...f, n: e.target.value }
                          setFijos(next)
                        }}
                      />
                      {f.nota ? <span className="cell-sub flag">{f.nota}</span> : null}
                    </td>
                    <td>
                      <select
                        value={f.g}
                        onChange={(e) => {
                          const next = [...fijos]
                          next[i] = { ...f, g: e.target.value }
                          setFijos(next)
                        }}
                      >
                        {GRUPOS_FIJO.map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </select>
                    </td>
                    <td className="n">
                      <input
                        type="number"
                        className="money-in"
                        min={0}
                        step={1000}
                        value={f.m}
                        onChange={(e) => {
                          const next = [...fijos]
                          next[i] = { ...f, m: +e.target.value || 0 }
                          setFijos(next)
                        }}
                      />
                    </td>
                    <td className="n">
                      <button
                        className="btn ghost"
                        type="button"
                        aria-label="Quitar"
                        onClick={() => setFijos((arr) => arr.filter((_, j) => j !== i))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sumrow">
            {Object.entries(by).map(([g, v]) => (
              <span key={g}>
                {g} <b>{money(v)}</b>
              </span>
            ))}
            <span>
              Total <b>{money(tot)}</b>
            </span>
          </div>
        </div>
        <div className="panel">
          <h2>Impuestos y pasarela</h2>
          <p className="hint">Supuestos usados en el P&G y al calcular cada venta.</p>
          <label className="chk" style={{ marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={ivaIncluido}
              onChange={(e) => setIvaIncluido(e.target.checked)}
            />
            Precios con IVA incluido
          </label>
          <div className="frow">
            <div className="field">
              <label>IVA %</label>
              <input type="number" step={0.1} value={iva} onChange={(e) => setIva(+e.target.value)} />
            </div>
            <div className="field">
              <label>ICA %</label>
              <input type="number" step={0.1} value={ica} onChange={(e) => setIca(+e.target.value)} />
            </div>
          </div>
          <div className="frow" style={{ marginTop: 10 }}>
            <div className="field">
              <label>Renta %</label>
              <input
                type="number"
                step={0.1}
                value={renta}
                onChange={(e) => setRenta(+e.target.value)}
              />
            </div>
            <div className="field">
              <label>GMF (4×1000) %</label>
              <input type="number" step={0.01} value={gmf} onChange={(e) => setGmf(+e.target.value)} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label>Wompi comisión %</label>
            <input
              type="number"
              step={0.01}
              value={wompiPct}
              onChange={(e) => setWompiPct(+e.target.value)}
            />
            <span className="help">Más fijo {money(cfg.wompiFijo)} + IVA sobre la comisión.</span>
          </div>
        </div>
      </div>
    </>
  )
}
