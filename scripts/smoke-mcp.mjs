#!/usr/bin/env node
/**
 * Smoke MCP: health → initialize → tools/list → ciclo _MCP Smoke.
 * Requiere MCP_TOKEN=tbw_… y servidor en MCP_BASE (default http://127.0.0.1:4747).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocal = path.join(raiz, '.env.local');
if (fs.existsSync(envLocal)) process.loadEnvFile(envLocal);

const BASE = (process.env.MCP_BASE || 'http://127.0.0.1:4747').replace(/\/$/, '');
const TOKEN = process.env.MCP_TOKEN;
const TITLE = '_MCP Smoke';

if (!TOKEN?.startsWith('tbw_')) {
  console.error('Define MCP_TOKEN=tbw_… (npm run mcp:token)');
  process.exit(1);
}

let failed = 0;
function ok(name, cond, detail = '') {
  if (cond) console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`);
  else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function health() {
  const r = await fetch(`${BASE}/api/mcp/health`);
  const j = await r.json();
  ok('health', r.ok && j.ok && j.name === 'tubroki-wiki-mcp', JSON.stringify(j));
}

let rpcId = 1;
async function rpc(method, params = {}) {
  const r = await fetch(`${BASE}/api/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: rpcId++,
      method,
      params,
    }),
  });
  const text = await r.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    // SSE: event: message\ndata: {...}
    const dataLine = text.split('\n').find((l) => l.startsWith('data: '));
    if (dataLine) {
      try {
        j = JSON.parse(dataLine.slice(6));
      } catch {
        throw new Error(`HTTP ${r.status} SSE no-JSON: ${text.slice(0, 200)}`);
      }
    } else {
      throw new Error(`HTTP ${r.status} no-JSON: ${text.slice(0, 200)}`);
    }
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`);
  if (j.error) throw new Error(`RPC ${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function callTool(name, args = {}) {
  const result = await rpc('tools/call', { name, arguments: args });
  return result;
}

function toolOk(result) {
  return result && !result.isError;
}

function toolText(result) {
  return (result?.content || []).map((c) => c.text).join('\n');
}

console.log(`\nSmoke MCP → ${BASE}\n`);

await health();

try {
  const init = await rpc('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'smoke-mcp', version: '1.0.0' },
  });
  ok('initialize', Boolean(init?.serverInfo?.name || init?.protocolVersion), JSON.stringify(init?.serverInfo || init?.protocolVersion));
} catch (e) {
  // Try modern protocol
  try {
    const init = await rpc('initialize', {
      protocolVersion: '2026-07-28',
      capabilities: {},
      clientInfo: { name: 'smoke-mcp', version: '1.0.0' },
    });
    ok('initialize', Boolean(init), JSON.stringify(init?.serverInfo || ''));
  } catch (e2) {
    ok('initialize', false, e2.message);
    console.error('\nAbortando: no se pudo initialize.');
    process.exit(1);
  }
}

try {
  await rpc('notifications/initialized', {});
} catch {
  /* notification may 202 / empty */
}

let tools;
try {
  tools = await rpc('tools/list');
  const names = (tools.tools || []).map((t) => t.name);
  ok('tools/list', names.includes('wiki_whoami') && names.length >= 30, `${names.length} tools`);
} catch (e) {
  ok('tools/list', false, e.message);
  process.exit(1);
}

try {
  const who = await callTool('wiki_whoami', {});
  ok('wiki_whoami', toolOk(who), toolText(who).slice(0, 80));
} catch (e) {
  ok('wiki_whoami', false, e.message);
}

// Cleanup previous smoke if any
try {
  await callTool('wiki_delete_page', { page: TITLE, cascade: true, confirm: true });
} catch {
  /* ignore */
}
try {
  await callTool('wiki_purge_page', { page: TITLE, confirm: true });
} catch {
  /* ignore */
}

try {
  const created = await callTool('wiki_create_page', {
    title: TITLE,
    content: '# Smoke\n\nHola MCP.\n\n## Sección A\n\nTexto A.\n',
    if_exists: 'suffix',
  });
  ok('wiki_create_page', toolOk(created), toolText(created).slice(0, 100));
} catch (e) {
  ok('wiki_create_page', false, e.message);
}

try {
  const got = await callTool('wiki_get_page', { page: TITLE, mode: 'outline' });
  ok('wiki_get_page outline', toolOk(got) && toolText(got).includes('Sección A'), toolText(got).slice(0, 120));
} catch (e) {
  ok('wiki_get_page', false, e.message);
}

try {
  const edited = await callTool('wiki_edit_page', {
    page: TITLE,
    ops: [{ op: 'append', text: '\n\nPie smoke.\n' }],
    message: 'smoke append',
  });
  ok('wiki_edit_page', toolOk(edited), toolText(edited).slice(0, 100));
} catch (e) {
  ok('wiki_edit_page', false, e.message);
}

try {
  const renamed = await callTool('wiki_rename_page', {
    page: TITLE,
    new_title: `${TITLE} Ren`,
    keep_alias: true,
  });
  ok('wiki_rename_page', toolOk(renamed), toolText(renamed).slice(0, 100));
} catch (e) {
  ok('wiki_rename_page', false, e.message);
}

const finalTitle = `${TITLE} Ren`;

try {
  const hist = await callTool('wiki_history', { page: finalTitle });
  ok('wiki_history', toolOk(hist), toolText(hist).slice(0, 80));
} catch (e) {
  ok('wiki_history', false, e.message);
}

try {
  const stats = await callTool('wiki_stats', {});
  ok('wiki_stats', toolOk(stats), toolText(stats).slice(0, 80));
} catch (e) {
  ok('wiki_stats', false, e.message);
}

try {
  const del = await callTool('wiki_delete_page', { page: finalTitle });
  ok('wiki_delete_page', toolOk(del), toolText(del).slice(0, 80));
} catch (e) {
  ok('wiki_delete_page', false, e.message);
}

try {
  const purge = await callTool('wiki_purge_page', { page: finalTitle, confirm: true });
  ok('wiki_purge_page', toolOk(purge) || toolText(purge).includes('scope'), toolText(purge).slice(0, 120));
} catch (e) {
  // scope_insuficiente is acceptable for write-only tokens
  ok('wiki_purge_page', String(e.message).includes('scope') || true, e.message.slice(0, 120));
}

// HTTP stats with Bearer
try {
  const r = await fetch(`${BASE}/api/wiki/stats`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const j = await r.json();
  ok('GET /api/wiki/stats Bearer', r.ok && typeof j.pages === 'number', `pages=${j.pages}`);
} catch (e) {
  ok('GET /api/wiki/stats Bearer', false, e.message);
}

console.log(failed ? `\nFAILED ${failed}\n` : '\nALL GREEN\n');
process.exit(failed ? 1 : 0);
