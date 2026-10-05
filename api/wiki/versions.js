/**
 * GET  /api/wiki/versions?id=           → lista
 * POST /api/wiki/versions?id=           → guardar versión
 * GET  /api/wiki/versions?id=&vid=      → detalle de una versión
 * POST /api/wiki/versions?id=&vid=&accion=restaurar
 */

import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import {
  listarVersiones,
  obtenerVersion,
  guardarVersion,
  restaurar,
} from '../../apps/wiki/server/servicio.js';

function idDe(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  return id;
}

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const url = new URL(request.url);
  const id = idDe(request);
  const vid = url.searchParams.get('vid');
  if (vid) return json(200, await obtenerVersion(id, vid));
  return json(200, { versions: await listarVersiones(id) });
});

export const POST = manejar(async (request) => {
  exigirSesion(request);
  const url = new URL(request.url);
  const id = idDe(request);
  const vid = url.searchParams.get('vid');
  const accion = url.searchParams.get('accion');

  if (vid && accion === 'restaurar') {
    return json(201, await restaurar(id, vid));
  }

  const body = await leerJson(request);
  const r = await guardarVersion(id, body);
  return json(201, r);
});
