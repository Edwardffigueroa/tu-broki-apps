/**
 * Humo de Carriles Pro contra el servidor local (`npm run dev`).
 *
 *   npm run smoke:diagramas-flow
 *
 * Crea diagramas con prefijo ZZ-smoke-, ejercita tipo swimlane-flow y los borra.
 * Escribe en la DB de .env.local — solo con aprobación.
 */
import fs from 'node:fs';
import path from 'node:path';
import { EXAMPLE_ARRIENDO, modeloVacioFlow } from '../apps/diagramas/lib/flow/index.mjs';

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:4747';
const RAIZ = path.resolve(import.meta.dirname, '..');

function cargarEnv() {
  const f = path.join(RAIZ, '.env.local');
  if (!fs.existsSync(f)) return;
  for (const linea of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
cargarEnv();

let cookie = '';
let fallos = 0;
const creados = [];

async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  const texto = await r.text();
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    json = texto;
  }
  return { status: r.status, json };
}

function ok(nombre, condicion, extra = '') {
  if (condicion) {
    console.log(`  ok   ${nombre}`);
    return true;
  }
  fallos++;
  console.log(`  FALLA ${nombre}${extra ? ` → ${extra}` : ''}`);
  return false;
}

async function main() {
  console.log(`\nHumo Diagramas Flow → ${BASE}\n`);

  console.log('sesión');
  const { cookieSesionScript } = await import('./sesion-local.mjs');
  cookie = cookieSesionScript();
  const ses = await pedir('/api/auth/sesion');
  if (!ok('sesión local', ses.status === 200 && ses.json?.activa === true, JSON.stringify(ses.json))) {
    process.exit(1);
  }

  console.log('\nS1 crear Pro vacío');
  const s1 = await pedir('/api/diagramas/diagramas', {
    metodo: 'POST',
    cuerpo: { titulo: 'ZZ-smoke-pro', tipo: 'swimlane-flow' },
  });
  ok('201/200 Pro', s1.status < 300, `status ${s1.status} ${JSON.stringify(s1.json)}`);
  ok('tipo swimlane-flow', s1.json?.tipo === 'swimlane-flow');
  ok('kind flow', s1.json?.modelo?.kind === 'swimlane-flow');
  ok('3 carriles', s1.json?.modelo?.lanes?.length === 3);
  if (s1.json?.id) creados.push(s1.json.id);

  console.log('\nS2 crear Pro con ejemplo arriendo');
  const s2 = await pedir('/api/diagramas/diagramas', {
    metodo: 'POST',
    cuerpo: {
      titulo: 'ZZ-smoke-arriendo',
      tipo: 'swimlane-flow',
      modelo: EXAMPLE_ARRIENDO,
    },
  });
  ok('creado arriendo', s2.status < 300, `status ${s2.status}`);
  ok('59 nodos', s2.json?.modelo?.nodes?.length === 59, `n=${s2.json?.modelo?.nodes?.length}`);
  ok('72 edges', s2.json?.modelo?.edges?.length === 72, `e=${s2.json?.modelo?.edges?.length}`);
  if (s2.json?.id) creados.push(s2.json.id);
  const rev = s2.json?.revision ?? 1;
  const id2 = s2.json?.id;

  if (id2) {
    console.log('\nS3 PATCH ok');
    const modelo = structuredClone(s2.json.modelo);
    modelo.title = 'ZZ-smoke-arriendo editado';
    const s3 = await pedir(`/api/diagramas/diagrama?id=${encodeURIComponent(id2)}`, {
      metodo: 'PATCH',
      cuerpo: { revision: rev, modelo, titulo: modelo.title },
    });
    ok('PATCH 200', s3.status < 300, `status ${s3.status}`);
    ok('revision +1', Number(s3.json?.revision) === rev + 1, `rev=${s3.json?.revision}`);

    console.log('\nS4 conflicto 409');
    const s4 = await pedir(`/api/diagramas/diagrama?id=${encodeURIComponent(id2)}`, {
      metodo: 'PATCH',
      cuerpo: { revision: rev, modelo },
    });
    ok('409', s4.status === 409, `status ${s4.status}`);

    console.log('\nS5 cambio de tipo bloqueado');
    const s5 = await pedir(`/api/diagramas/diagrama?id=${encodeURIComponent(id2)}`, {
      metodo: 'PATCH',
      cuerpo: { revision: s3.json?.revision ?? rev + 1, tipo: 'swimlane' },
    });
    ok('400 tipo', s5.status === 400, `status ${s5.status}`);
    ok(
      'mensaje tipo',
      /no se puede cambiar/i.test(String(s5.json?.error || '')),
      s5.json?.error,
    );

    console.log('\nS6 modelo clásico sobre Pro → sigue Pro');
    const s6 = await pedir(`/api/diagramas/diagrama?id=${encodeURIComponent(id2)}`, {
      metodo: 'PATCH',
      cuerpo: {
        revision: s3.json?.revision ?? rev + 1,
        modelo: {
          title: 'ZZ-smoke-forzado',
          lanes: [{ id: 'a', name: 'A' }],
          nodes: [{ id: 'n1', lane: 'a', type: 'start', label: 'Inicio', step: 1 }],
          edges: [],
        },
      },
    });
    ok('acepta y normaliza', s6.status < 300, `status ${s6.status}`);
    ok('sigue kind flow', s6.json?.modelo?.kind === 'swimlane-flow');

    console.log('\nS7 límite 801 nodos');
    const muchos = {
      ...modeloVacioFlow('ZZ-smoke-limit'),
      nodes: Array.from({ length: 801 }, (_, i) => ({
        id: 's' + i,
        lane: 'cliente',
        type: 'task',
        label: 'x',
        col: 1,
        slot: 1,
      })),
    };
    const s7 = await pedir(`/api/diagramas/diagrama?id=${encodeURIComponent(id2)}`, {
      metodo: 'PATCH',
      cuerpo: { revision: s6.json?.revision, modelo: muchos },
    });
    ok('400 límite', s7.status === 400, `status ${s7.status}`);
  }

  console.log('\nS8 crear clásico sin tipo');
  const s8 = await pedir('/api/diagramas/diagramas', {
    metodo: 'POST',
    cuerpo: { titulo: 'ZZ-smoke-clasico' },
  });
  ok('clásico default', s8.status < 300 && s8.json?.tipo === 'swimlane', `tipo=${s8.json?.tipo}`);
  if (s8.json?.id) creados.push(s8.json.id);

  if (id2) {
    console.log('\nS9 duplicar Pro');
    const s9 = await pedir(`/api/diagramas/duplicar?id=${encodeURIComponent(id2)}`, {
      metodo: 'POST',
    });
    ok('duplica Pro', s9.status < 300 && s9.json?.tipo === 'swimlane-flow', `tipo=${s9.json?.tipo}`);
    if (s9.json?.id) creados.push(s9.json.id);
  }

  console.log('\nS10 lista');
  const s10 = await pedir('/api/diagramas/diagramas?q=ZZ-smoke-');
  ok('lista trae smokes', (s10.json?.diagramas || []).some((d) => d.titulo?.startsWith('ZZ-smoke-')));

  console.log('\nS11 limpieza');
  for (const id of creados) {
    const del = await pedir(`/api/diagramas/diagrama?id=${encodeURIComponent(id)}`, {
      metodo: 'DELETE',
    });
    ok(`DELETE ${id.slice(0, 8)}…`, del.status < 300, `status ${del.status}`);
  }

  console.log(fallos ? `\n✗ ${fallos} fallo(s)\n` : '\n✓ humo OK\n');
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
