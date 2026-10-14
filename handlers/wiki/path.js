import { json, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { caminoCorto, resolverRef } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  const sp = new URL(request.url).searchParams;
  const from = await resolverRef(sp.get('from') || '');
  const to = await resolverRef(sp.get('to') || '');
  if (!from || !to) throw new ErrorHttp(404, 'from/to no encontrados.', { code: 'page_not_found' });
  return json(200, {
    path: await caminoCorto(from.id, to.id, { maxDepth: Number(sp.get('max') || 6) }),
  });
});
