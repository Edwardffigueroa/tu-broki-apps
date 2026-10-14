import { json, manejar } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { stats } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  return json(200, await stats());
});
