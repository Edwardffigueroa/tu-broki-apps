/**
 * Entrypoint Vercel · MCP Wiki (función #6).
 * POST/GET /api/mcp — Streamable HTTP + Bearer tbw_…
 * GET /api/mcp/health — sin auth
 */

import { autenticarBearerMcp } from '../shared/mcp-auth.js';
import { ErrorHttp, json } from '../shared/http.js';
import {
  incomingARequest,
  escribirNodeResponse,
  urlDe,
  partesUrl,
} from '../shared/despachar.js';
import { createWikiMcpHandler } from '../apps/wiki/mcp/server.mjs';
import { authInfoDesdeToken } from '../apps/wiki/mcp/auth-ctx.mjs';

const mcp = createWikiMcpHandler({
  publicOrigin: process.env.MCP_PUBLIC_URL
    ? process.env.MCP_PUBLIC_URL.replace(/\/api\/mcp\/?$/, '')
    : '',
});

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  };
}

function originDe(request) {
  try {
    const u = urlDe(request);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

async function handleWeb(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const { pathname } = partesUrl(request.url);
  if (pathname === '/api/mcp/health' || pathname.endsWith('/health')) {
    return json(
      200,
      { ok: true, name: 'tubroki-wiki-mcp', version: '1.0.0' },
      corsHeaders(),
    );
  }

  let tokenCtx;
  try {
    tokenCtx = await autenticarBearerMcp(request);
  } catch (e) {
    if (e instanceof ErrorHttp) {
      return json(e.status, { error: e.message, ...e.extra }, corsHeaders());
    }
    throw e;
  }

  const origin = process.env.MCP_PUBLIC_URL
    ? process.env.MCP_PUBLIC_URL.replace(/\/api\/mcp\/?$/, '')
    : originDe(request);

  // Re-bind public origin per request for signed download URLs
  const authInfo = authInfoDesdeToken(tokenCtx);
  const response = await mcp.fetch(request, { authInfo });

  // Stamp origin into a header for debugging; tools use env or request host via download tool
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  if (origin && !process.env.MCP_PUBLIC_URL) {
    // Tools read MCP_PUBLIC_URL; for local we patch via global for this isolate
    globalThis.__tb_mcp_origin = origin;
  }
  return new Response(response.body, { status: response.status, headers });
}

async function handleNode(req, res) {
  if (res == null || typeof res?.end !== 'function') {
    return handleWeb(req);
  }
  try {
    const request = await incomingARequest(req);
    const response = await handleWeb(request);
    await escribirNodeResponse(res, response);
  } catch (e) {
    console.error('[mcp]', e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Error interno MCP.' }));
    }
  }
}

handleNode.GET = handleWeb;
handleNode.POST = handleWeb;
handleNode.DELETE = handleWeb;

export const GET = handleWeb;
export const POST = handleWeb;
export const DELETE = handleWeb;
export default handleNode;
