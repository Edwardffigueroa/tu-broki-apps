import { json, manejar } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { listarTags } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  const limit = Number(new URL(request.url).searchParams.get('limit') || 100);
  return json(200, { tags: await listarTags({ limit }) });
});
