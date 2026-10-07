/**
 * PUT    /api/wiki/draft?id=  { title?, content, draft_revision, base_version_id? }
 * DELETE /api/wiki/draft?id=
 */

import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { guardarBorrador, descartarBorrador } from '../../apps/wiki/server/servicio.js';

function idDe(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  return id;
}

export const PUT = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  return json(200, await guardarBorrador(idDe(request), body));
});

export const DELETE = manejar(async (request) => {
  exigirSesion(request);
  return json(200, await descartarBorrador(idDe(request)));
});
