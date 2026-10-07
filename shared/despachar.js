/**
 * Despacha una petición al handler HTTP thin de un dominio.
 *
 * En Vercel (plan Hobby, framework Other) cada archivo bajo `api/` = 1 función.
 * Usamos un entrypoint por dominio (`api/wiki.js`) + rewrites que preservan
 * el recurso en `?__path=` o, en local, el pathname `/api/<dominio>/<recurso>`.
 *
 * Nota: en el runtime de Vercel `request.url` a menudo llega como path relativo
 * (`/api/auth/…`), no como URL absoluta — `new URL()` sin base falla.
 */

import { json } from './http.js';

function headerDe(request, nombre) {
  const h = request?.headers;
  if (!h) return null;
  if (typeof h.get === 'function') return h.get(nombre);
  return h[nombre] || h[nombre.toLowerCase()] || null;
}

/** Construye un URL absoluto aunque `request.url` sea relativo (caso Vercel). */
export function urlDe(request) {
  const raw = request?.url || '/';
  if (/^https?:\/\//i.test(raw)) return new URL(raw);
  const host = headerDe(request, 'x-forwarded-host') || headerDe(request, 'host') || 'localhost';
  const proto = headerDe(request, 'x-forwarded-proto') || 'https';
  return new URL(raw, `${proto}://${host}`);
}

/** Clona el Request con URL absoluta para que los handlers puedan hacer `new URL(request.url)`. */
export function requestAbsoluto(request) {
  const abs = urlDe(request).href;
  if (typeof request?.url === 'string' && request.url === abs) return request;
  if (typeof Request !== 'undefined' && request instanceof Request) {
    return new Request(abs, request);
  }
  return new Request(abs, {
    method: request?.method || 'GET',
    headers: request?.headers,
  });
}

export function recursoDe(request, dominio) {
  const url = urlDe(request);
  const desdeQuery = url.searchParams.get('__path') || url.searchParams.get('path');
  if (desdeQuery) {
    const segmento = desdeQuery.split('/').filter(Boolean)[0];
    if (segmento) return segmento;
  }
  const limpio = url.pathname.replace(/\/+$/, '');
  const prefijo = `/api/${dominio}/`;
  if (!limpio.startsWith(prefijo)) return null;
  const resto = limpio.slice(prefijo.length);
  if (!resto || resto.includes('/')) return null;
  return resto;
}

/**
 * @param {Request} request
 * @param {string} dominio  p.ej. 'wiki'
 * @param {Record<string, Record<string, Function>>} rutas  recurso → { GET, POST, … }
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

/** Expone los verbos HTTP que Vercel/Web espera, todos al mismo despachador. */
export function entrypoint(dominio, rutas) {
  const handle = (request) => despachar(request, dominio, rutas);
  return {
    GET: handle,
    POST: handle,
    PUT: handle,
    PATCH: handle,
    DELETE: handle,
    default: handle,
  };
}
