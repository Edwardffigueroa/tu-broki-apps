import { json, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { vecinos, resolverRef } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  const sp = new URL(request.url).searchParams;
  const ref = sp.get('id') || sp.get('page') || sp.get('ref');
  if (!ref) throw new ErrorHttp(400, 'Falta id/page.');
  const meta = await resolverRef(ref);
  if (!meta) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  return json(200, {
    neighbors: await vecinos(meta.id, {
      depth: Number(sp.get('depth') || 1),
      direction: sp.get('direction') || 'both',
      limit: Number(sp.get('limit') || 50),
    }),
  });
});
