/**
 * Prisma Client singleton (Supabase Postgres, multi-schema).
 *
 * - Runtime: DATABASE_URL (transaction pooler :6543 + pgbouncer=true)
 * - Migraciones: DIRECT_URL (session pooler :5432)
 * - Cache en globalThis para invocaciones calientes en Vercel.
 */

import { Prisma, PrismaClient } from '@prisma/client'

const CLAVE_GLOBAL = Symbol.for('tubroki.apps.prisma')

/**
 * @returns {import('@prisma/client').PrismaClient}
 */
export function getPrisma() {
  if (!globalThis[CLAVE_GLOBAL]) {
    globalThis[CLAVE_GLOBAL] = new PrismaClient({
      log: process.env.PRISMA_LOG === '1' ? ['query', 'error', 'warn'] : ['error'],
    })
  }
  return globalThis[CLAVE_GLOBAL]
}

/**
 * Tagged template SQL sobre un cliente Prisma (o tx interactiva).
 * Uso: await q(db)`select … where id = ${id}::uuid`
 */
export function q(db) {
  return (strings, ...values) => db.$queryRaw(Prisma.sql(strings, ...values))
}

/** Para scripts y tests que necesitan cerrar limpio. */
export async function cerrarPrisma() {
  const client = globalThis[CLAVE_GLOBAL]
  if (client) {
    await client.$disconnect()
    globalThis[CLAVE_GLOBAL] = undefined
  }
}
