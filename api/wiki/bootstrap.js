/**
 * GET /api/wiki/bootstrap → { pages, contents, bootstrapped_at }
 *
 * Una sola lectura para calentar el cache del cliente al abrir la Wiki.
 */

import { json, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { bootstrap } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  return json(200, await bootstrap());
});
