/**
 * Carga `.env.local` y ejecuta un comando Prisma con el binario local.
 * Uso: node scripts/prisma-env.mjs migrate status
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ENV = path.join(RAIZ, '.env.local')

function loadEnv(file) {
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i)
    let v = t.slice(i + 1)
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[k] == null || process.env[k] === '') process.env[k] = v
  }
}

loadEnv(ENV)
const args = process.argv.slice(2)
if (!args.length) {
  console.error('Uso: node scripts/prisma-env.mjs <comando prisma…>')
  process.exit(1)
}
const r = spawnSync(process.execPath, [path.join(RAIZ, 'node_modules/prisma/build/index.js'), ...args], {
  stdio: 'inherit',
  env: process.env,
  cwd: RAIZ,
})
process.exit(r.status ?? 1)
