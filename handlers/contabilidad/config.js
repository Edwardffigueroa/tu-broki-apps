/**
 * GET /api/contabilidad/config
 * PUT /api/contabilidad/config
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { obtenerConfig, guardarConfig } from '../../apps/contabilidad/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const config = await obtenerConfig();
  return json(200, { config });
});

export const PUT = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  const config = await guardarConfig(body);
  return json(200, { config });
});
