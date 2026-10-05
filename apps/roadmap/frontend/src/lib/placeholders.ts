import {
  PLACEHOLDER_HITO,
  PLACEHOLDER_SUB,
  PLACEHOLDER_TITULO,
} from './constants'
import type { Task } from './types'
import { addDays, newTaskFactory, todayStr } from './taskFactory'

export function buildPlaceholders(): Task[] {
  const t1 = newTaskFactory({
    id: 'ph_dev',
    titulo: PLACEHOLDER_TITULO,
    descripcion: 'Haz clic en cualquier celda para editarla. También puedes abrir el panel lateral.',
    grupo: 'Desarrollo',
    estado: 'Por hacer',
    prioridad: 'Media',
    estimacion_dias: 5,
    fecha_inicio: todayStr(),
    fecha_fin: addDays(todayStr(), 4),
    orden: 1,
  })
  const t2 = newTaskFactory({
    id: 'ph_mkt',
    titulo: PLACEHOLDER_TITULO,
    grupo: 'Marketing',
    estimacion_dias: 3,
    orden: 2,
  })
  const t3 = newTaskFactory({
    id: 'ph_ops',
    titulo: PLACEHOLDER_TITULO,
    grupo: 'Operaciones',
    prioridad: 'Baja',
    estimacion_dias: 2,
    orden: 3,
  })
  const hito = newTaskFactory({
    id: 'ph_hito',
    tipo: 'hito',
    titulo: PLACEHOLDER_HITO,
    grupo: 'Producto',
    prioridad: 'Alta',
    estimacion_dias: '',
    fecha_inicio: addDays(todayStr(), 14),
    fecha_fin: addDays(todayStr(), 14),
    orden: 4,
  })
  const sub = newTaskFactory({
    id: 'ph_dev_sub',
    padre_id: 'ph_dev',
    titulo: PLACEHOLDER_SUB,
    grupo: 'Desarrollo',
    estimacion_dias: 1,
    orden: 1,
  })
  return [t1, t2, t3, hito, sub]
}
