/**
 * Casos de uso de la app roadmap. Las rutas de `api/roadmap/*` solo llaman aquí.
 */

import { getSql } from '../../../shared/db.js';
import { ErrorHttp } from '../../../shared/http.js';
import { validateTareas } from './modelo.js';
import { serializeCsv } from './csv.js';
import { obtenerTablero, reemplazarTareas, TABLERO_PRINCIPAL } from './repositorio.js';

export async function cargarTablero() {
  return obtenerTablero(getSql(), TABLERO_PRINCIPAL);
}

/**
 * Guarda el tablero completo.
 * - 400 si los datos no pasan la validación del modelo.
 * - 409 si otra persona guardó primero (versión distinta).
 */
export async function guardarTablero({ tareas, version }) {
  const resultado = validateTareas(tareas);
  if (!resultado.ok) throw new ErrorHttp(400, resultado.error);

  const sql = getSql();
  // Respaldo diario con el estado ANTERIOR al guardado (lo que se va a pisar).
  const anterior = await obtenerTablero(sql, TABLERO_PRINCIPAL);
  const respaldoCsv = anterior.tareas.length ? serializeCsv(anterior.tareas) : null;

  const r = await reemplazarTareas(sql, {
    tableroId: TABLERO_PRINCIPAL,
    tareas: resultado.tareas,
    versionEsperada: version,
    respaldoCsv,
  });

  if (!r.ok) {
    throw new ErrorHttp(
      409,
      'Alguien más guardó cambios en este tablero. Recarga antes de guardar para no pisarlos.',
      { version: r.version },
    );
  }
  return { ok: true, version: r.version };
}

export async function exportarCsv() {
  const { tareas } = await obtenerTablero(getSql(), TABLERO_PRINCIPAL);
  return serializeCsv(tareas);
}
