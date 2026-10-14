import { z } from 'zod';
import { conAudit, resolveId, textOrJson, svc, ok, McpToolError } from './helpers.mjs';
import { outline, section, slice, wordCount, headings } from '../outline.mjs';
import { pageSummary } from '../format.mjs';

const fmt = z.enum(['text', 'json']).optional().default('text');

export function registerRead(server, tokenCtx) {
  server.registerTool(
    'wiki_whoami',
    {
      title: 'Whoami',
      description: 'Identidad del token MCP y stats cortas de la wiki.',
      inputSchema: z.object({ format: fmt }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_whoami', false, 'read', async (args) => {
      const me = await svc.whoamiMcp(tokenCtx);
      const text = `MCP · ${me.label}\nemail: ${me.email}\nscopes: ${me.scopes.join(', ')}\npages: ${me.stats.pages} · files: ${me.stats.files} · trash: ${me.stats.trash}`;
      return textOrJson(args.format, text, me);
    }),
  );

  server.registerTool(
    'wiki_tree',
    {
      title: 'Árbol',
      description: 'Árbol de páginas. Opcional: root, depth, papelera. Máx ~400 nodos.',
      inputSchema: z.object({
        root: z.string().optional(),
        depth: z.number().int().min(1).max(20).optional(),
        trash: z.boolean().optional(),
        with_ids: z.boolean().optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_tree', false, 'read', async (args) => {
      const all = await svc.arbol({ papelera: Boolean(args.trash) });
      let nodes = all;
      let rootId = null;
      if (args.root) {
        const meta = await resolveId(args.root);
        rootId = meta.id;
        const kids = new Map();
        for (const n of all) {
          const k = n.parent_id || '__root__';
          if (!kids.has(k)) kids.set(k, []);
          kids.get(k).push(n);
        }
        const out = [];
        const walk = (id, d) => {
          if (args.depth != null && d > args.depth) return;
          const list = kids.get(id) || [];
          for (const n of list) {
            out.push({ ...n, _depth: d });
            walk(n.id, d + 1);
          }
        };
        const root = all.find((n) => n.id === rootId);
        if (root) out.push({ ...root, _depth: 0 });
        walk(rootId, 1);
        nodes = out;
      } else if (args.depth != null) {
        const byId = new Map(all.map((n) => [n.id, n]));
        const depthOf = (n) => {
          let d = 0;
          let cur = n;
          const seen = new Set();
          while (cur?.parent_id) {
            if (seen.has(cur.id)) break;
            seen.add(cur.id);
            cur = byId.get(cur.parent_id);
            d += 1;
            if (d > 50) break;
          }
          return d;
        };
        nodes = all.filter((n) => depthOf(n) < args.depth).map((n) => ({ ...n, _depth: depthOf(n) }));
      }

      if (nodes.length > 400) {
        nodes = nodes.slice(0, 400);
      }

      const lines = nodes.map((n) => {
        const indent = '  '.repeat(n._depth || 0);
        const id = args.with_ids ? ` [${n.id.slice(0, 8)}]` : '';
        const kind = n.kind === 'file' ? ' 📎' : '';
        const draft = n.has_draft ? ' ·draft' : '';
        return `${indent}- ${n.title}${kind}${draft}${id}`;
      });
      const structured = { count: nodes.length, nodes: args.with_ids ? nodes : nodes.map(({ id, title, parent_id, kind, has_draft }) => ({ id: args.with_ids ? id : undefined, title, parent_id, kind, has_draft })) };
      return textOrJson(args.format, lines.join('\n') || '(vacío)', structured);
    }),
  );

  server.registerTool(
    'wiki_resolve',
    {
      title: 'Resolver',
      description: 'Resuelve título/alias/UUID a página. Acepta refs[] o ref.',
      inputSchema: z.object({
        ref: z.string().optional(),
        refs: z.array(z.string()).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_resolve', false, 'read', async (args) => {
      const list = args.refs?.length ? args.refs : args.ref ? [args.ref] : [];
      if (!list.length) throw new McpToolError('validacion', 'Pasa ref o refs.');
      const results = await svc.resolverRefs(list);
      const text = results
        .map((r) =>
          r.ok
            ? `OK ${r.ref} → ${r.title} (${r.via})`
            : `FAIL ${r.ref} · sugerencias: ${(r.suggestions || []).join(', ') || 'ninguna'}`,
        )
        .join('\n');
      return textOrJson(args.format, text, { results });
    }),
  );

  server.registerTool(
    'wiki_get_page',
    {
      title: 'Leer página',
      description: 'mode=outline|section|full|range. Ahorra tokens con outline/section.',
      inputSchema: z.object({
        page: z.string(),
        mode: z.enum(['outline', 'section', 'full', 'range']).optional().default('outline'),
        heading: z.string().optional(),
        offset: z.number().int().min(0).optional(),
        max_chars: z.number().int().min(100).max(50000).optional(),
        max_depth: z.number().int().min(1).max(6).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_get_page', false, 'read', async (args, { setPageId }) => {
      const meta = await resolveId(args.page);
      setPageId(meta.id);
      const page = await svc.obtener(meta.id);
      const content = page.version?.content || page.draft_content || '';
      const head = pageSummary(page);

      if (args.mode === 'outline') {
        const o = outline(content, args.max_depth || 3);
        const text = `${head}\nwords: ${wordCount(content)}\n\n${o}`;
        return textOrJson(args.format, text, { page: { id: page.id, title: page.title }, outline: headings(content), words: wordCount(content) });
      }
      if (args.mode === 'section') {
        if (!args.heading) throw new McpToolError('validacion', 'mode=section requiere heading.');
        const sec = section(content, args.heading);
        if (!sec) throw new McpToolError('section_not_found', `No existe la sección "${args.heading}".`);
        return textOrJson(args.format, `${head}\n\n${sec.text}`, { start: sec.start, end: sec.end, text: sec.text });
      }
      if (args.mode === 'range') {
        const s = slice(content, args.offset || 0, args.max_chars || 6000);
        return textOrJson(
          args.format,
          `${head}\noffset ${args.offset || 0}/${s.total}\nnext: ${s.next_offset}\n\n${s.text}`,
          s,
        );
      }
      // full
      const s = slice(content, 0, args.max_chars || 20000);
      return textOrJson(args.format, `${head}\n\n${s.text}${s.next_offset != null ? '\n…(truncado)' : ''}`, {
        id: page.id,
        title: page.title,
        content: s.text,
        total: s.total,
        next_offset: s.next_offset,
      });
    }),
  );

  server.registerTool(
    'wiki_search',
    {
      title: 'Buscar',
      description: 'Búsqueda FTS/literal/title. under=subárbol, kind=page|file.',
      inputSchema: z.object({
        q: z.string(),
        mode: z.enum(['fts', 'literal', 'title']).optional().default('fts'),
        under: z.string().optional(),
        kind: z.enum(['page', 'file']).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_search', false, 'read', async (args) => {
      let under = null;
      if (args.under) under = (await resolveId(args.under)).id;
      const results = await svc.buscarAvanzado({
        q: args.q,
        mode: args.mode,
        under,
        kind: args.kind || null,
        limit: args.limit || 20,
      });
      const text = results.map((r, i) => `${i + 1}. ${r.title} (${r.match}) — ${String(r.headline || '').replace(/\s+/g, ' ').slice(0, 120)}`).join('\n');
      return textOrJson(args.format, text || '(sin resultados)', { results });
    }),
  );

  server.registerTool(
    'wiki_grep',
    {
      title: 'Grep',
      description: 'Busca patrón línea a línea. regex opcional. Preferir under= en vaults grandes.',
      inputSchema: z.object({
        pattern: z.string(),
        regex: z.boolean().optional(),
        case_sensitive: z.boolean().optional(),
        under: z.string().optional(),
        max_matches: z.number().int().min(1).max(200).optional(),
        format: fmt,
      }),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    conAudit(tokenCtx, 'wiki_grep', false, 'read', async (args) => {
      let under = null;
      if (args.under) under = (await resolveId(args.under)).id;
      const matches = await svc.grep({
        pattern: args.pattern,
        regex: Boolean(args.regex),
        caseSensitive: Boolean(args.case_sensitive),
        under,
        maxMatches: args.max_matches || 50,
      });
      const text = matches.map((m) => `${m.title}:${m.line}: ${m.text}`).join('\n');
      return textOrJson(args.format, text || '(sin coincidencias)', { matches });
    }),
  );
}
