/**
 * Acceso con clave compartida (una sola para todo tu-broki-apps).
 *
 * Flujo: POST /api/auth/login { clave } → cookie httpOnly firmada (HMAC-SHA256)
 * con fecha de expiración. Cada API protegida llama `exigirSesion(request)`.
 * No hay sesiones en base de datos: el token es autocontenido y verificable.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from './env.js';
import { ErrorHttp } from './http.js';

export const COOKIE = 'tb_sesion';
const DIAS_SESION = 30;

function firmar(payload, secreto) {
  return createHmac('sha256', secreto).update(payload).digest('base64url');
}

function igualesSeguro(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function claveValida(clave, esperada = env('APPS_PASSWORD')) {
  return typeof clave === 'string' && clave.length > 0 && igualesSeguro(clave, esperada);
}

/** Token `exp.firma` donde exp es epoch en segundos. */
export function crearToken(secreto = env('SESSION_SECRET'), ahora = Date.now()) {
  const exp = Math.floor(ahora / 1000) + DIAS_SESION * 24 * 3600;
  return `${exp}.${firmar(String(exp), secreto)}`;
}

export function verificarToken(token, secreto = env('SESSION_SECRET'), ahora = Date.now()) {
  if (!token || typeof token !== 'string') return false;
  const [exp, firma] = token.split('.');
  if (!exp || !firma || !/^\d+$/.test(exp)) return false;
  if (Number(exp) * 1000 < ahora) return false;
  return igualesSeguro(firma, firmar(exp, secreto));
}

export function leerCookie(request, nombre = COOKIE) {
  const raw = request.headers.get('cookie') || '';
  for (const parte of raw.split(';')) {
    const [k, ...resto] = parte.trim().split('=');
    if (k === nombre) return decodeURIComponent(resto.join('='));
  }
  return null;
}

// En local (http://127.0.0.1) Safari rechaza cookies `Secure`; en Vercel siempre va con HTTPS.
function atributosCookie() {
  const seguro = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
  return `Path=/; HttpOnly; SameSite=Lax${seguro ? '; Secure' : ''}`;
}

export function cookieSesion(token) {
  const maxAge = DIAS_SESION * 24 * 3600;
  return `${COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; ${atributosCookie()}`;
}

export function cookieBorrar() {
  return `${COOKIE}=; Max-Age=0; ${atributosCookie()}`;
}

export function haySesion(request) {
  return verificarToken(leerCookie(request));
}

/** Úsalo al inicio de cualquier API privada. Lanza 401 si no hay sesión válida. */
export function exigirSesion(request) {
  if (!haySesion(request)) {
    throw new ErrorHttp(401, 'Necesitas iniciar sesión.', { codigo: 'sin_sesion' });
  }
}
