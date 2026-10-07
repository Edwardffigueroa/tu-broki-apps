/**
 * GET  /api/wiki/pages           → árbol activo
 * GET  /api/wiki/pages?papelera=1 → papelera
 * POST /api/wiki/pages           → crear página
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { arbol, crear } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const url = new URL(request.url);
  const papelera = url.searchParams.get('papelera') === '1';
  return json(200, { pages: await arbol({ papelera }) });
});

export const POST = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  const page = await crear({
    title: body.title,
    parentId: body.parent_id || null,
    icon: body.icon || null,
    content: body.content ?? '',
    metadata: body.metadata || {},
    source: body.source,
    message: body.message,
  });
  return json(201, page);
});
