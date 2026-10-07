/**
 * POST /api/wiki/export → { files, assets } listos para armar ZIP en el cliente
 */

import { json, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { exportarTodo } from '../../apps/wiki/server/servicio.js';

export const POST = manejar(async (request) => {
  exigirSesion(request);
  return json(200, await exportarTodo());
});

export const GET = POST;
