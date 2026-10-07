/**
 * GET /api/wiki/search?q=
 */

import { json, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { buscar } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const q = new URL(request.url).searchParams.get('q') || '';
  const limitRaw = Number(new URL(request.url).searchParams.get('limit') || 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  return json(200, { results: await buscar(q, { limit }), q });
});
