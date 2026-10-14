import { z } from 'zod';
import { conAudit, resolveId, textOrJson, svc, ok, McpToolError } from './helpers.mjs';
import { applyEdits } from '../edits.mjs';

const fmt = z.enum(['text', 'json']).optional().default('text');

const editOp = z.object({
  op: z.enum([
    'append',
    'prepend',
    'replace_section',
    'insert_after_heading',
    'append_to_section',
    'str_replace',
    'replace_lines',
    'delete_section',
    'set_frontmatter',
  ]),
  text: z.string().optional(),
  heading: z.string().optional(),
  old: z.string().optional(),
  new: z.string().optional(),
  all: z.boolean().optional(),
  from: z.number().optional(),
  to: z.number().optional(),
  patch: z.record(z.string(), z.any()).optional(),
  keep_heading: z.boolean().optional(),
  after_frontmatter: z.boolean().optional(),
});

export function registerWrite(server, tokenCtx) {
  server.registerTool(
    'wiki_create_page',
    {
      title: 'Crear página',
      description: 'Crea Markdown. if_exists: error|suffix|return. parent por título.',
      inputSchema: z.object({
        title: z.string(),
        content: z.string().optional(),
        parent: z.string().optional(),
        icon: z.string().optional(),
        metadata: z.record(z.string(), z.any()).optional(),
        if_exists: z.enum(['error', 'suffix', 'return']).optional(),
        message: z.string().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false },
    },
    conAudit(tokenCtx, 'wiki_create_page', true, 'write', async (args, { setPageId }) => {
      const page = await svc.crearPaginaMcp(args, tokenCtx);
      setPageId(page.id);
      return textOrJson(
        args.format,
        `${page.existed ? 'EXISTÍA' : 'CREADA'}: ${page.title} (${page.id})`,
        { id: page.id, title: page.title, existed: page.existed },
      );
    }),
  );

  server.registerTool(
    'wiki_write_page',
    {
      title: 'Escribir página',
      description: 'Reemplaza contenido completo. Bloquea si hay draft (salvo discard_draft).',
      inputSchema: z.object({
        page: z.string(),
        content: z.string(),
        title: z.string().optional(),
        message: z.string().optional(),
        expected_version: z.number().int().optional(),
        discard_draft: z.boolean().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    conAudit(tokenCtx, 'wiki_write_page', true, 'write', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const r = await svc.guardarVersionMcp(meta.id, args, tokenCtx);
      if (r.no_changes) return ok('Sin cambios (no_changes).', { no_changes: true });
      return textOrJson(
        args.format,
        `OK v${r.version?.version_number} · ${r.page?.title || meta.title}`,
        { version: r.version, page_id: meta.id },
      );
    }),
  );

  server.registerTool(
    'wiki_edit_page',
    {
      title: 'Editar con ops',
      description: 'Aplica EditOp[] sin reenviar toda la página. Preferido para cambios locales.',
      inputSchema: z.object({
        page: z.string(),
        ops: z.array(editOp).min(1),
        message: z.string().optional(),
        expected_version: z.number().int().optional(),
        discard_draft: z.boolean().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false },
    },
    conAudit(tokenCtx, 'wiki_edit_page', true, 'write', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const page = await svc.obtener(meta.id);
      const content = page.version?.content || '';
      const { text, applied, summary } = applyEdits(content, args.ops);
      const r = await svc.guardarVersionMcp(
        meta.id,
        {
          content: text,
          message: args.message || `MCP edit: ${summary.join('; ')}`,
          expected_version: args.expected_version,
          discard_draft: args.discard_draft,
        },
        tokenCtx,
      );
      if (r.no_changes) return ok('Sin cambios tras ops.', { no_changes: true, applied });
      return textOrJson(
        args.format,
        `OK v${r.version?.version_number} · ${applied} ops: ${summary.join('; ')}`,
        { version: r.version, applied, summary },
      );
    }),
  );

  server.registerTool(
    'wiki_rename_page',
    {
      title: 'Renombrar',
      description: 'Cambia título. keep_alias guarda el viejo como alias. rewrite_links por defecto.',
      inputSchema: z.object({
        page: z.string(),
        new_title: z.string(),
        rewrite_links: z.boolean().optional(),
        keep_alias: z.boolean().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false },
    },
    conAudit(tokenCtx, 'wiki_rename_page', true, 'write', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const page = await svc.renombrarMcp(
        meta.id,
        {
          newTitle: args.new_title,
          rewriteLinks: args.rewrite_links !== false,
          keepAlias: args.keep_alias !== false,
        },
        tokenCtx,
      );
      return textOrJson(
        args.format,
        `Renombrada: ${page.previous_title} → ${page.title}`,
        { id: page.id, title: page.title, previous_title: page.previous_title },
      );
    }),
  );

  server.registerTool(
    'wiki_move_page',
    {
      title: 'Mover',
      description: 'Cambia padre. position: end|start|{after}|{before}.',
      inputSchema: z.object({
        page: z.string(),
        new_parent: z.string().nullable().optional(),
        position: z
          .union([
            z.enum(['end', 'start']),
            z.object({ after: z.string().optional(), before: z.string().optional() }),
          ])
          .optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: false },
    },
    conAudit(tokenCtx, 'wiki_move_page', true, 'write', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const page = await svc.moverMcp(
        meta.id,
        { newParent: args.new_parent ?? null, position: args.position || 'end' },
        tokenCtx,
      );
      return textOrJson(args.format, `Movida: ${page.title}`, { id: page.id, parent_id: page.parent_id });
    }),
  );

  server.registerTool(
    'wiki_set_metadata',
    {
      title: 'Metadata',
      description: 'Fusiona metadata JSON de la página (p. ej. tags).',
      inputSchema: z.object({
        page: z.string(),
        patch: z.record(z.string(), z.any()),
        format: fmt,
      }),
      annotations: { readOnlyHint: false },
    },
    conAudit(tokenCtx, 'wiki_set_metadata', true, 'write', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const page = await svc.obtener(meta.id);
      const metadata = { ...(page.metadata || {}), ...args.patch };
      for (const [k, v] of Object.entries(args.patch)) {
        if (v == null) delete metadata[k];
      }
      const updated = await svc.actualizar(meta.id, { metadata });
      return textOrJson(args.format, `Metadata OK: ${updated.title}`, { id: updated.id, metadata: updated.metadata });
    }),
  );
}
