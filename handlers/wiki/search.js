/**
 * GET /api/wiki/search?q=&mode=&under=&kind=&limit=
 */

import { json, manejar } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { buscarAvanzado, resolverRef } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  const sp = new URL(request.url).searchParams;
  const q = sp.get('q') || '';
  const limitRaw = Number(sp.get('limit') || 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  let under = null;
  if (sp.get('under')) {
    const r = await resolverRef(sp.get('under'));
    under = r?.id || null;
  }
  return json(200, {
    results: await buscarAvanzado({
      q,
      limit,
      mode: sp.get('mode') || 'fts',
      under,
      kind: sp.get('kind') || null,
    }),
    q,
  });
});
