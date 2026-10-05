/**
 * Cookie de sesión para scripts locales (seed / smoke) sin pasar por OTP.
 * Requiere SESSION_SECRET en el entorno (vía .env.local).
 */

import { COOKIE, crearToken } from '../shared/auth.js';

export function cookieSesionScript() {
  return `${COOKIE}=${encodeURIComponent(crearToken())}`;
}
