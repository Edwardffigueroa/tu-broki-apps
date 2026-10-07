/**
 * POST /api/auth/logout → borra la cookie de sesión.
 */

import { json, manejar } from '../../shared/http.js';
import { cookieBorrar } from '../../shared/auth.js';

export const POST = manejar(async () => {
  return json(200, { ok: true }, { 'Set-Cookie': cookieBorrar() });
});
