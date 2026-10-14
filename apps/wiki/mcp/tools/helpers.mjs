import { ErrorHttp } from '../../../../shared/http.js';
import { exigirScope, rateLimitMcp } from '../../../../shared/mcp-auth.js';
import { auditarMcp, resumenArgs } from '../../../../shared/mcp-audit.js';
import { McpToolError, fromErrorHttp } from '../errors.mjs';
import { ok, jsonBlock } from '../format.mjs';
import * as svc from '../../server/servicio.js';

export async function resolveId(ref) {
  const meta = await svc.resolverRef(ref);
  if (!meta) throw new McpToolError('page_not_found', `No encontré "${ref}".`);
  return meta;
}

/** Envuelve un handler de tool con scope, rate limit y auditoría. */
export function conAudit(tokenCtx, tool, esEscritura, scope, fn) {
  return async (args) => {
    const t0 = Date.now();
    let pageId = null;
    try {
      exigirScope(tokenCtx, scope);
      rateLimitMcp(tokenCtx, esEscritura);
      const result = await fn(args || {}, {
        setPageId: (id) => {
          pageId = id;
        },
      });
      auditarMcp({
        tokenId: tokenCtx.tokenId,
        tool,
        pageId,
        ok: true,
        durationMs: Date.now() - t0,
        argsSummary: resumenArgs(args),
      });
      return result;
    } catch (e) {
      let err = e;
      if (e instanceof ErrorHttp) err = fromErrorHttp(e);
      else if (!(e instanceof McpToolError)) {
        err = new McpToolError(
          e.extra?.codigo || e.extra?.code || 'error_interno',
          e.message || 'Error interno',
        );
      }
      auditarMcp({
        tokenId: tokenCtx.tokenId,
        tool,
        pageId,
        ok: false,
        errorCode: err.code,
        durationMs: Date.now() - t0,
        argsSummary: resumenArgs(args),
      });
      return err.toResult();
    }
  };
}

export function textOrJson(format, text, structured) {
  if (format === 'json') return ok(jsonBlock(structured), structured);
  return ok(text, structured);
}

export { svc, ok, jsonBlock, McpToolError };
