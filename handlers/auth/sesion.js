/**
 * GET /api/auth/sesion → { activa: boolean }. Lo usa el launcher para decidir qué mostrar.
 */

import { json, manejar } from '../../shared/http.js';
import { haySesion } from '../../shared/auth.js';

export const GET = manejar(async (request) => {
  return json(200, { activa: haySesion(request) });
});
