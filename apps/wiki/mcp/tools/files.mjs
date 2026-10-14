import { z } from 'zod';
import { conAudit, resolveId, textOrJson, svc, McpToolError } from './helpers.mjs';
import { urlFirmada } from '../signed-url.mjs';

const fmt = z.enum(['text', 'json']).optional().default('text');

export function registerFiles(server, tokenCtx, { publicOrigin = '' } = {}) {
  server.registerTool(
    'wiki_upload_file',
    {
      title: 'Subir archivo',
      description: 'Sube base64 (máx 3 MB decodificados). Para más, usa wiki_upload_from_url.',
      inputSchema: z.object({
        filename: z.string(),
        mime_type: z.string(),
        content_base64: z.string(),
        parent: z.string().optional(),
        title: z.string().optional(),
        note: z.string().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false },
    },
    conAudit(tokenCtx, 'wiki_upload_file', true, 'write', async (args, { setPageId }) => {
      svc.validarBase64Mcp(args.content_base64);
      let parentId = null;
      if (args.parent) parentId = (await resolveId(args.parent)).id;
      const page = await svc.crearDocumento({
        title: args.title,
        parentId,
        mimeType: args.mime_type,
        base64: args.content_base64,
        originalName: args.filename,
        note: args.note || '',
      });
      setPageId(page.id);
      return textOrJson(args.format, `Subido: ${page.title}`, { id: page.id, title: page.title, asset_id: page.asset_id });
    }),
  );

  server.registerTool(
    'wiki_upload_from_url',
    {
      title: 'Subir desde URL',
      description: 'Fetch https server-side (hasta 20 MB). Bloquea localhost/RFC1918.',
      inputSchema: z.object({
        url: z.string().url(),
        filename: z.string().optional(),
        parent: z.string().optional(),
        title: z.string().optional(),
        note: z.string().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false },
    },
    conAudit(tokenCtx, 'wiki_upload_from_url', true, 'write', async (args, { setPageId }) => {
      const page = await svc.subirDesdeUrl(args, tokenCtx);
      setPageId(page.id);
      return textOrJson(args.format, `Subido desde URL: ${page.title}`, { id: page.id, title: page.title });
    }),
  );

  server.registerTool(
    'wiki_download_file',
    {
      title: 'Descargar archivo',
      description: 'mode=url (firmada), base64 o text. Preferir url para binarios.',
      inputSchema: z.object({
        page: z.string(),
        mode: z.enum(['url', 'base64', 'text']).optional().default('url'),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_download_file', false, 'read', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const page = await svc.obtener(meta.id);
      if (page.kind !== 'file' || !page.asset_id) {
        throw new McpToolError('not_a_file_page', 'No es una página-documento.');
      }
      if (args.mode === 'url') {
        const signed = await svc.urlDescargaFirmada(page.asset_id, 600, publicOrigin);
        return textOrJson(args.format, `URL (${signed.expires_in}s): ${signed.url}`, signed);
      }
      const asset = await svc.servirAsset(page.asset_id);
      if (args.mode === 'text') {
        const text = Buffer.from(asset.content).toString('utf8');
        return textOrJson(args.format, text.slice(0, 20000), {
          mime_type: asset.mime_type,
          text: text.slice(0, 20000),
        });
      }
      const b64 = Buffer.from(asset.content).toString('base64');
      if (b64.length > 4_000_000) {
        throw new McpToolError('payload_grande', 'Demasiado grande para base64; usa mode=url.');
      }
      return textOrJson(args.format, `base64 ${asset.mime_type} ${asset.size_bytes} bytes`, {
        mime_type: asset.mime_type,
        size_bytes: Number(asset.size_bytes),
        content_base64: b64,
      });
    }),
  );

  server.registerTool(
    'wiki_replace_file',
    {
      title: 'Reemplazar archivo',
      description: 'Reemplaza el binario de una página-file (base64 ≤3 MB).',
      inputSchema: z.object({
        page: z.string(),
        mime_type: z.string(),
        content_base64: z.string(),
        filename: z.string().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    conAudit(tokenCtx, 'wiki_replace_file', true, 'write', async (args, { setPageId }) => {
      svc.validarBase64Mcp(args.content_base64);
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const page = await svc.reemplazarDocumento(meta.id, {
        mimeType: args.mime_type,
        base64: args.content_base64,
        originalName: args.filename,
      });
      return textOrJson(args.format, `Reemplazado: ${page.title}`, { id: page.id, asset_id: page.asset_id });
    }),
  );

  server.registerTool(
    'wiki_list_files',
    {
      title: 'Listar archivos',
      description: 'Páginas kind=file. Filtros under/mime.',
      inputSchema: z.object({
        under: z.string().optional(),
        mime: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_list_files', false, 'read', async (args) => {
      let under = null;
      if (args.under) under = (await resolveId(args.under)).id;
      const files = await svc.listarArchivos({ under, mime: args.mime || null, limit: args.limit || 50 });
      const text = files.map((f) => `- ${f.title} (${f.mime_type || '?'}, ${f.size_bytes || 0} B)`).join('\n');
      return textOrJson(args.format, text || '(ninguno)', { files });
    }),
  );

  void urlFirmada;
}
