import { fromCarriles, toCarriles, type FlowModel } from '@flow'
import { materialize, normalize } from '../../core/carriles'
import { crearDiagrama } from '../../api/client'
import type { Diagrama, DiagramaResumen } from '../../lib/types'

export async function copiarClasicoAPro(resumen: DiagramaResumen, full: { modelo: unknown; grupo_id: string | null }): Promise<Diagrama> {
  const c = structuredClone(full.modelo) as Record<string, unknown>
  const norm = normalize(c)
  materialize(norm.m)
  const { modelo, warn } = fromCarriles(norm.m)
  if (warn.length) {
    console.info('[interop Pro]', warn)
  }
  return crearDiagrama({
    titulo: (resumen.titulo || 'Diagrama') + ' (Pro)',
    grupo_id: full.grupo_id,
    tipo: 'swimlane-flow',
    modelo,
  })
}

export function prepararExportClasico(m: FlowModel): { modelo: unknown; warn: string[] } {
  const { modelo, warn } = toCarriles(m)
  const norm = normalize(modelo)
  if (!norm.m) throw new Error('El modelo clásico resultante no es válido')
  return { modelo: norm.m, warn: [...warn, ...(norm.warn || [])] }
}

export async function crearCopiaClasica(modelo: unknown, titulo: string): Promise<Diagrama> {
  return crearDiagrama({
    titulo,
    tipo: 'swimlane',
    modelo,
  })
}
