/**
 * Acceso por email OTP (Supabase Auth) + cookie httpOnly firmada.
 *
 * Flujo:
 *   POST /api/auth/enviar-codigo { email }  → Supabase signInWithOtp (solo allowlist)
 *   POST /api/auth/verificar { email, codigo } → verifyOtp → cookie tb_sesion
 *
 * Cada API protegida llama `exigirSesion(request)`.
 * No hay sesiones en base de datos: el token HMAC es autocontenido y verificable.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { ErrorHttp } from './http.js';

export const COOKIE = 'tb_sesion';
const DIAS_SESION = 30;
export const ESPERA_FALLO_MS = 600;

function firmar(payload, secreto) {
  return createHmac('sha256', secreto).update(payload).digest('base64url');
}

function igualesSeguro(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/** Lista de correos con acceso total (APPS_ALLOWED_EMAILS). */
export function emailsPermitidos(lista = env('APPS_ALLOWED_EMAILS')) {
  return new Set(
    String(lista)
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function emailPermitido(email, lista) {
  const normalizado = normalizarEmail(email);
  if (!normalizado || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizado)) return false;
  return emailsPermitidos(lista).has(normalizado);
}

let clienteSupabase;

export function clienteAuth() {
  if (!clienteSupabase) {
    clienteSupabase = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return clienteSupabase;
}

/** Envía OTP por correo. Solo allowlist; rechazo genérico con delay. */
export async function enviarCodigo(email) {
  const normalizado = normalizarEmail(email);
  if (!emailPermitido(normalizado)) {
    await new Promise((r) => setTimeout(r, ESPERA_FALLO_MS));
    throw new ErrorHttp(403, 'No tienes acceso con ese correo.', { codigo: 'email_no_autorizado' });
  }

  const { error } = await clienteAuth().auth.signInWithOtp({
    email: normalizado,
    options: { shouldCreateUser: true },
  });

  if (error) {
    console.error('[auth] signInWithOtp:', error.message);
    throw new ErrorHttp(502, 'No pudimos enviar el código. Inténtalo de nuevo en un momento.', {
      codigo: 'otp_envio_fallido',
    });
  }

  return { ok: true, email: normalizado };
}

/** Verifica OTP y, si el correo sigue permitido, lista lista para emitir cookie. */
export async function verificarCodigo(email, codigo) {
  const normalizado = normalizarEmail(email);
  const token = typeof codigo === 'string' ? codigo.trim() : '';

  if (!emailPermitido(normalizado)) {
    await new Promise((r) => setTimeout(r, ESPERA_FALLO_MS));
    throw new ErrorHttp(403, 'No tienes acceso con ese correo.', { codigo: 'email_no_autorizado' });
  }

  if (!/^\d{6,8}$/.test(token)) {
    await new Promise((r) => setTimeout(r, ESPERA_FALLO_MS));
    throw new ErrorHttp(401, 'Código incorrecto o vencido.', { codigo: 'otp_invalido' });
  }

  const { data, error } = await clienteAuth().auth.verifyOtp({
    email: normalizado,
    token,
    type: 'email',
  });

  if (error || !data?.session) {
    await new Promise((r) => setTimeout(r, ESPERA_FALLO_MS));
    throw new ErrorHttp(401, 'Código incorrecto o vencido.', { codigo: 'otp_invalido' });
  }

  const emailSesion = normalizarEmail(data.user?.email || normalizado);
  if (!emailPermitido(emailSesion)) {
    await new Promise((r) => setTimeout(r, ESPERA_FALLO_MS));
    throw new ErrorHttp(403, 'No tienes acceso con ese correo.', { codigo: 'email_no_autorizado' });
  }

  return { ok: true, email: emailSesion };
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
