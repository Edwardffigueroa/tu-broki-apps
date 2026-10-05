/**
 * POST /api/wiki/assets  { mime_type, original_name?, base64 }
 * GET  /api/wiki/assets?id=  → bytes del archivo
 */

import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { subirAsset, servirAsset } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  exigirSesion(request);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');
  const asset = await servirAsset(id);
  return new Response(asset.content, {
    status: 200,
    headers: {
      'Content-Type': asset.mime_type,
      'Content-Length': String(asset.size_bytes),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `${
        asset.mime_type === 'application/pdf' || asset.mime_type?.startsWith('image/') || asset.mime_type === 'text/html'
          ? 'inline'
          : 'attachment'
      }; filename="${encodeURIComponent(asset.original_name || id)}"`,
    },
  });
});

export const POST = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  if (!body.base64 || !body.mime_type) {
    throw new ErrorHttp(400, 'Se requieren mime_type y base64.');
  }
  const buffer = Buffer.from(body.base64, 'base64');
  const asset = await subirAsset({
    buffer,
    mimeType: body.mime_type,
    originalName: body.original_name || null,
  });
  return json(201, asset);
});
