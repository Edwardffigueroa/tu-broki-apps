/**
 * POST /api/wiki/documents  → crear página-archivo (PDF/HTML/imagen) como hija
 * PUT  /api/wiki/documents?id= → reemplazar el binario de un documento existente
 *
 * Body: { title?, parent_id?, mime_type, base64, original_name?, note? }
 */

import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { crearDocumento, reemplazarDocumento } from '../../apps/wiki/server/servicio.js';

function idDe(request) {
  return new URL(request.url).searchParams.get('id');
}

export const POST = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  if (!body.base64 || !body.mime_type) {
    throw new ErrorHttp(400, 'Se requieren mime_type y base64.');
  }
  const page = await crearDocumento({
    title: body.title,
    parentId: body.parent_id || null,
    mimeType: body.mime_type,
    base64: body.base64,
    originalName: body.original_name || null,
    note: body.note || '',
  });
  return json(201, page);
});

export const PUT = manejar(async (request) => {
  exigirSesion(request);
  const id = idDe(request);
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  const body = await leerJson(request);
  if (!body.base64 || !body.mime_type) {
    throw new ErrorHttp(400, 'Se requieren mime_type y base64.');
  }
  const page = await reemplazarDocumento(id, {
    mimeType: body.mime_type,
    base64: body.base64,
    originalName: body.original_name || null,
  });
  return json(200, page);
});
