import { useEffect, useMemo, useState } from 'react'
import {
  CATS,
  LINEAS,
  MEDIOS,
  QUIENES,
  SERVICIOS,
  calc,
  money,
  pct,
  svc,
  todayKey,
} from '@finanzas'
import { useContabilidad } from '../state/ContabilidadStore'
import type { Movimiento } from '../lib/types'

type Props = {
  initial: Partial<Movimiento>
  onClose: () => void
}

export function MovDrawer({ initial, onClose }: Props) {
  const { cfg, upsertMov, removeMov, showToast } = useContabilidad()
  const isNew = !initial.id
  const [form, setForm] = useState<Partial<Movimiento>>(() => {
    const base: Partial<Movimiento> = {
      tipo: 'ingreso',
      fecha: todayKey(),
      servicio: 'v03',
      cantidad: 1,
      estado: 'pagado',
      medio: 'Transferencia',
      quien: 'Empresa',
      categoria: 'Marketing',
      ...initial,
    }
    // Ingreso nuevo: precargar precio/costo del catálogo para el servicio por defecto.
    if (isNew && base.tipo === 'ingreso' && base.servicio && base.monto == null) {
      const s = svc(base.servicio, cfg)
      const q = +(base.cantidad || 1)
      base.monto = s.precio * q
      base.costoDirecto = s.costo * q
    }
    return base
  })
  const [confirmDel, setConfirmDel] = useState(false)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const isI = form.tipo === 'ingreso'
  const preview = useMemo(() => {
    if (!isI) return null
    return calc(
      {
        tipo: 'ingreso',
        monto: +form.monto! || 0,
        costoDirecto: +form.costoDirecto! || 0,
        medio: form.medio,
      },
      cfg,
    )
  }, [isI, form.monto, form.costoDirecto, form.medio, cfg])

  const set = (patch: Partial<Movimiento>) => setForm((f) => ({ ...f, ...patch }))

  const onServicioChange = (id: string) => {
    const s = svc(id, cfg)
    const q = +(form.cantidad || 1)
    set({ servicio: id, monto: s.precio * q, costoDirecto: s.costo * q })
  }

  const onCantChange = (q: number) => {
    const s = svc(form.servicio || 'v03', cfg)
    set({ cantidad: q, monto: s.precio * q, costoDirecto: s.costo * q })
  }

  const switchTipo = (tipo: 'ingreso' | 'gasto') => {
    if (tipo === 'ingreso') {
      const s = svc(form.servicio || 'v03', cfg)
      const q = form.cantidad || 1
      set({ tipo, monto: s.precio * q, costoDirecto: s.costo * q })
    } else {
      set({ tipo, monto: undefined })
    }
  }

  const save = async () => {
    if (saving) return
    setErr('')
    if (!form.fecha) {
      setErr('Falta la fecha del movimiento.')
      return
    }
    if (!(+(form.monto || 0) > 0) && !(form.tipo === 'ingreso' && form.servicio === 'v01')) {
      setErr('Escribe un monto mayor que cero.')
      return
    }
    if (form.tipo === 'gasto' && !form.concepto) {
      setErr('Escribe el concepto del gasto.')
      return
    }
    setSaving(true)
    try {
      await upsertMov(form.id, form)
      showToast(
        isNew
          ? form.tipo === 'ingreso'
            ? 'Ingreso registrado'
            : 'Gasto registrado'
          : 'Cambios guardados',
      )
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo guardar')
      setSaving(false)
    }
  }

  const del = async () => {
    if (!form.id || saving) return
    if (!confirmDel) {
      setConfirmDel(true)
      return
    }
    setSaving(true)
    try {
      await removeMov(form.id)
      showToast('Movimiento eliminado')
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo eliminar')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true">
        <header>
          <h2>
            {isNew ? (isI ? 'Nuevo ingreso' : 'Nuevo gasto') : 'Editar movimiento'}
          </h2>
          <button className="btn ghost" type="button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        <form
          className="drawer-form"
          style={{ padding: '18px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          {isNew && (
            <div className="seg">
              <button type="button" aria-pressed={isI} onClick={() => switchTipo('ingreso')}>
                Ingreso
              </button>
              <button type="button" aria-pressed={!isI} onClick={() => switchTipo('gasto')}>
                Gasto
              </button>
            </div>
          )}
          <div className="frow">
            <div className="field">
              <label htmlFor="ffecha">Fecha</label>
              <input
                id="ffecha"
                type="date"
                value={form.fecha || ''}
                onChange={(e) => set({ fecha: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="festado">Estado</label>
              <select
                id="festado"
                value={form.estado}
                onChange={(e) => set({ estado: e.target.value as Movimiento['estado'] })}
              >
                <option value="pagado">{isI ? 'Cobrado' : 'Pagado'}</option>
                <option value="pendiente">{isI ? 'Por cobrar' : 'Por pagar'}</option>
              </select>
            </div>
          </div>
          <label className="chk">
            <input
              type="checkbox"
              checked={!!form.fechaPendiente}
              onChange={(e) => set({ fechaPendiente: e.target.checked })}
            />
            Fecha por confirmar
          </label>

          {isI ? (
            <>
              <div className="field">
                <label htmlFor="fserv">Servicio</label>
                <select
                  id="fserv"
                  value={form.servicio}
                  onChange={(e) => onServicioChange(e.target.value)}
                >
                  {LINEAS.map((l) => (
                    <optgroup key={l} label={l}>
                      {SERVICIOS.filter((s) => s.linea === l).map((b) => {
                        const s = svc(b.id, cfg)
                        return (
                          <option key={s.id} value={s.id}>
                            {s.n}. {s.nombre} · {s.precio ? money(s.precio) : 'Gratis'}
                          </option>
                        )
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="frow">
                <div className="field">
                  <label htmlFor="fcant">Cantidad</label>
                  <input
                    id="fcant"
                    type="number"
                    min={1}
                    step={1}
                    value={form.cantidad || 1}
                    onChange={(e) => onCantChange(+e.target.value || 1)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="fmonto">Valor cobrado (con IVA)</label>
                  <input
                    id="fmonto"
                    type="number"
                    min={0}
                    step={100}
                    value={form.monto ?? ''}
                    onChange={(e) => set({ monto: +e.target.value })}
                  />
                </div>
              </div>
              <div className="frow">
                <div className="field">
                  <label htmlFor="fcosto">Costo directo total</label>
                  <input
                    id="fcosto"
                    type="number"
                    min={0}
                    step={100}
                    value={form.costoDirecto ?? 0}
                    onChange={(e) => set({ costoDirecto: +e.target.value })}
                  />
                  <span className="help">Del catálogo; ajústalo si cambió.</span>
                </div>
                <div className="field">
                  <label htmlFor="fmedio">Medio de pago</label>
                  <select
                    id="fmedio"
                    value={form.medio}
                    onChange={(e) => set({ medio: e.target.value })}
                  >
                    {MEDIOS.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="fterc">Cliente</label>
                <input
                  id="fterc"
                  value={form.tercero || ''}
                  onChange={(e) => set({ tercero: e.target.value })}
                  placeholder="Nombre del propietario, comprador…"
                />
              </div>
              <div className="field">
                <label htmlFor="fconc">Concepto (opcional)</label>
                <input
                  id="fconc"
                  value={form.concepto || ''}
                  onChange={(e) => set({ concepto: e.target.value })}
                  placeholder="Ej. Apto 302, Valle del Lili"
                />
              </div>
              <div className="field">
                <label htmlFor="fquien">Recibió el dinero</label>
                <select
                  id="fquien"
                  value={form.quien}
                  onChange={(e) => set({ quien: e.target.value })}
                >
                  {QUIENES.map((w) => (
                    <option key={w}>{w}</option>
                  ))}
                </select>
              </div>
              {preview && (
                <div className="calc">
                  <div>
                    <span>Venta neta (sin IVA)</span>
                    <b>{money(preview.neto)}</b>
                  </div>
                  <div>
                    <span>IVA a declarar</span>
                    <b>{money(preview.iva)}</b>
                  </div>
                  <div>
                    <span>
                      Costo directo{form.medio === 'Wompi' ? ' + comisión Wompi' : ''}
                    </span>
                    <b>{money(-preview.costo)}</b>
                  </div>
                  <div>
                    <span>Margen de esta venta</span>
                    <b className={preview.neto - preview.costo < 0 ? 'neg' : 'pos'}>
                      {money(preview.neto - preview.costo)} ·{' '}
                      {preview.neto ? pct((preview.neto - preview.costo) / preview.neto, 0) : '—'}
                    </b>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="fcat">Cuenta de gasto</label>
                <select
                  id="fcat"
                  value={form.categoria}
                  onChange={(e) => set({ categoria: e.target.value })}
                >
                  {CATS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.puc})
                    </option>
                  ))}
                </select>
              </div>
              {form.categoria === 'Marketing' && (
                <div className="field">
                  <label htmlFor="fcac">Servicio que promociona (para el CAC)</label>
                  <select
                    id="fcac"
                    value={form.servicioCac || ''}
                    onChange={(e) => set({ servicioCac: e.target.value })}
                  >
                    <option value="">General / varios servicios</option>
                    {SERVICIOS.filter((x) => x.precio > 0 && !x.recurrente).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.n}. {x.nombre}
                      </option>
                    ))}
                  </select>
                  <span className="help">
                    Si la pauta es para un servicio, el CAC real de ese servicio se calcula solo.
                  </span>
                </div>
              )}
              <div className="field">
                <label htmlFor="fconc">Concepto</label>
                <input
                  id="fconc"
                  value={form.concepto || ''}
                  onChange={(e) => set({ concepto: e.target.value })}
                  placeholder="Ej. Meta Ads — campaña publicación gratis"
                  required
                />
              </div>
              <div className="frow">
                <div className="field">
                  <label htmlFor="fmonto">Monto (COP)</label>
                  <input
                    id="fmonto"
                    type="number"
                    min={0}
                    step={100}
                    value={form.monto ?? ''}
                    onChange={(e) => set({ monto: +e.target.value })}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="fquien">Pagó</label>
                  <select
                    id="fquien"
                    value={form.quien}
                    onChange={(e) => set({ quien: e.target.value })}
                  >
                    {QUIENES.map((w) => (
                      <option key={w}>{w}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label htmlFor="fterc">Proveedor</label>
                <input
                  id="fterc"
                  value={form.tercero || ''}
                  onChange={(e) => set({ tercero: e.target.value })}
                  placeholder="Ej. Meta, Google, Zapsign"
                />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="fnotas">Notas o soporte</label>
            <textarea
              id="fnotas"
              rows={2}
              value={form.notas || ''}
              onChange={(e) => set({ notas: e.target.value })}
              placeholder="Número de factura, link del soporte…"
            />
          </div>
          {err && (
            <p className="neg" style={{ margin: 0 }}>
              {err}
            </p>
          )}
        </form>
        <footer>
          <div>
            {!isNew && (
              <button className="btn danger" type="button" disabled={saving} onClick={() => void del()}>
                {confirmDel ? 'Confirmar: eliminar' : 'Eliminar'}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="btn pri" type="button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Guardando…' : isNew ? 'Registrar' : 'Guardar'}
            </button>
          </div>
        </footer>
      </div>
    </>
  )
}
