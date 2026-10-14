import { z } from 'zod';
import { conAudit, resolveId, textOrJson, svc } from './helpers.mjs';

const fmt = z.enum(['text', 'json']).optional().default('text');

export function registerMeta(server, tokenCtx) {
  server.registerTool(
    'wiki_aliases',
    {
      title: 'Aliases',
      description: 'Lista aliases (todos o de una página).',
      inputSchema: z.object({
        page: z.string().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_aliases', false, 'read', async (args) => {
      let pageId = null;
      if (args.page) pageId = (await resolveId(args.page)).id;
      const aliases = await svc.listarAliases({ pageId });
      const text = aliases.map((a) => `${a.alias_key} → ${a.title}`).join('\n');
      return textOrJson(args.format, text || '(ninguno)', { aliases });
    }),
  );

  server.registerTool(
    'wiki_alias_add',
    {
      title: 'Agregar alias',
      description: 'Añade un alias (título alternativo) a una página.',
      inputSchema: z.object({
        page: z.string(),
        alias: z.string(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false },
    },
    conAudit(tokenCtx, 'wiki_alias_add', true, 'write', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const a = await svc.agregarAlias(meta.id, args.alias);
      return textOrJson(args.format, `Alias OK: ${a.alias_key} → ${meta.title}`, a);
    }),
  );

  server.registerTool(
    'wiki_alias_remove',
    {
      title: 'Quitar alias',
      description: 'Elimina un alias por su texto.',
      inputSchema: z.object({
        alias: z.string(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    conAudit(tokenCtx, 'wiki_alias_remove', true, 'write', async (args) => {
      const r = await svc.quitarAlias(args.alias);
      return textOrJson(args.format, `Alias eliminado: ${args.alias}`, r);
    }),
  );

  server.registerTool(
    'wiki_tags',
    {
      title: 'Tags',
      description: 'Agrega tags desde metadata.tags.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(500).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_tags', false, 'read', async (args) => {
      const tags = await svc.listarTags({ limit: args.limit || 100 });
      const text = tags.map((t) => `${t.tag} (${t.count})`).join('\n');
      return textOrJson(args.format, text || '(ninguno)', { tags });
    }),
  );

  server.registerTool(
    'wiki_recent',
    {
      title: 'Recientes',
      description: 'Últimas versiones guardadas.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).optional(),
        since: z.string().optional(),
        author: z.string().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_recent', false, 'read', async (args) => {
      const recent = await svc.recientes({
        limit: args.limit || 20,
        since: args.since || null,
        author: args.author || null,
      });
      const text = recent
        .map((r) => `v${r.version_number} ${r.page_title} · ${r.author} · ${r.created_at}`)
        .join('\n');
      return textOrJson(args.format, text || '(ninguna)', { recent });
    }),
  );

  server.registerTool(
    'wiki_stats',
    {
      title: 'Stats',
      description: 'Conteos de la wiki + hubs por backlinks.',
      inputSchema: z.object({ format: fmt }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_stats', false, 'read', async (args) => {
      const s = await svc.stats();
      const text = [
        `pages: ${s.pages}`,
        `files: ${s.files}`,
        `trash: ${s.trash}`,
        `broken: ${s.broken_links}`,
        `aliases: ${s.aliases}`,
        `assets: ${s.assets}`,
        'hubs:',
        ...s.hubs.map((h) => `  ${h.title} (${h.backlinks})`),
      ].join('\n');
      return textOrJson(args.format, text, s);
    }),
  );
}
