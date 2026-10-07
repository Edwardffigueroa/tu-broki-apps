/**
 * POST /api/wiki/import  { items, assets?, resolve_links? }
 */

import { json, leerJson, manejar } from '../../shared/http.js';
import { exigirSesion } from '../../shared/auth.js';
import { importarLote } from '../../apps/wiki/server/servicio.js';

export const POST = manejar(async (request) => {
  exigirSesion(request);
  const body = await leerJson(request);
  const informe = await importarLote({
    items: body.items || [],
    assets: body.assets || [],
    assetMap: body.asset_map || {},
    resolveLinks: body.resolve_links !== false,
  });
  return json(200, informe);
});
