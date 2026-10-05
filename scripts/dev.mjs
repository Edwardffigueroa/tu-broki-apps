#!/usr/bin/env node
/**
 * Servidor local que imita a Vercel sin instalar nada más:
 *   - sirve `public/` (lo arma con scripts/build.mjs al arrancar)
 *   - enruta /api/<ruta> → api/<ruta>.js y ejecuta el export del método (GET, PUT, POST…)
 *     con la misma firma Web Request → Response que usa Vercel.
 *
 * Variables: .env.local (DATABASE_URL, APPS_PASSWORD, SESSION_SECRET).
 * Uso: npm run dev   (o NO_OPEN=1 npm run dev para no abrir el navegador)
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { build } from './build.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RAIZ, 'public');
const API = path.join(RAIZ, 'api');
const HOME = path.join(RAIZ, 'home');
const APPS = path.join(RAIZ, 'apps');
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT) || 4747;

const ENV_LOCAL = path.join(RAIZ, '.env.local');
if (fs.existsSync(ENV_LOCAL)) {
  process.loadEnvFile(ENV_LOCAL);
} else {
  console.warn('[dev] No existe .env.local — copia .env.example y rellena los valores.');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Raíces donde buscar un archivo estático, en orden.
 *
 * Apps con `web/` se leen desde la fuente (hot reload sin rebuild).
 * Apps Vite (p. ej. roadmap) solo existen en `public/<slug>/` tras `npm run build:roadmap`.
 * `public/` también cubre `apps.json` y el home.
 *
 * Solo aplica a estáticos: `api/`, `shared/` y `apps/<slug>/server/` se importan
 * una vez y quedan en la caché de módulos de Node, así que tocarlos pide reiniciar.
 */
function raicesPara(limpio) {
  const raices = [];
  const slug = limpio.split('/').filter(Boolean)[0];
  if (slug && fs.existsSync(path.join(APPS, slug, 'web'))) {
    raices.push({ dir: path.join(APPS, slug, 'web'), recorta: `/${slug}` });
  }
  raices.push({ dir: HOME, recorta: '' });
  raices.push({ dir: PUBLIC, recorta: '' });
  return raices;
}

function resolverEstatico(pathname) {
  const limpio = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');

  for (const { dir, recorta } of raicesPara(limpio)) {
    const relativo = recorta ? limpio.slice(recorta.length) || '/' : limpio;
    const base = path.join(dir, relativo);
    if (!base.startsWith(dir)) continue;
    for (const c of [base, `${base}.html`, path.join(base, 'index.html')]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
  }

  // SPA fallback: /roadmap|diagramas y /* (sin extensión) → public/<slug>/index.html
  const parts = limpio.split('/').filter(Boolean);
  if (parts[0] === 'roadmap' || parts[0] === 'diagramas') {
    const spa = path.join(PUBLIC, parts[0], 'index.html');
    if (fs.existsSync(spa)) return spa;
  }
  return null;
}

async function aRequest(req) {
  const url = `http://${req.headers.host || `${HOST}:${PORT}`}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v != null) headers.set(k, v);
  }
  const conCuerpo = !['GET', 'HEAD'].includes(req.method);
  let body;
  if (conCuerpo) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    body = Buffer.concat(chunks);
  }
  return new Request(url, { method: req.method, headers, body });
}

async function escribirResponse(res, response) {
  const headers = {};
  response.headers.forEach((v, k) => {
    if (k.toLowerCase() !== 'set-cookie') headers[k] = v;
  });
  const cookies = response.headers.getSetCookie?.() || [];
  if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(response.status, headers);
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

async function manejarApi(req, res, pathname) {
  const relativo = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
  const archivo = path.join(API, `${relativo}.js`);
  if (!archivo.startsWith(API) || !fs.existsSync(archivo)) {
    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `No existe la ruta /api/${relativo}` }));
    return;
  }
  const modulo = await import(pathToFileURL(archivo).href);
  const handler = modulo[req.method] || modulo.default;
  if (typeof handler !== 'function') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: `Método ${req.method} no permitido` }));
    return;
  }
  const response = await handler(await aRequest(req));
  await escribirResponse(res, response);
}

build();

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  try {
    if (pathname.startsWith('/api/')) {
      await manejarApi(req, res, pathname);
      return;
    }
    const archivo = resolverEstatico(pathname);
    if (!archivo) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('No encontrado');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(archivo)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(fs.readFileSync(archivo));
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message || 'Error interno' }));
  }
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}/`;
  console.log('');
  console.log('  TuBroki · Apps (modo local)');
  console.log('  ───────────────────────────');
  console.log(`  Launcher:  ${url}`);
  console.log(`  Roadmap:   ${url}roadmap  (build) ó http://${HOST}:5173/roadmap/ (Vite)`);
  console.log(`  Wiki:      ${url}wiki`);
  console.log('  API:       http://' + HOST + ':' + PORT + '/api/…');
  console.log('  Ctrl+C para cerrar. En otra terminal: npm run dev:roadmap');
  console.log('');
  if (process.env.NO_OPEN !== '1' && process.platform === 'darwin') {
    try {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } catch {
      /* ignore */
    }
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`El puerto ${PORT} ya está en uso. ¿Ya tienes el servidor abierto? → http://${HOST}:${PORT}/`);
    process.exit(1);
  }
  throw err;
});
