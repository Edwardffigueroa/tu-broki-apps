#!/usr/bin/env node
/**
 * Arma la carpeta `public/` que Vercel sirve como estático:
 *
 *   home/*                 → public/            (launcher + pantalla de acceso)
 *   apps/<slug>/web/*      → public/<slug>/     (UI HTML de cada app)
 *   apps/<slug>/frontend   → public/<slug>/     (Vite: roadmap, diagramas)
 *   apps/<slug>/app.json   → public/apps.json
 *
 * Orden: limpia public → home + apps HTML → Vite apps.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOME = path.join(RAIZ, 'home');
const APPS = path.join(RAIZ, 'apps');
const PUBLIC = path.join(RAIZ, 'public');

/** Apps cuyo estático lo construye Vite (no copiar web/). */
const VITE_APPS = new Set(['roadmap', 'diagramas']);

export function build({ silencioso = false, skipVite = false } = {}) {
  fs.rmSync(PUBLIC, { recursive: true, force: true });
  fs.mkdirSync(PUBLIC, { recursive: true });

  fs.cpSync(HOME, PUBLIC, { recursive: true });

  const catalogo = [];
  for (const slug of fs.readdirSync(APPS).sort()) {
    const dirApp = path.join(APPS, slug);
    if (!fs.statSync(dirApp).isDirectory()) continue;

    const metaPath = path.join(dirApp, 'app.json');
    if (!fs.existsSync(metaPath)) {
      console.warn(`[build] apps/${slug} no tiene app.json — se omite del launcher.`);
      continue;
    }
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.oculta) continue;

    const web = path.join(dirApp, 'web');
    if (!VITE_APPS.has(slug) && fs.existsSync(web)) {
      fs.cpSync(web, path.join(PUBLIC, slug), { recursive: true });
    }
    catalogo.push({ slug, ruta: `/${slug}`, ...meta });
  }

  fs.writeFileSync(
    path.join(PUBLIC, 'apps.json'),
    JSON.stringify({ generado: new Date().toISOString(), apps: catalogo }, null, 2),
  );

  if (!skipVite) {
    for (const slug of VITE_APPS) {
      const frontend = path.join(APPS, slug, 'frontend');
      if (!fs.existsSync(path.join(frontend, 'package.json'))) continue;
      if (!silencioso) console.log(`[build] Vite → public/${slug}/…`);
      const r = spawnSync('npm', ['run', 'build', '--prefix', frontend], {
        cwd: RAIZ,
        stdio: silencioso ? 'ignore' : 'inherit',
        shell: process.platform === 'win32',
      });
      if (r.status !== 0) {
        throw new Error(`Vite build de ${slug} falló (exit ${r.status})`);
      }
    }
  }

  if (!silencioso) {
    console.log(`[build] public/ listo con ${catalogo.length} app(s): ${catalogo.map((a) => a.slug).join(', ')}`);
  }
  return catalogo;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  build({ skipVite: process.argv.includes('--skip-vite') });
}
