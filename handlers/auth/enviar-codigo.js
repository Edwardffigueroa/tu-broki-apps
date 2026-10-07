/**
 * POST /api/auth/enviar-codigo { email } → dispara OTP por correo (allowlist).
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { enviarCodigo } from '../../shared/auth.js';

export const POST = manejar(async (request) => {
  const { email } = await leerJson(request);
  const resultado = await enviarCodigo(email);
  return json(200, { ok: true, email: resultado.email });
});
