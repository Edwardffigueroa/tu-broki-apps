/**
 * Conexión única a Postgres (Supabase) para todas las apps.
 *
 * - Usa el *transaction pooler* de Supabase (puerto 6543), por eso `prepare: false`.
 * - El rol `tubroki_apps` solo tiene permisos sobre los schemas de las apps
 *   (ver supabase/migrations). Cada app vive en su propio schema.
 * - Se cachea en `globalThis` para reutilizar la conexión entre invocaciones
 *   calientes de la misma función serverless.
 */

import postgres from 'postgres';
import { env } from './env.js';

const CLAVE_GLOBAL = Symbol.for('tubroki.apps.sql');

export function getSql() {
  if (!globalThis[CLAVE_GLOBAL]) {
    globalThis[CLAVE_GLOBAL] = postgres(env('DATABASE_URL'), {
      prepare: false,
      ssl: 'require',
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return globalThis[CLAVE_GLOBAL];
}

/** Para scripts y tests que necesitan cerrar limpio. */
export async function cerrarSql() {
  const sql = globalThis[CLAVE_GLOBAL];
  if (sql) {
    await sql.end({ timeout: 5 });
    globalThis[CLAVE_GLOBAL] = undefined;
  }
}
