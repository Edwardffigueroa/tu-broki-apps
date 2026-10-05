/**
 * GET /api/contabilidad/metas
 * PUT /api/contabilidad/metas  { mes, unidades, ventas, utilidad }
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { listarMetas, guardarMeta } from '../../apps/contabilidad/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const metas = await listarMetas();
  return json(200, { metas });
});

export const PUT = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  const meta = await guardarMeta(body);
  return json(200, meta);
});
