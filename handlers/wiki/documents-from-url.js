import { json, leerJson, manejar, ErrorHttp } from '../../shared/http.js';
import { exigirAuthWiki } from '../../shared/mcp-auth.js';
import { subirDesdeUrl } from '../../apps/wiki/server/servicio.js';

export const POST = manejar(async (request) => {
  const ctx = await exigirAuthWiki(request, 'write');
  const body = await leerJson(request);
  if (!body.url) throw new ErrorHttp(400, 'Falta url.');
  const page = await subirDesdeUrl(
    {
      url: body.url,
      filename: body.filename,
      parentId: body.parent_id,
      parent: body.parent,
      title: body.title,
      note: body.note,
    },
    ctx.tipo === 'mcp' ? ctx : null,
  );
  return json(201, page);
});
