/**
 * Auth Bearer para el MCP Wiki (tokens tbw_… hasheados en wiki.mcp_tokens).
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { getPrisma } from './prisma.js';
import { env } from './env.js';
import { ErrorHttp } from './http.js';
import { emailsPermitidos, normalizarEmail, exigirSesion, leerCookie, COOKIE, verificarToken } from './auth.js';

const ESPERA_MS = 300;
const RATE_TOTAL = 120;
const RATE_WRITE = 20;

/** @type {Map<string, { t: number, n: number, w: number }>} */
const rateBuckets = new Map();

function q(db) {
  return (strings, ...values) => db.$queryRaw(Prisma.sql(strings, ...values));
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function generarTokenClaro() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let b64 = Buffer.from(bytes).toString('base64url');
  return `tbw_${b64}`;
}

function allowlist() {
  try {
    return emailsPermitidos(env('MCP_ALLOWED_EMAILS', env('APPS_ALLOWED_EMAILS')));
  } catch {
    return emailsPermitidos(env('APPS_ALLOWED_EMAILS'));
  }
}

function scopesDe(arr) {
  const set = new Set(arr || []);
  if (set.has('admin')) {
    set.add('write');
    set.add('read');
  } else if (set.has('write')) {
    set.add('read');
  }
  return set;
}

function leerBearer(request) {
  const h = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(\S+)/i);
  return m ? m[1].trim() : null;
}

/**
 * @returns {Promise<{ tokenId: string, label: string, email: string, scopes: Set<string>, author: string }>}
 */
export async function autenticarBearerMcp(request) {
  const raw = leerBearer(request);
  if (!raw || !raw.startsWith('tbw_')) {
    await new Promise((r) => setTimeout(r, ESPERA_MS));
    throw new ErrorHttp(401, 'Necesitas un token MCP (Bearer).', { codigo: 'sin_token' });
  }

  const hash = hashToken(raw);
  const [row] = await q(getPrisma())`
    select id, label, email, scopes, expires_at, revoked_at
    from wiki.mcp_tokens
    where token_hash = ${hash}
    limit 1
  `;

  if (
    !row ||
    row.revoked_at ||
    (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) ||
    !allowlist().has(normalizarEmail(row.email))
  ) {
    await new Promise((r) => setTimeout(r, ESPERA_MS));
    throw new ErrorHttp(401, 'Token inválido o vencido.', { codigo: 'token_invalido' });
  }

  // best-effort touch
  void q(getPrisma())`
    update wiki.mcp_tokens
    set last_used_at = now(), use_count = use_count + 1
    where id = ${row.id}::uuid
  `.catch(() => {});

  const scopes = scopesDe(row.scopes);
  return {
    tokenId: row.id,
    label: row.label,
    email: normalizarEmail(row.email),
    scopes,
    author: `MCP · ${row.label}`,
  };
}

export function exigirScope(ctx, scope) {
  if (!ctx?.scopes?.has(scope)) {
    throw new ErrorHttp(403, `Scope insuficiente: se requiere "${scope}".`, {
      codigo: 'scope_insuficiente',
      scopes: [...(ctx?.scopes || [])],
    });
  }
}

export function rateLimitMcp(ctx, esEscritura = false) {
  const id = ctx.tokenId;
  const now = Date.now();
  let b = rateBuckets.get(id);
  if (!b || now - b.t > 60_000) {
    b = { t: now, n: 0, w: 0 };
    rateBuckets.set(id, b);
  }
  b.n += 1;
  if (esEscritura) b.w += 1;
  if (b.n > RATE_TOTAL || (esEscritura && b.w > RATE_WRITE)) {
    throw new ErrorHttp(429, 'Demasiadas peticiones. Espera un minuto.', { codigo: 'rate_limit' });
  }
}

/**
 * Cookie de sesión UI o Bearer MCP.
 * @param {string} [scopeMin] scope mínimo si entra por Bearer
 */
export async function exigirAuthWiki(request, scopeMin = 'read') {
  const bearer = leerBearer(request);
  if (bearer?.startsWith('tbw_')) {
    const ctx = await autenticarBearerMcp(request);
    exigirScope(ctx, scopeMin);
    return { tipo: 'mcp', ...ctx };
  }
  exigirSesion(request);
  return { tipo: 'sesion' };
}

export function haySesionOBearer(request) {
  if (leerBearer(request)?.startsWith('tbw_')) return true;
  return verificarToken(leerCookie(request, COOKIE));
}
