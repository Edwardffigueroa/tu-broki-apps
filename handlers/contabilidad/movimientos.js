/**
 * GET  /api/contabilidad/movimientos
 * POST /api/contabilidad/movimientos
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { listarMovimientos, crearMovimiento } from '../../apps/contabilidad/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const movimientos = await listarMovimientos();
  return json(200, { movimientos });
});

export const POST = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  const movimiento = await crearMovimiento(body);
  return json(201, movimiento);
});
