import { json, manejar } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { listarArchivos, resolverRef } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  const sp = new URL(request.url).searchParams;
  let under = null;
  if (sp.get('under')) {
    const r = await resolverRef(sp.get('under'));
    under = r?.id || null;
  }
  return json(200, {
    files: await listarArchivos({
      under,
      mime: sp.get('mime') || null,
      limit: Number(sp.get('limit') || 50),
    }),
  });
});
