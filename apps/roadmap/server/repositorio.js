/**
 * Acceso a datos de la app roadmap. Todo vive en el schema `roadmap`.
 *
 * Estrategia: el navegador trabaja con el tablero completo y lo manda entero al
 * guardar. Aquí reemplazamos todas las tareas del tablero en una transacción,
 * protegidos por `tableros.version` (control de concurrencia optimista).
 */

import { HEADERS } from './modelo.js';

export const TABLERO_PRINCIPAL = 'principal';
const MAX_RESPALDOS = 14;

/** Convierte una fila de Postgres al objeto plano que usa la UI y el CSV. */
function filaATarea(r) {
  return {
    id: r.id,
    padre_id: r.padre_id ?? '',
    tipo: r.tipo,
    titulo: r.titulo,
    descripcion: r.descripcion ?? '',
    grupo: r.grupo ?? '',
    estado: r.estado,
    prioridad: r.prioridad,
    responsable: r.responsable ?? '',
    estimacion_dias: r.estimacion_dias == null ? '' : Number(r.estimacion_dias),
    fecha_inicio: r.fecha_inicio ?? '',
    fecha_fin: r.fecha_fin ?? '',
    orden: r.orden ?? 0,
    creado: r.creado instanceof Date ? r.creado.toISOString() : r.creado ?? '',
    actualizado: r.actualizado instanceof Date ? r.actualizado.toISOString() : r.actualizado ?? '',
  };
}

function vacioANull(v) {
  return v === '' || v == null ? null : v;
}

function tareaAFila(t, tableroId) {
  return {
    id: t.id,
    tablero_id: tableroId,
    padre_id: vacioANull(t.padre_id),
    tipo: t.tipo,
    titulo: t.titulo,
    descripcion: t.descripcion ?? '',
    grupo: t.grupo ?? '',
    estado: t.estado,
    prioridad: t.prioridad,
    responsable: t.responsable ?? '',
    estimacion_dias: vacioANull(t.estimacion_dias),
    fecha_inicio: vacioANull(t.fecha_inicio),
    fecha_fin: vacioANull(t.fecha_fin),
    orden: Number(t.orden) || 0,
    creado: vacioANull(t.creado) ?? new Date().toISOString(),
    actualizado: vacioANull(t.actualizado) ?? new Date().toISOString(),
  };
}

export async function obtenerTablero(sql, tableroId = TABLERO_PRINCIPAL) {
  const [tablero] = await sql`
    select id, nombre, version from roadmap.tableros where id = ${tableroId}
  `;
  if (!tablero) throw new Error(`Tablero ${tableroId} no existe.`);

  const filas = await sql`
    select id, padre_id, tipo, titulo, descripcion, grupo, estado, prioridad,
           responsable, estimacion_dias,
           to_char(fecha_inicio, 'YYYY-MM-DD') as fecha_inicio,
           to_char(fecha_fin, 'YYYY-MM-DD') as fecha_fin,
           orden, creado, actualizado
    from roadmap.tareas
    where tablero_id = ${tableroId}
    order by orden, creado
  `;
  return {
    nombre: tablero.nombre,
    version: Number(tablero.version),
    tareas: filas.map(filaATarea),
  };
}

/**
 * Reemplaza todas las tareas del tablero si la versión coincide.
 * Devuelve { ok: true, version } o { ok: false, conflicto: true, version }.
 * `respaldoCsv` (texto) se guarda una vez al día antes de pisar los datos.
 */
export async function reemplazarTareas(sql, {
  tableroId = TABLERO_PRINCIPAL,
  tareas,
  versionEsperada,
  respaldoCsv,
}) {
  return sql.begin(async (tx) => {
    const [tablero] = await tx`
      select version from roadmap.tableros where id = ${tableroId} for update
    `;
    if (!tablero) throw new Error(`Tablero ${tableroId} no existe.`);
    const versionActual = Number(tablero.version);

    if (versionEsperada != null && Number(versionEsperada) !== versionActual) {
      return { ok: false, conflicto: true, version: versionActual };
    }

    if (respaldoCsv) {
      await tx`
        insert into roadmap.respaldos (tablero_id, fecha, csv)
        values (${tableroId}, current_date, ${respaldoCsv})
        on conflict (tablero_id, fecha) do nothing
      `;
      await tx`
        delete from roadmap.respaldos
        where tablero_id = ${tableroId}
          and id not in (
            select id from roadmap.respaldos
            where tablero_id = ${tableroId}
            order by fecha desc limit ${MAX_RESPALDOS}
          )
      `;
    }

    await tx`delete from roadmap.tareas where tablero_id = ${tableroId}`;

    const filas = tareas.map((t) => tareaAFila(t, tableroId));
    const columnas = ['tablero_id', ...HEADERS];
    for (let i = 0; i < filas.length; i += 200) {
      await tx`insert into roadmap.tareas ${tx(filas.slice(i, i + 200), columnas)}`;
    }

    const [actualizado] = await tx`
      update roadmap.tableros
      set version = version + 1, actualizado = now()
      where id = ${tableroId}
      returning version
    `;
    return { ok: true, version: Number(actualizado.version) };
  });
}
