import { json, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { resolverRef, resolverRefs } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  const sp = new URL(request.url).searchParams;
  const refs = sp.get('refs');
  if (refs) {
    return json(200, { results: await resolverRefs(refs.split(',').map((s) => s.trim()).filter(Boolean)) });
  }
  const ref = sp.get('ref');
  if (!ref) throw new ErrorHttp(400, 'Falta ref o refs.');
  const hit = await resolverRef(ref, { includeDeleted: sp.get('include_deleted') === '1' });
  if (!hit) return json(404, { error: 'No encontrada', code: 'page_not_found' });
  return json(200, hit);
});
