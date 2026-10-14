import { z } from 'zod';
import { conAudit, resolveId, textOrJson, svc } from './helpers.mjs';

const fmt = z.enum(['text', 'json']).optional().default('text');

export function registerLifecycle(server, tokenCtx) {
  server.registerTool(
    'wiki_delete_page',
    {
      title: 'Borrar',
      description: 'Soft-delete. cascade+confirm para subárbol.',
      inputSchema: z.object({
        page: z.string(),
        cascade: z.boolean().optional(),
        confirm: z.boolean().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    conAudit(tokenCtx, 'wiki_delete_page', true, 'write', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      if (args.cascade) {
        const r = await svc.eliminarCascada(meta.id, { confirm: Boolean(args.confirm) });
        return textOrJson(args.format, `Borradas ${r.count} páginas (papelera).`, r);
      }
      await svc.eliminar(meta.id);
      return textOrJson(args.format, `En papelera: ${meta.title}`, { ok: true, id: meta.id });
    }),
  );

  server.registerTool(
    'wiki_restore_page',
    {
      title: 'Recuperar',
      description: 'Saca una página de la papelera.',
      inputSchema: z.object({ page: z.string(), format: fmt }),
      annotations: { readOnlyHint: false },
    },
    conAudit(tokenCtx, 'wiki_restore_page', true, 'write', async (args, { setPageId }) => {
      const meta = await svc.resolverRef(args.page, { includeDeleted: true });
      if (!meta) {
        const { McpToolError } = await import('../errors.mjs');
        throw new McpToolError('page_not_found', `No encontré "${args.page}".`);
      }
      setPageId(meta.id);
      const page = await svc.recuperar(meta.id);
      return textOrJson(args.format, `Recuperada: ${page.title}`, { id: page.id, title: page.title });
    }),
  );

  server.registerTool(
    'wiki_trash',
    {
      title: 'Papelera',
      description: 'Lista páginas en papelera.',
      inputSchema: z.object({ format: fmt }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_trash', false, 'read', async (args) => {
      const nodes = await svc.arbol({ papelera: true });
      const text = nodes.map((n) => `- ${n.title}`).join('\n');
      return textOrJson(args.format, text || '(vacía)', { pages: nodes });
    }),
  );

  server.registerTool(
    'wiki_purge_page',
    {
      title: 'Purgar',
      description: 'Hard-delete permanente (solo papelera). Requiere scope admin + confirm.',
      inputSchema: z.object({
        page: z.string(),
        confirm: z.boolean(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    conAudit(tokenCtx, 'wiki_purge_page', true, 'admin', async (args, { setPageId }) => {
      const meta = await svc.resolverRef(args.page, { includeDeleted: true });
      if (!meta) {
        const { McpToolError } = await import('../errors.mjs');
        throw new McpToolError('page_not_found', `No encontré "${args.page}".`);
      }
      setPageId(meta.id);
      const r = await svc.purgar(meta.id, { confirm: Boolean(args.confirm) });
      return textOrJson(args.format, `Purgada permanentemente: ${meta.title}`, r);
    }),
  );
}
