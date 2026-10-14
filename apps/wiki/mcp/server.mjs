/**
 * Factory MCP Wiki TuBroki.
 */

import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { registerAllTools } from './tools/index.mjs';
import { tokenDesdeAuthInfo } from './auth-ctx.mjs';

const INSTRUCTIONS = `Eres el operador de la Wiki interna de TuBroki (Markdown + wikilinks [[Título]], como Obsidian).
Identifica páginas por TÍTULO (o alias); no necesitas UUIDs.
Para ahorrar contexto: usa wiki_get_page con mode=outline primero, luego mode=section; usa wiki_edit_page (operaciones) en vez de reenviar la página completa; usa wiki_download_file mode=url para binarios.
Antes de crear una página, usa wiki_resolve o wiki_search para no duplicar. Escribe en español (Colombia), tono directo.`;

export function createWikiMcpHandler({ publicOrigin = '' } = {}) {
  return createMcpHandler(
    (ctx) => {
      const tokenCtx = tokenDesdeAuthInfo(ctx.authInfo);
      if (!tokenCtx) {
        throw new Error('MCP sin authInfo');
      }
      const server = new McpServer(
        { name: 'tubroki-wiki-mcp', version: '1.0.0' },
        { instructions: INSTRUCTIONS },
      );
      registerAllTools(server, tokenCtx, { publicOrigin });
      return server;
    },
    { responseMode: 'json' },
  );
}
