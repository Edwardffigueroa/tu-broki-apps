import { z } from 'zod';
import { conAudit, resolveId, textOrJson, svc } from './helpers.mjs';

const fmt = z.enum(['text', 'json']).optional().default('text');

export function registerGraph(server, tokenCtx) {
  server.registerTool(
    'wiki_links',
    {
      title: 'Enlaces',
      description: 'Enlaces salientes/entrantes/rotos de una página.',
      inputSchema: z.object({
        page: z.string(),
        direction: z.enum(['in', 'out', 'both']).optional().default('both'),
        include_broken: z.boolean().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_links', false, 'read', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const links = await svc.linksDe(meta.id, {
        direction: args.direction,
        includeBroken: args.include_broken !== false,
      });
      const lines = [
        `OUT (${links.out.length}): ${links.out.map((l) => l.title).join(', ') || '—'}`,
        `IN (${links.in.length}): ${links.in.map((l) => l.title).join(', ') || '—'}`,
        `BROKEN (${links.broken.length}): ${links.broken.map((l) => l.target_key).join(', ') || '—'}`,
      ];
      return textOrJson(args.format, lines.join('\n'), links);
    }),
  );

  server.registerTool(
    'wiki_neighbors',
    {
      title: 'Vecinos',
      description: 'Grafo N saltos (depth 1–4) desde una página.',
      inputSchema: z.object({
        page: z.string(),
        depth: z.number().int().min(1).max(4).optional(),
        direction: z.enum(['in', 'out', 'both']).optional().default('both'),
        limit: z.number().int().min(1).max(200).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_neighbors', false, 'read', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const neighbors = await svc.vecinos(meta.id, {
        depth: args.depth || 1,
        direction: args.direction,
        limit: args.limit || 50,
      });
      const text = neighbors.map((n) => `${'  '.repeat(n.depth - 1)}${n.title} (d${n.depth})`).join('\n');
      return textOrJson(args.format, text || '(sin vecinos)', { neighbors });
    }),
  );

  server.registerTool(
    'wiki_path',
    {
      title: 'Camino',
      description: 'Camino más corto entre dos páginas (BFS).',
      inputSchema: z.object({
        from: z.string(),
        to: z.string(),
        max_depth: z.number().int().min(1).max(6).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_path', false, 'read', async (args) => {
      const a = await resolveId(args.from);
      const b = await resolveId(args.to);
      const path = await svc.caminoCorto(a.id, b.id, { maxDepth: args.max_depth || 6 });
      const text = path ? path.map((p) => p.title).join(' → ') : '(sin camino)';
      return textOrJson(args.format, text, { path });
    }),
  );

  server.registerTool(
    'wiki_related',
    {
      title: 'Relacionadas',
      description: 'Páginas relacionadas por co-citación.',
      inputSchema: z.object({
        page: z.string(),
        limit: z.number().int().min(1).max(50).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_related', false, 'read', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const related = await svc.relacionadas(meta.id, { limit: args.limit || 10 });
      const text = related.map((r) => `${r.title} (score ${r.score})`).join('\n');
      return textOrJson(args.format, text || '(ninguna)', { related });
    }),
  );

  server.registerTool(
    'wiki_broken_links',
    {
      title: 'Enlaces rotos',
      description: 'Wikilinks sin destino. Opcional under=.',
      inputSchema: z.object({
        under: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_broken_links', false, 'read', async (args) => {
      let under = null;
      if (args.under) under = (await resolveId(args.under)).id;
      const broken = await svc.enlacesRotos({ under, limit: args.limit || 50 });
      const text = broken.map((b) => `[[${b.target_key}]] ×${b.count} ← ${b.from.slice(0, 3).join(', ')}`).join('\n');
      return textOrJson(args.format, text || '(ninguno)', { broken });
    }),
  );

  server.registerTool(
    'wiki_orphans',
    {
      title: 'Huérfanas',
      description: 'Páginas sin backlinks ni hijos.',
      inputSchema: z.object({
        include_files: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_orphans', false, 'read', async (args) => {
      const orphans = await svc.huerfanas({
        includeFiles: Boolean(args.include_files),
        limit: args.limit || 50,
      });
      const text = orphans.map((o) => `- ${o.title} (${o.kind})`).join('\n');
      return textOrJson(args.format, text || '(ninguna)', { orphans });
    }),
  );
}
