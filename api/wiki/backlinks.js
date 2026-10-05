/**
 * GET /api/wiki/backlinks?id=
 */

import { json, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { backlinks } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  return json(200, { backlinks: await backlinks(id) });
});
