/**
 * GET    /api/wiki/page?id=
 * PATCH  /api/wiki/page?id=  { title, parent_id, position, icon, metadata, rewrite_links }
 * DELETE /api/wiki/page?id=  → papelera
 */

import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { obtener, actualizar, eliminar } from '../../apps/wiki/server/servicio.js';

function idDe(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  return id;
}

export const GET = manejar(async (request) => {
  exigirSesion(request);
  return json(200, await obtener(idDe(request)));
});

export const PATCH = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  return json(200, await actualizar(idDe(request), body));
});

export const DELETE = manejar(async (request) => {
  exigirSesion(request);
  return json(200, await eliminar(idDe(request)));
});
