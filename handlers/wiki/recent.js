import { json, manejar } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { recientes } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  const sp = new URL(request.url).searchParams;
  return json(200, {
    recent: await recientes({
      limit: Number(sp.get('limit') || 20),
      since: sp.get('since') || null,
      author: sp.get('author') || null,
    }),
  });
});
