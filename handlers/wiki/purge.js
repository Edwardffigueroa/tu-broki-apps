import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { autenticarBearerMcp, exigirScope } from '../../shared/mcp-auth.js';
import { purgar, resolverRef } from '../../apps/wiki/server/servicio.js';

export const POST = manejar(async (request) => {
  const ctx = await autenticarBearerMcp(request);
  exigirScope(ctx, 'admin');
  const sp = new URL(request.url).searchParams;
  const body = await leerJson(request).catch(() => ({}));
  const ref = sp.get('id') || body.id || body.page;
  if (!ref) throw new ErrorHttp(400, 'Falta id.');
  const meta = await resolverRef(ref, { includeDeleted: true });
  if (!meta) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  const confirm = sp.get('confirm') === '1' || body.confirm === true;
  return json(200, await purgar(meta.id, { confirm, purgeOrphanAssets: Boolean(body.purge_orphan_assets) }));
});
