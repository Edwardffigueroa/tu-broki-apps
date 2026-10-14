import { json, manejar } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { huerfanas } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  const sp = new URL(request.url).searchParams;
  return json(200, {
    orphans: await huerfanas({
      limit: Number(sp.get('limit') || 50),
      includeFiles: sp.get('include_files') === '1',
    }),
  });
});
