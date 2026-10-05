/**
 * Modelo de la app roadmap: columnas, enumeraciones y validación.
 * Es la misma forma que viaja al navegador y que se exporta a CSV.
 * Modelo plano: una fila por tarea o subtarea (`padre_id`, un solo nivel).
 */

export const HEADERS = [
  'id',
  'padre_id',
  'tipo',
  'titulo',
  'descripcion',
  'grupo',
  'estado',
  'prioridad',
  'responsable',
  'estimacion_dias',
  'fecha_inicio',
  'fecha_fin',
  'orden',
  'creado',
  'actualizado',
];

export const TIPOS = ['tarea', 'hito'];
export const ESTADOS = ['Por hacer', 'En curso', 'Bloqueada', 'Hecha'];
export const PRIORIDADES = ['Alta', 'Media', 'Baja'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Valida y normaliza tareas antes de guardar.
 * Devuelve { ok: true, tareas } o { ok: false, error }.
 */
export function validateTareas(tareas) {
  if (!Array.isArray(tareas)) {
    return { ok: false, error: 'El cuerpo debe ser un array de tareas.' };
  }

  const ids = new Set();
  for (const t of tareas) {
    if (!t || typeof t !== 'object') {
      return { ok: false, error: 'Cada tarea debe ser un objeto.' };
    }
    if (!t.id || typeof t.id !== 'string') {
      return { ok: false, error: 'Toda tarea necesita un id (texto).' };
    }
    if (ids.has(t.id)) {
      return { ok: false, error: `id duplicado: ${t.id}` };
    }
    ids.add(t.id);

    if (!TIPOS.includes(t.tipo)) {
      return {
        ok: false,
        error: `tipo inválido en ${t.id}: ${t.tipo}. Usa: ${TIPOS.join(', ')}`,
      };
    }
    if (!ESTADOS.includes(t.estado)) {
      return { ok: false, error: `estado inválido en ${t.id}: ${t.estado}` };
    }
    if (!PRIORIDADES.includes(t.prioridad)) {
      return { ok: false, error: `prioridad inválida en ${t.id}: ${t.prioridad}` };
    }
    if (!t.titulo || !String(t.titulo).trim()) {
      return { ok: false, error: `La tarea ${t.id} no tiene título.` };
    }
    for (const f of ['fecha_inicio', 'fecha_fin']) {
      const v = t[f];
      if (v && !DATE_RE.test(v)) {
        return {
          ok: false,
          error: `${f} inválida en ${t.id}: ${v} (usa YYYY-MM-DD)`,
        };
      }
    }
    if (
      t.estimacion_dias !== '' &&
      t.estimacion_dias != null &&
      Number.isNaN(Number(t.estimacion_dias))
    ) {
      return { ok: false, error: `estimacion_dias inválida en ${t.id}` };
    }
  }

  for (const t of tareas) {
    if (t.padre_id) {
      if (!ids.has(t.padre_id)) {
        return { ok: false, error: `padre_id desconocido en ${t.id}: ${t.padre_id}` };
      }
      if (t.padre_id === t.id) {
        return { ok: false, error: `padre_id no puede ser el mismo id (${t.id})` };
      }
      const padre = tareas.find((p) => p.id === t.padre_id);
      if (padre && padre.padre_id) {
        return {
          ok: false,
          error: `Solo un nivel de subtareas. ${t.id} apunta a otra subtarea.`,
        };
      }
    }
  }

  const normalized = tareas.map((t) => {
    const out = {};
    for (const h of HEADERS) {
      let v = t[h];
      if (v == null) v = '';
      if (h === 'orden') v = Number(v) || 0;
      if (h === 'estimacion_dias' && v !== '') v = Number(v);
      if (h === 'titulo') v = String(v).trim();
      out[h] = v;
    }
    return out;
  });

  return { ok: true, tareas: normalized };
}
