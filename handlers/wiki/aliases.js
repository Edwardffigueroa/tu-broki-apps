import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { listarAliases, agregarAlias, quitarAlias, resolverRef } from '../../apps/wiki/server/servicio.js';

export const GET = manejar(async (request) => {
  await exigirAuthWiki(request, 'read');
  const sp = new URL(request.url).searchParams;
  let pageId = null;
  if (sp.get('page_id') || sp.get('page')) {
    const r = await resolverRef(sp.get('page_id') || sp.get('page'));
    if (!r) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
    pageId = r.id;
  }
  return json(200, { aliases: await listarAliases({ pageId }) });
});

export const POST = manejar(async (request) => {
  await exigirAuthWiki(request, 'write');
  const body = await leerJson(request);
  if (!body.alias || !(body.page_id || body.page)) {
    throw new ErrorHttp(400, 'Se requieren page_id/page y alias.');
  }
  const meta = await resolverRef(body.page_id || body.page);
  if (!meta) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  return json(201, await agregarAlias(meta.id, body.alias));
});

export const DELETE = manejar(async (request) => {
  await exigirAuthWiki(request, 'write');
  const alias = new URL(request.url).searchParams.get('alias');
  if (!alias) throw new ErrorHttp(400, 'Falta alias.');
  return json(200, await quitarAlias(alias));
});
