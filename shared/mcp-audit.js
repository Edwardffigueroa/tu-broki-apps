/**
 * Auditoría best-effort de llamadas MCP.
 */

import { Prisma } from '@prisma/client';
import { getPrisma } from './prisma.js';

function q(db) {
  return (strings, ...values) => db.$queryRaw(Prisma.sql(strings, ...values));
}

/**
 * @param {{ tokenId?: string, tool: string, pageId?: string|null, ok: boolean, errorCode?: string|null, durationMs?: number, argsSummary?: object }} p
 */
export function auditarMcp(p) {
  const summary = p.argsSummary ?? {};
  void q(getPrisma())`
    insert into wiki.mcp_audit (token_id, tool, page_id, ok, error_code, duration_ms, args_summary)
    values (
      ${p.tokenId || null}::uuid,
      ${p.tool},
      ${p.pageId || null}::uuid,
      ${Boolean(p.ok)},
      ${p.errorCode || null},
      ${p.durationMs ?? null},
      ${JSON.stringify(summary)}::jsonb
    )
  `.catch((e) => console.error('[mcp-audit]', e.message));
}

/** Quita contenido/base64 de args para auditoría. */
export function resumenArgs(args) {
  if (!args || typeof args !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (k === 'content' || k === 'content_base64' || k === 'base64' || k === 'ops') {
      out[k] = typeof v === 'string' ? `[${v.length} chars]` : Array.isArray(v) ? `[${v.length} ops]` : '[omitido]';
    } else if (typeof v === 'string' && v.length > 200) {
      out[k] = `${v.slice(0, 80)}…`;
    } else {
      out[k] = v;
    }
  }
  return out;
}
