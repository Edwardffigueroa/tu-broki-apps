/**
 * GET|PUT|DELETE /api/contabilidad/movimiento?id=
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import {
  obtenerMovimiento,
  actualizarMovimiento,
  eliminarMovimiento,
} from '../../apps/contabilidad/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const id = new URL(request.url).searchParams.get('id');
  return json(200, await obtenerMovimiento(id));
});

export const PUT = manejar(async (request) => {
  exigirSesion(request);
  const id = new URL(request.url).searchParams.get('id');
  const body = await leerJson(request);
  return json(200, await actualizarMovimiento(id, body));
});

export const DELETE = manejar(async (request) => {
  exigirSesion(request);
  const id = new URL(request.url).searchParams.get('id');
  return json(200, await eliminarMovimiento(id));
});
