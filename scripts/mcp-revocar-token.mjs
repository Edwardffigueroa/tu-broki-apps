#!/usr/bin/env node
/**
 * Revoca tokens MCP por label.
 * Uso: node scripts/mcp-revocar-token.mjs --label "Cursor Edward"
 */

import { Prisma } from '@prisma/client';
import { getPrisma } from '../shared/prisma.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envLocal = path.join(raiz, '.env.local');
if (fs.existsSync(envLocal)) process.loadEnvFile(envLocal);

const i = process.argv.indexOf('--label');
const label = i >= 0 ? process.argv[i + 1] : null;
if (!label) {
  console.error('Uso: --label "…"');
  process.exit(1);
}

const r = await getPrisma().$executeRaw(Prisma.sql`
  update wiki.mcp_tokens set revoked_at = now()
  where label = ${label} and revoked_at is null
`);
console.log(`Revocados: ${r}`);
process.exit(0);
