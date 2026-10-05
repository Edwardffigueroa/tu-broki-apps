/**
 * Dedupe de páginas duplicadas del import + aliases de wikilinks rotos.
 *
 *   node scripts/wiki-dedupe-aliases.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APPS_ROOT = path.resolve(SCRIPT_DIR, '..');

function cargarEnv() {
  const f = path.join(APPS_ROOT, '.env.local');
  if (!fs.existsSync(f)) return;
  for (const linea of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}
cargarEnv();

const { getSql, cerrarSql } = await import(pathToFileURL(path.join(APPS_ROOT, 'shared/db.js')).href);
const repo = await import(pathToFileURL(path.join(APPS_ROOT, 'apps/wiki/server/repositorio.js')).href);
const { normalizeTitle } = await import(
  pathToFileURL(path.join(APPS_ROOT, 'apps/wiki/server/markdown.js')).href
);

const SUFFIX_RE = / \((\d+)\)$/;

/** Mapa fijo: alias legacy Obsidian → título (o title_key) canónico en la wiki. */
const ALIASES_FIJOS = [
  ['claude', 'Índice del conocimiento Tubroki'],
  ['claude.md', 'Índice del conocimiento Tubroki'],
  ['catalogo maestro de servicios', 'Catalogo de Servicios TuBroki'],
  ['pack 3 etapa 1 todo para arrendar', 'PACK 3 - Todo para Arrendar'],
  ['pack 2 etapa 1 publicacion y agendamiento', 'PACK 2 - Publicacion y Agenda'],
  ['pack 1 etapa 1 publicacion', 'PACK 1 - Publicacion'],
  ['paquete arriendos', 'ARRIENDOS-CATALOGO MAESTRO DE SERVICIOS'],
  ['planes venta', 'VENTA-CATALOGO MAESTRO DE SERVICIOS'],
  ['planes arriendo', 'ARRIENDOS-CATALOGO MAESTRO DE SERVICIOS'],
  ['mision y vision', '1.1.1 Misión - Visión - Manifiesto'],
  ['lean canvas', '1.4.1 lean-canvas'],
  ['estrategia de marketing', 'Estrategia de Marketing'],
  ['estudio de antecedentes', 'Journey - Estudio Antecedentes'],
  ['estudio de credito', 'Journey - Estudio de Credito'],
  ['contrato de arrendamiento y firma digital', 'Journey - Contrato de Arrendamiento y Firma Digital'],
  ['combo estudio completo', 'Journey - Combo Estudio Completo'],
  ['customer journey compradores', 'customer-journey'],
  ['customer journey ventas', 'customer-journey'],
  ['seguros de arriendo', 'Journey - Seguro de Arriendo'],
  ['formatos para entregar tu inmueble', 'Journey - Acta de Entrega'],
];

function stripSuffix(title) {
  return String(title || '').replace(SUFFIX_RE, '').trimEnd();
}

function scoreMatch(aliasKey, titleKey) {
  if (!aliasKey || !titleKey) return 0;
  if (aliasKey === titleKey) return 1000;
  if (titleKey.includes(aliasKey)) return 500 + aliasKey.length;
  if (aliasKey.includes(titleKey)) return 400 + titleKey.length;
  // tokens
  const at = new Set(aliasKey.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  const tt = new Set(titleKey.split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  let hit = 0;
  for (const t of at) if (tt.has(t)) hit += 1;
  if (!at.size) return 0;
  return (hit / at.size) * 200 + hit * 10;
}

async function dedupeFileAssets(sql) {
  console.log('Dedupe file-pages (mismo asset_id)…');
  const groups = await sql`
    select asset_id, array_agg(id order by created_at, id) as ids
    from wiki.pages
    where deleted_at is null and kind = 'file' and asset_id is not null
    group by asset_id
    having count(*) > 1
  `;
  let n = 0;
  for (const g of groups) {
    const ids = g.ids;
    for (let i = 1; i < ids.length; i += 1) {
      await repo.softDelete(sql, ids[i]);
      n += 1;
    }
  }
  console.log(`  soft-delete ${n} file-pages duplicadas`);
  return n;
}

async function renombrarSufijos(sql) {
  console.log('Renombrar títulos con sufijo (N)…');
  const pages = await sql`
    select id, title, title_key, parent_id, kind, created_at
    from wiki.pages
    where deleted_at is null and title ~ ' \\([0-9]+\\)$'
    order by created_at
  `;
  const byId = new Map(
    (
      await sql`select id, title, title_key from wiki.pages where deleted_at is null`
    ).map((p) => [p.id, p]),
  );

  let renamed = 0;
  let aliased = 0;

  for (const p of pages) {
    const base = stripSuffix(p.title);
    if (!base) continue;
    const baseKey = normalizeTitle(base);
    const parent = p.parent_id ? byId.get(p.parent_id) : null;
    const parentBase = parent ? stripSuffix(parent.title) : null;

    // 1) Si el título base está libre → restaurar
    if (await repo.tituloDisponible(sql, baseKey, p.id)) {
      try {
        await repo.renombrarPaginaSimple(sql, p.id, base, baseKey);
        await repo.upsertAlias(sql, baseKey, p.id);
        renamed += 1;
        continue;
      } catch (e) {
        if (e.code !== '23505') throw e;
      }
    }

    // 2) Calificar con padre: "Padre · base"
    if (parentBase) {
      const qualified = `${parentBase} · ${base}`;
      const qKey = normalizeTitle(qualified);
      if (qKey !== p.title_key && (await repo.tituloDisponible(sql, qKey, p.id))) {
        try {
          await repo.renombrarPaginaSimple(sql, p.id, qualified, qKey);
          // Alias del basename solo si nadie más lo reclama como título exacto
          // (múltiples _LEEME: no aliasar basename; sí aliasar "padre · _leeme" ya es el título)
          renamed += 1;
          // Alias útil: basenames que apuntaban al título viejo con (N)
          await repo.upsertAlias(sql, normalizeTitle(p.title), p.id);
          aliased += 1;
          byId.set(p.id, { id: p.id, title: qualified, title_key: qKey });
          continue;
        } catch (e) {
          if (e.code !== '23505') throw e;
        }
      }
    }

    // 3) Al menos alias del título con sufijo → misma página (noop) y alias basename
    //    solo para el primero de cada baseKey sin título exacto
    const [canonical] = await sql`
      select id from wiki.pages
      where deleted_at is null and title_key = ${baseKey}
      limit 1
    `;
    if (!canonical) {
      // Nadie tiene el basename exacto: aliasar al más antiguo de esta familia
      const [oldest] = await sql`
        select id from wiki.pages
        where deleted_at is null
          and (title_key = ${normalizeTitle(p.title)} or title = ${p.title}
               or title ~ ${'^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\([0-9]+\\)$'})
        order by created_at, id
        limit 1
      `;
      if (oldest) {
        await repo.upsertAlias(sql, baseKey, oldest.id);
        aliased += 1;
      }
    }
  }

  console.log(`  renombradas ${renamed} · aliases extra ${aliased}`);
  return { renamed, aliased };
}

async function sembrarAliases(sql) {
  console.log('Sembrar aliases (mapa fijo + fuzzy)…');
  const pages = await sql`
    select id, title, title_key from wiki.pages where deleted_at is null
  `;
  const byTitleKey = new Map(pages.map((p) => [p.title_key, p]));
  const byNormTitle = new Map(pages.map((p) => [normalizeTitle(p.title), p]));

  let n = 0;
  for (const [alias, targetTitle] of ALIASES_FIJOS) {
    const key = normalizeTitle(alias);
    const target =
      byTitleKey.get(normalizeTitle(targetTitle)) ||
      byNormTitle.get(normalizeTitle(targetTitle)) ||
      pages.find((p) => scoreMatch(normalizeTitle(targetTitle), p.title_key) >= 500);
    if (!target) {
      console.log(`  · sin match para alias «${alias}» → «${targetTitle}»`);
      continue;
    }
    await repo.upsertAlias(sql, key, target.id);
    n += 1;
  }

  // Fuzzy para links rotos restantes
  const unresolved = await sql`
    select target_key, count(*)::int as c
    from wiki.page_links
    where target_page_id is null
    group by target_key
    order by c desc
    limit 200
  `;
  let fuzzy = 0;
  for (const u of unresolved) {
    const key = u.target_key;
    if (byTitleKey.has(key)) continue;
    let best = null;
    let bestScore = 0;
    for (const p of pages) {
      const s = scoreMatch(key, p.title_key);
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    if (best && bestScore >= 180) {
      await repo.upsertAlias(sql, key, best.id);
      fuzzy += 1;
    }
  }

  console.log(`  fijos ${n} · fuzzy ${fuzzy}`);
  return { n, fuzzy };
}

async function reresolveLinks(sql) {
  console.log('Re-resolviendo page_links…');
  const pending = await sql`
    select distinct target_key from wiki.page_links where target_page_id is null
  `;
  let fixed = 0;
  for (const row of pending) {
    const id = await repo.resolverTargetId(sql, row.target_key);
    if (!id) continue;
    const r = await sql`
      update wiki.page_links set target_page_id = ${id}
      where target_key = ${row.target_key} and target_page_id is null
      returning 1
    `;
    fixed += r.length;
  }
  const [{ n: still }] = await sql`
    select count(*)::int as n from wiki.page_links where target_page_id is null
  `;
  console.log(`  celdas resueltas ${fixed} · siguen rotos ${still}`);
  return { fixed, still };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL');
    process.exit(1);
  }
  const sql = getSql();
  try {
    const deduped = await dedupeFileAssets(sql);
    const rename = await renombrarSufijos(sql);
    const aliases = await sembrarAliases(sql);
    const links = await reresolveLinks(sql);

    const out = {
      deduped_files: deduped,
      rename,
      aliases,
      links,
      at: new Date().toISOString(),
    };
    const outPath = path.join(APPS_ROOT, 'scripts/wiki-dedupe-aliases-report.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log('\n✅ Listo');
    console.log(JSON.stringify({ ...out, report: outPath }, null, 2));
  } finally {
    await cerrarSql();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
