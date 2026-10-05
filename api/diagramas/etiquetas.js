/**
 * GET    /api/diagramas/etiquetas
 * POST   /api/diagramas/etiquetas  { nombre, color? }
 * PATCH  /api/diagramas/etiquetas?id=  { nombre?, color? }
 * DELETE /api/diagramas/etiquetas?id=
 */

import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import {
  listarEtiquetas,
  crearEtiqueta,
  actualizarEtiqueta,
  eliminarEtiqueta,
} from '../../apps/diagramas/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  return json(200, { etiquetas: await listarEtiquetas() });
});

export const POST = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  return json(201, await crearEtiqueta(body));
});

export const PATCH = manejar(async (request) => {
  exigirSesion(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  const body = await leerJson(request);
  return json(200, await actualizarEtiqueta(id, body));
});

export const DELETE = manejar(async (request) => {
  exigirSesion(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  return json(200, await eliminarEtiqueta(id));
});
