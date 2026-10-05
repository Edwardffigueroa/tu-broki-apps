/**
 * POST /api/auth/login { clave } → cookie de sesión (30 días).
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { claveValida, crearToken, cookieSesion } from '../../shared/auth.js';

const ESPERA_FALLO_MS = 600;

export const POST = manejar(async (request) => {
  const { clave } = await leerJson(request);
  if (!claveValida(clave)) {
    // Frena intentos por fuerza bruta sin necesitar estado compartido.
    await new Promise((r) => setTimeout(r, ESPERA_FALLO_MS));
    return json(401, { error: 'Clave incorrecta.' });
  }
  return json(200, { ok: true }, { 'Set-Cookie': cookieSesion(crearToken()) });
});
