/**
 * Despacha una petición al handler HTTP thin de un dominio.
 *
 * En Vercel (plan Hobby, framework Other) cada archivo bajo `api/` = 1 función.
 * Usamos un entrypoint por dominio (`api/wiki.js`) + rewrites que preservan
 * el recurso en `?__path=` o, en local, el pathname `/api/<dominio>/<recurso>`.
 */

import { json } from './http.js';

export function recursoDe(request, dominio) {
  const url = new URL(request.url);
  const desdeQuery = url.searchParams.get('__path');
  if (desdeQuery) {
    const segmento = desdeQuery.split('/').filter(Boolean)[0];
    return segmento || null;
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
  return handler(request);
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
