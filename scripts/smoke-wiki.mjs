/**
 * Humo manual de la Wiki contra el servidor local (`npm run dev`).
 *
 *   node scripts/smoke-wiki.mjs
 *
 * Crea páginas con prefijo `ZZ-smoke-`, ejercita los flujos (borrador, versión,
 * renombrar con reescritura, mover, papelera, búsqueda, assets) y las borra al
 * final. No forma parte de `npm test` porque necesita servidor y base de datos.
 */
import fs from 'node:fs';
import path from 'node:path';

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
const creadas = [];

async function pedir(ruta, { metodo = 'GET', cuerpo, raw = false } = {}) {
  const r = await fetch(`${BASE}${ruta}`, {
    method: metodo,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const set = r.headers.get('set-cookie');
  if (set) cookie = set.split(';')[0];
  if (raw) return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), headers: r.headers };
  const texto = await r.text();
  let json;
  try { json = JSON.parse(texto); } catch { json = texto; }
  return { status: r.status, json };
}

function ok(nombre, condicion, extra = '') {
  if (condicion) { console.log(`  ok   ${nombre}`); return true; }
  fallos++;
  console.log(`  FALLA ${nombre}${extra ? ` → ${extra}` : ''}`);
  return false;
}

async function crear(titulo, campos = {}) {
  const { status, json } = await pedir('/api/wiki/pages', {
    metodo: 'POST', cuerpo: { title: titulo, ...campos },
  });
  if (status >= 300) throw new Error(`crear ${titulo}: ${status} ${JSON.stringify(json)}`);
  creadas.push(json.id);
  return json;
}

async function main() {
  console.log(`\nHumo Wiki → ${BASE}\n`);

  console.log('sesión');
  const sinSesion = await pedir('/api/wiki/pages');
  ok('API privada responde 401 sin cookie', sinSesion.status === 401, `status ${sinSesion.status}`);
  const { cookieSesionScript } = await import('./sesion-local.mjs');
  cookie = cookieSesionScript();
  const conSesion = await pedir('/api/auth/sesion');
  if (!ok('sesión local con SESSION_SECRET', conSesion.status === 200 && conSesion.json?.activa === true, JSON.stringify(conSesion.json))) return;

  console.log('\npáginas y árbol');
  const padre = await crear('ZZ-smoke-padre');
  const hijo = await crear('ZZ-smoke-hijo', { parent_id: padre.id });
  const hijo2 = await crear('ZZ-smoke-hijo-2', { parent_id: padre.id });
  const arbol = (await pedir('/api/wiki/pages')).json.pages;
  ok('el árbol trae el padre', arbol.some((p) => p.id === padre.id));
  const hijos = arbol.filter((p) => p.parent_id === padre.id).length;
  ok('el padre reporta 2 hijos', hijos === 2, `hijos=${hijos}`);

  console.log('\ntítulos únicos');
  const dup = await crear('ZZ-smoke-padre');
  ok('título duplicado recibe sufijo', dup.title === 'ZZ-smoke-padre (2)', dup.title);

  console.log('\nborrador y versión');
  const d = await pedir(`/api/wiki/draft?id=${hijo.id}`, {
    metodo: 'PUT',
    cuerpo: {
      content: `Apunta a [[${padre.title}]] y a [[ZZ-smoke-inexistente]].`,
      draft_revision: hijo.draft_revision,
    },
  });
  ok('guarda borrador', d.status === 200, JSON.stringify(d.json));
  const stale = await pedir(`/api/wiki/draft?id=${hijo.id}`, {
    metodo: 'PUT', cuerpo: { content: 'otra cosa', draft_revision: 0 },
  });
  ok('borrador con revisión vieja da 409', stale.status === 409, `status ${stale.status}`);

  const v1 = await pedir(`/api/wiki/versions?id=${hijo.id}`, {
    metodo: 'POST', cuerpo: { base_version_id: hijo.current_version_id, message: 'humo' },
  });
  ok('guarda versión', v1.status < 300, JSON.stringify(v1.json));
  const conflicto = await pedir(`/api/wiki/versions?id=${hijo.id}`, {
    metodo: 'POST', cuerpo: { base_version_id: hijo.current_version_id },
  });
  ok('versión con base vieja da 409', conflicto.status === 409, `status ${conflicto.status}`);

  console.log('\nenlaces');
  const bl = await pedir(`/api/wiki/backlinks?id=${padre.id}`);
  const entrada = bl.json?.backlinks?.find((b) => b.source_page_id === hijo.id);
  ok('el padre ve el backlink del hijo', !!entrada);
  ok('el backlink trae fragmento con el enlace',
    !!entrada?.snippet?.includes(`[[${padre.title}]]`), entrada?.snippet);

  console.log('\nrenombrar con reescritura');
  const nuevoNombre = `${padre.title}-renombrado`;
  const ren = await pedir(`/api/wiki/page?id=${padre.id}`, {
    metodo: 'PATCH', cuerpo: { title: nuevoNombre, rewrite_links: true },
  });
  ok('renombra', ren.status === 200, JSON.stringify(ren.json));
  const hijoTrasRen = await pedir(`/api/wiki/page?id=${hijo.id}`);
  const textoHijo = hijoTrasRen.json?.version?.content ?? hijoTrasRen.json?.content ?? '';
  ok('el enlace del hijo quedó reescrito', textoHijo.includes(`[[${nuevoNombre}]]`), textoHijo);

  const choque = await pedir(`/api/wiki/page?id=${hijo2.id}`, {
    metodo: 'PATCH', cuerpo: { title: nuevoNombre },
  });
  ok('renombrar a un título tomado da 409', choque.status === 409, `status ${choque.status}`);

  console.log('\nmover (ciclo)');
  const ciclo = await pedir(`/api/wiki/page?id=${padre.id}`, {
    metodo: 'PATCH', cuerpo: { parent_id: hijo.id },
  });
  ok('mover un padre dentro de su hijo da 409', ciclo.status === 409, `status ${ciclo.status}`);
  const auto = await pedir(`/api/wiki/page?id=${padre.id}`, {
    metodo: 'PATCH', cuerpo: { parent_id: padre.id },
  });
  ok('hacer una página su propia madre da 409', auto.status === 409, `status ${auto.status}`);
  const trasCiclo = (await pedir('/api/wiki/pages')).json.pages;
  ok('el padre sigue en la raíz tras los intentos',
    trasCiclo.find((p) => p.id === padre.id)?.parent_id === null);

  console.log('\nbúsqueda');
  const q = await pedir('/api/wiki/search?q=' + encodeURIComponent('inexistente'));
  ok('la búsqueda encuentra el contenido del hijo',
    q.json?.results?.some((r) => r.id === hijo.id),
    JSON.stringify(q.json)?.slice(0, 160));

  console.log('\nassets');
  // PNG 1x1 transparente.
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const up = await pedir('/api/wiki/assets', {
    metodo: 'POST', cuerpo: { mime_type: 'image/png', original_name: 'smoke.png', base64: png },
  });
  ok('sube asset', up.status < 300 && !!up.json?.id, JSON.stringify(up.json));
  const dedupe = await pedir('/api/wiki/assets', {
    metodo: 'POST', cuerpo: { mime_type: 'image/png', original_name: 'otro.png', base64: png },
  });
  ok('asset idéntico se deduplica', dedupe.json?.id === up.json?.id);
  if (up.json?.id) {
    const bin = await pedir(`/api/wiki/assets?id=${up.json.id}`, { raw: true });
    ok('descarga asset con su content-type',
      bin.status === 200 && bin.headers.get('content-type') === 'image/png',
      `${bin.status} ${bin.headers.get('content-type')}`);
  }
  const grande = await pedir('/api/wiki/assets', {
    metodo: 'POST',
    cuerpo: { mime_type: 'image/png', base64: Buffer.alloc(3.5 * 1024 * 1024).toString('base64') },
  });
  ok('asset sobre el límite se rechaza', grande.status === 413 || grande.status === 400,
    `status ${grande.status}`);
  const mimeMalo = await pedir('/api/wiki/assets', {
    metodo: 'POST', cuerpo: { mime_type: 'text/html', base64: 'PHNjcmlwdD4=' },
  });
  ok('mime no permitido se rechaza', mimeMalo.status === 400, `status ${mimeMalo.status}`);

  console.log('\npapelera');
  const del = await pedir(`/api/wiki/page?id=${hijo2.id}`, { metodo: 'DELETE' });
  ok('manda a la papelera', del.status === 200, JSON.stringify(del.json));
  const papelera = await pedir('/api/wiki/pages?papelera=1');
  ok('aparece en la papelera', papelera.json?.pages?.some((p) => p.id === hijo2.id));
  const arbol2 = await pedir('/api/wiki/pages');
  ok('ya no aparece en el árbol', !JSON.stringify(arbol2.json.pages).includes(hijo2.id));
  const rec = await pedir(`/api/wiki/untrash?id=${hijo2.id}`, { metodo: 'POST' });
  ok('se recupera', rec.status === 200, JSON.stringify(rec.json));

  console.log('\nhistorial y restauración');
  const vs = (await pedir(`/api/wiki/versions?id=${hijo.id}`)).json?.versions ?? [];
  ok('el historial tiene al menos 2 versiones', vs.length >= 2, `n=${vs.length}`);
  const primera = vs[vs.length - 1];
  if (primera) {
    const rest = await pedir(`/api/wiki/versions?id=${hijo.id}&vid=${primera.id}&accion=restaurar`, {
      metodo: 'POST',
    });
    ok('restaura una versión vieja', rest.status < 300, JSON.stringify(rest.json));
    const vs2 = (await pedir(`/api/wiki/versions?id=${hijo.id}`)).json?.versions ?? [];
    ok('la restauración crea una versión nueva (historial inmutable)',
      vs2.length === vs.length + 1, `n=${vs2.length}`);
  }

  console.log('\nexportar');
  const exp = (await pedir('/api/wiki/export')).json;
  ok('exporta archivos .md', (exp?.files?.length ?? 0) >= 3, `n=${exp?.files?.length}`);
  ok('la exportación no deja refs `asset:` crudas',
    !JSON.stringify(exp.files || []).includes('asset:'));

  console.log('\nlimpieza');
  for (const id of creadas) await pedir(`/api/wiki/page?id=${id}`, { metodo: 'DELETE' });
  console.log(`  ${creadas.length} página(s) a la papelera`);

  console.log(`\n${fallos === 0 ? 'Todo en verde' : `${fallos} falla(s)`}\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => { console.error('\nError:', e.message); process.exit(1); });
