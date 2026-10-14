import { z } from 'zod';
import { conAudit, resolveId, textOrJson, svc, ok } from './helpers.mjs';
import { unifiedDiff } from '../diff.mjs';

const fmt = z.enum(['text', 'json']).optional().default('text');

export function registerVersions(server, tokenCtx) {
  server.registerTool(
    'wiki_history',
    {
      title: 'Historial',
      description: 'Lista versiones de una página.',
      inputSchema: z.object({
        page: z.string(),
        limit: z.number().int().min(1).max(100).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_history', false, 'read', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      let versions = await svc.listarVersiones(meta.id);
      if (args.limit) versions = versions.slice(0, args.limit);
      const text = versions
        .map((v) => `v${v.version_number} · ${v.author} · ${v.created_at}${v.message ? ` — ${v.message}` : ''}`)
        .join('\n');
      return textOrJson(args.format, text || '(sin versiones)', { versions });
    }),
  );

  server.registerTool(
    'wiki_get_version',
    {
      title: 'Ver versión',
      description: 'Contenido de una versión por número.',
      inputSchema: z.object({
        page: z.string(),
        version: z.number().int().min(1),
        max_chars: z.number().int().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_get_version', false, 'read', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const v = await svc.obtenerVersionPorNumero(meta.id, args.version);
      const max = args.max_chars || 12000;
      const content = String(v.content || '');
      const text = `v${v.version_number} · ${v.title}\n${content.slice(0, max)}${content.length > max ? '\n…' : ''}`;
      return textOrJson(args.format, text, { version: { ...v, content: content.slice(0, max) } });
    }),
  );

  server.registerTool(
    'wiki_diff',
    {
      title: 'Diff',
      description: 'Diff unificado entre dos versiones (números).',
      inputSchema: z.object({
        page: z.string(),
        from: z.number().int().min(1),
        to: z.number().int().min(1),
        context: z.number().int().min(0).max(10).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_diff', false, 'read', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const a = await svc.obtenerVersionPorNumero(meta.id, args.from);
      const b = await svc.obtenerVersionPorNumero(meta.id, args.to);
      const d = unifiedDiff(a.content || '', b.content || '', args.context ?? 2);
      const text = `diff v${args.from} → v${args.to} (+${d.added}/-${d.removed})\n${d.text}`;
      return textOrJson(args.format, text, d);
    }),
  );

  server.registerTool(
    'wiki_restore_version',
    {
      title: 'Restaurar versión',
      description: 'Crea versión nueva desde una anterior. Respeta draft_exists.',
      inputSchema: z.object({
        page: z.string(),
        version: z.number().int().min(1),
        discard_draft: z.boolean().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    conAudit(tokenCtx, 'wiki_restore_version', true, 'write', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const r = await svc.restaurarVersionMcp(meta.id, args.version, tokenCtx, {
        discard_draft: Boolean(args.discard_draft),
      });
      return textOrJson(
        args.format,
        `Restaurada → v${r.version?.version_number}`,
        { version: r.version },
      );
    }),
  );
}
