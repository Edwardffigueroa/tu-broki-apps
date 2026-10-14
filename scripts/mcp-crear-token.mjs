#!/usr/bin/env node
/**
 * Crea un token MCP (tbw_…) y lo imprime una sola vez.
 * Uso: node scripts/mcp-crear-token.mjs --label "Cursor Edward" --email you@x.com --scopes read,write[,admin]
 */

import { Prisma } from '@prisma/client';
import { getPrisma } from '../shared/prisma.js';
import { generarTokenClaro, hashToken } from '../shared/mcp-auth.js';
import { emailsPermitidos, normalizarEmail } from '../shared/auth.js';
import { env } from '../shared/env.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocal = path.join(raiz, '.env.local');
if (fs.existsSync(envLocal)) process.loadEnvFile(envLocal);

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

const label = arg('label');
const email = normalizarEmail(arg('email') || '');
const scopes = (arg('scopes', 'read,write') || '').split(',').map((s) => s.trim()).filter(Boolean);
const days = Number(arg('days', '365'));

if (!label || !email) {
  console.error('Uso: --label "…" --email … [--scopes read,write,admin] [--days 365]');
  process.exit(1);
}

const allow = emailsPermitidos(env('MCP_ALLOWED_EMAILS', env('APPS_ALLOWED_EMAILS')));
if (!allow.has(email)) {
  console.error(`Email ${email} no está en la allowlist.`);
  process.exit(1);
}

const token = generarTokenClaro();
const hash = hashToken(token);
const expires = new Date(Date.now() + days * 86400_000);

const scopesSql = Prisma.sql`ARRAY[${Prisma.join(scopes)}]::text[]`;
await getPrisma().$executeRaw(Prisma.sql`
  insert into wiki.mcp_tokens (token_hash, label, email, scopes, expires_at)
  values (${hash}, ${label}, ${email}, ${scopesSql}, ${expires})
`);

const base = process.env.MCP_PUBLIC_URL || 'http://127.0.0.1:4747/api/mcp';
console.log('\nToken (guárdalo; no se vuelve a mostrar):\n');
console.log(token);
console.log('\nSnippet .cursor/mcp.json:\n');
console.log(JSON.stringify({
  mcpServers: {
    'tubroki-wiki': {
      url: base,
      headers: { Authorization: `Bearer ${token}` },
    },
  },
}, null, 2));
console.log('');
process.exit(0);
