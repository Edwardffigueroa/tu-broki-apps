/**
 * POST /api/wiki/assets  { mime_type, original_name?, base64 }
 * GET  /api/wiki/assets?id=  → bytes (sesión/Bearer o firma HMAC)
 */

import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { haySesionOBearer, exigirAuthWiki } from '../../shared/mcp-auth.js';
import { subirAsset, servirAsset } from '../../apps/wiki/server/servicio.js';
import { verificarFirma } from '../../apps/wiki/mcp/signed-url.mjs';

export const GET = manejar(async (request) => {
  const sp = new URL(request.url).searchParams;
  const id = sp.get('id');
  if (!id) throw new ErrorHttp(400, 'Falta el parámetro id.');

  const exp = sp.get('exp');
  const sig = sp.get('sig');
  if (exp && sig) {
    if (!verificarFirma(id, exp, sig)) {
      throw new ErrorHttp(401, 'Firma inválida o vencida.', { codigo: 'firma_invalida' });
    }
  } else if (haySesionOBearer(request)) {
    await exigirAuthWiki(request, 'read');
  } else {
    exigirSesion(request);
  }

  const asset = await servirAsset(id);
  const disposition =
    asset.mime_type === 'application/pdf' ||
    asset.mime_type?.startsWith('image/') ||
    asset.mime_type === 'text/html'
      ? 'inline'
      : 'attachment';

  return new Response(asset.content, {
    status: 200,
    headers: {
      'Content-Type': asset.mime_type,
      'Content-Length': String(asset.size_bytes),
      'Cache-Control': 'private, max-age=60',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(asset.original_name || id)}"`,
    },
  });
});

export const POST = manejar(async (request) => {
  await exigirAuthWiki(request, 'write');
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
