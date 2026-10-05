/**
 * Variables de entorno del backend compartido.
 * En Vercel se configuran en el proyecto; en local viven en `.env.local`
 * (las carga `scripts/dev.mjs`).
 */

const REQUERIDAS = [
  'DATABASE_URL',
  'SESSION_SECRET',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'APPS_ALLOWED_EMAILS',
];

export function env(nombre, porDefecto) {
  const v = process.env[nombre];
  if (v == null || v === '') {
    if (porDefecto !== undefined) return porDefecto;
    throw new Error(
      `Falta la variable de entorno ${nombre}. Revisa .env.local o la configuración de Vercel.`,
    );
  }
  return v;
}

/** Lanza un error claro si falta alguna variable crítica. */
export function verificarEnv() {
  const faltan = REQUERIDAS.filter((n) => !process.env[n]);
  if (faltan.length) {
    throw new Error(`Faltan variables de entorno: ${faltan.join(', ')}`);
  }
}
