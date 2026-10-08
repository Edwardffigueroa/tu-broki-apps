import { useState } from 'react'
import type { FlowModel } from '@flow'
import { prepararExportClasico, crearCopiaClasica } from '../interop/convertir'

export function ExportClasicoModal({
  model,
  onClose,
  onOpenDiagram,
}: {
  model: FlowModel
  onClose: () => void
  onOpenDiagram: (id: string) => void
}) {
  const prep = prepararExportClasico(model)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  async function onCreate() {
    setBusy(true)
    setError(null)
    try {
      const d = await crearCopiaClasica(prep.modelo, model.title + ' (clásico)')
      setCreatedId(d.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la copia')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fs-modal-backdrop" onClick={onClose}>
      <div className="fs-modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Exportar copia a Carriles clásico</h2>
        <p>Se creará un diagrama nuevo. El original en Pro no cambia.</p>
        {prep.warn.length ? (
          <ul className="fs-warn-list">
            {prep.warn.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        ) : (
          <p>No se pierde nada relevante en esta conversión.</p>
        )}
        {error && <p className="fs-error">{error}</p>}
        {createdId ? (
          <div className="fs-modal-actions">
            <p>Copia creada.</p>
            <button type="button" className="primary" onClick={() => onOpenDiagram(createdId)}>
              Abrir copia
            </button>
            <button type="button" onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <div className="fs-modal-actions">
            <button type="button" className="primary" disabled={busy} onClick={() => void onCreate()}>
              Crear copia
            </button>
            <button type="button" onClick={onClose}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  )
}
