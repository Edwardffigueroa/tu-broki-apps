/**
 * POST /api/diagramas/duplicar?id=
 */

import { json, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { duplicarDiagrama } from '../../apps/diagramas/server/servicio.js';

export const POST = manejar(async (request) => {
  exigirSesion(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  const diagrama = await duplicarDiagrama(id);
  return json(201, diagrama);
});
