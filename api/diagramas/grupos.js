/**
 * GET    /api/diagramas/grupos
 * POST   /api/diagramas/grupos  { nombre, color?, orden? }
 * PATCH  /api/diagramas/grupos?id=  { nombre?, color?, orden? }
 * DELETE /api/diagramas/grupos?id=
 */

import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import {
  listarGrupos,
  crearGrupo,
  actualizarGrupo,
  eliminarGrupo,
} from '../../apps/diagramas/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  return json(200, { grupos: await listarGrupos() });
});

export const POST = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  return json(201, await crearGrupo(body));
});

export const PATCH = manejar(async (request) => {
  exigirSesion(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  const body = await leerJson(request);
  return json(200, await actualizarGrupo(id, body));
});

export const DELETE = manejar(async (request) => {
  exigirSesion(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  return json(200, await eliminarGrupo(id));
});
