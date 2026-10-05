/**
 * GET    /api/diagramas/diagrama?id=
 * PATCH  /api/diagramas/diagrama?id=  { revision, titulo?, modelo?, grupo_id?, archived?, etiqueta_ids? }
 * DELETE /api/diagramas/diagrama?id=
 */

import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import {
  obtenerDiagrama,
  actualizarDiagrama,
  eliminarDiagrama,
} from '../../apps/diagramas/server/servicio.js';

function idDe(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  return id;
}

export const GET = manejar(async (request) => {
  exigirSesion(request);
  return json(200, await obtenerDiagrama(idDe(request)));
});

export const PATCH = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  return json(200, await actualizarDiagrama(idDe(request), body));
});

export const DELETE = manejar(async (request) => {
  exigirSesion(request);
  return json(200, await eliminarDiagrama(idDe(request)));
});
