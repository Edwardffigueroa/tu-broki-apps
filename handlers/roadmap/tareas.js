/**
 * GET /api/roadmap/tareas  → { nombre, version, tareas }
 * PUT /api/roadmap/tareas  { tareas, version } → { ok, version } | 409 | 400
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { cargarTablero, guardarTablero } from '../../apps/roadmap/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  return json(200, await cargarTablero());
});

export const PUT = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  return json(200, await guardarTablero({ tareas: body.tareas, version: body.version }));
});
