import { json, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { grep, resolverRef } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  const sp = new URL(request.url).searchParams;
  const pattern = sp.get('pattern');
  if (!pattern) throw new ErrorHttp(400, 'Falta pattern.');
  let under = null;
  if (sp.get('under')) {
    const r = await resolverRef(sp.get('under'));
    if (!r) throw new ErrorHttp(404, 'under no encontrado.', { code: 'page_not_found' });
    under = r.id;
  }
  return json(200, {
    matches: await grep({
      pattern,
      regex: sp.get('regex') === '1',
      caseSensitive: sp.get('case') === '1',
      under,
      maxMatches: Number(sp.get('limit') || 50),
    }),
  });
});
