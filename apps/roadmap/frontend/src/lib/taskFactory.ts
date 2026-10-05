import { PLACEHOLDER_TITULO } from './constants'
import type { Task } from './types'
import { nowIso, uid } from './utils'

export { addDays, todayStr } from './utils'

export function newTaskFactory(partial: Partial<Task> & { orden?: number } = {}, count = 0): Task {
  const ts = nowIso()
  return {
    id: uid(),
    padre_id: '',
    tipo: 'tarea',
    titulo: PLACEHOLDER_TITULO,
    descripcion: '',
    grupo: partial.grupo || 'Desarrollo',
    estado: 'Por hacer',
    prioridad: 'Media',
    responsable: '',
    estimacion_dias: 3,
    fecha_inicio: '',
    fecha_fin: '',
    orden: partial.orden ?? count + 1,
    creado: ts,
    actualizado: ts,
    ...partial,
  }
}

export function touch(t: Task): Task {
  return { ...t, actualizado: nowIso() }
}
