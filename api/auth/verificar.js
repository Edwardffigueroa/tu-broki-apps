/**
 * POST /api/auth/verificar { email, codigo } → cookie de sesión (30 días).
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { verificarCodigo, crearToken, cookieSesion } from '../../shared/auth.js';

export const POST = manejar(async (request) => {
  const { email, codigo } = await leerJson(request);
  const resultado = await verificarCodigo(email, codigo);
  return json(
    200,
    { ok: true, email: resultado.email },
    { 'Set-Cookie': cookieSesion(crearToken()) },
  );
});
