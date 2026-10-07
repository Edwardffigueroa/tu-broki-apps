/**
 * Despacha una petición al handler HTTP thin de un dominio.
 *
 * En Vercel (Hobby, framework Other) cada archivo bajo `api/` = 1 función.
 * Entrypoints usan el handler Node clásico `(req, res)` — más fiable que
 * exportar GET/POST Web cuando `request.url` llega relativo.
 *
 * Rewrites: `/api/<dominio>/<recurso>` → `/api/<dominio>` (el pathname original
 * suele conservarse en `req.url` para extraer el recurso).
 */

import { json } from './http.js';

/** Marca de versión para confirmar en logs de Vercel qué build está corriendo. */
export const DESPACHAR_STAMP = 'despachar-v3-node-2026-10-07';

function headerDe(requestOrHeaders, nombre) {
  const h = requestOrHeaders?.headers ?? requestOrHeaders;
  if (!h) return null;
  if (typeof h.get === 'function') return h.get(nombre);
  const v = h[nombre] || h[nombre.toLowerCase()];
  return Array.isArray(v) ? v[0] : v || null;
}

/** Path + query crudos sin depender de `new URL()` (Vercel pasa paths relativos). */
export function partesUrl(raw) {
  const s = String(raw || '/');
  const sinOrig = s.replace(/^https?:\/\/[^/]+/i, '');
  const q = sinOrig.indexOf('?');
  const pathname = (q >= 0 ? sinOrig.slice(0, q) : sinOrig).replace(/\/+$/, '') || '/';
  const search = q >= 0 ? sinOrig.slice(q + 1) : '';
  return { pathname, search, params: new URLSearchParams(search) };
}

/** Construye URL absoluta para los handlers thin que hacen `new URL(request.url)`. */
export function urlDe(request) {
  const raw = request?.url || '/';
  if (/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw);
    } catch {
      /* caer al path relativo */
    }
  }
  const host = headerDe(request, 'x-forwarded-host') || headerDe(request, 'host') || 'localhost';
  const proto = headerDe(request, 'x-forwarded-proto') || 'https';
  return new URL(raw.startsWith('/') ? raw : `/${raw}`, `${proto}://${host}`);
}

export function requestAbsoluto(request) {
  const abs = urlDe(request).href;
  if (typeof request?.url === 'string' && request.url === abs && typeof Request !== 'undefined' && request instanceof Request) {
    return request;
  }
  if (typeof Request !== 'undefined' && request instanceof Request) {
    return new Request(abs, request);
  }
  return new Request(abs, {
    method: request?.method || 'GET',
    headers: request?.headers,
  });
}

export function recursoDe(request, dominio) {
  const { pathname, params } = partesUrl(request?.url);
  const desdeQuery = params.get('__path') || params.get('path');
  if (desdeQuery) {
    const segmento = desdeQuery.split('/').filter(Boolean)[0];
    if (segmento) return segmento;
  }
  const prefijo = `/api/${dominio}/`;
  if (!pathname.startsWith(prefijo)) return null;
  const resto = pathname.slice(prefijo.length);
  if (!resto || resto.includes('/')) return null;
  return resto;
}

/**
 * @param {Request} request
 * @param {string} dominio
 * @param {Record<string, Record<string, Function>>} rutas
 */
export async function despachar(request, dominio, rutas) {
  const recurso = recursoDe(request, dominio);
  if (!recurso || !rutas[recurso]) {
    return json(404, { error: `No existe la ruta /api/${dominio}/${recurso || ''}` });
  }
  const modulo = rutas[recurso];
  const handler = modulo[request.method] || modulo.default;
  if (typeof handler !== 'function') {
    return json(405, { error: `Método ${request.method} no permitido` });
  }
  return handler(requestAbsoluto(request));
}

async function leerCuerpoNode(req) {
  if (req.body != null) {
    if (Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === 'string') return req.body;
    return JSON.stringify(req.body);
  }
  if (typeof req[Symbol.asyncIterator] !== 'function') return undefined;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

/** Convierte IncomingMessage de Vercel/Node → Web Request absoluto. */
export async function incomingARequest(req) {
  if (typeof Request !== 'undefined' && req instanceof Request) {
    return requestAbsoluto(req);
  }
  const host = headerDe(req, 'x-forwarded-host') || headerDe(req, 'host') || 'localhost';
  const proto = headerDe(req, 'x-forwarded-proto') || 'https';
  const path = req.url || '/';
  const url = path.startsWith('http') ? path : `${proto}://${host}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers || {})) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, String(x)));
    else headers.set(k, String(v));
  }
  const method = req.method || 'GET';
  const init = { method, headers };
  if (!['GET', 'HEAD'].includes(method)) {
    const body = await leerCuerpoNode(req);
    if (body != null) init.body = body;
  }
  return new Request(url, init);
}

export async function escribirNodeResponse(res, response) {
  res.statusCode = response.status;
  const cookies = response.headers.getSetCookie?.() || [];
  response.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') return;
    res.setHeader(k, v);
  });
  if (cookies.length) res.setHeader('set-cookie', cookies);
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

/**
 * Handler Node `(req, res)` — forma canónica de Serverless Function en Vercel Other.
 * También se puede invocar como Web Handler `(request) => Response` (dev / export GET).
 */
export function entrypoint(dominio, rutas) {
  async function handleWeb(request) {
    return despachar(request, dominio, rutas);
  }

  async function handleNode(req, res) {
    // Distinguir Web Request vs IncomingMessage: Web no tiene res / tiene arrayBuffer.
    if (res == null || typeof res?.end !== 'function') {
      return handleWeb(req);
    }
    try {
      if (!globalThis.__tb_despachar_stamp) {
        globalThis.__tb_despachar_stamp = DESPACHAR_STAMP;
        console.info(`[tubroki] ${DESPACHAR_STAMP} dominio=${dominio}`);
      }
      const request = await incomingARequest(req);
      const response = await despachar(request, dominio, rutas);
      await escribirNodeResponse(res, response);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Error interno. Inténtalo de nuevo en un momento.' }));
      }
    }
  }

  handleNode.GET = handleWeb;
  handleNode.POST = handleWeb;
  handleNode.PUT = handleWeb;
  handleNode.PATCH = handleWeb;
  handleNode.DELETE = handleWeb;

  return {
    GET: handleWeb,
    POST: handleWeb,
    PUT: handleWeb,
    PATCH: handleWeb,
    DELETE: handleWeb,
    default: handleNode,
  };
}
