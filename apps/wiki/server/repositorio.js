/**
 * Acceso a datos del schema `wiki` (Prisma + SQL crudo para FTS/funciones).
 */

import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { getPrisma } from '../../../shared/prisma.js'
import { normalizeTitle, extractWikilinks, extractAssetIds, positionBetween } from './markdown.js'

/** Tagged template SQL: await q(db)`select …` */
function q(db) {
  return (strings, ...values) => db.$queryRaw(Prisma.sql(strings, ...values))
}

function dbOf(db) {
  return db ?? getPrisma()
}

function begin(fn) {
  return getPrisma().$transaction((tx) => fn(tx), { maxWait: 15000, timeout: 120000 })
}

/** Columnas de wiki.pages sin `search` (tsvector; Prisma no lo deserializa). */
const PAGE_COLS = Prisma.raw(`
  id, parent_id, position, title, title_key, icon, metadata, kind, asset_id,
  current_version_id, draft_title, draft_content, draft_revision, draft_base_version_id,
  draft_updated_at, created_at, updated_at, deleted_at
`)
const PAGE_COLS_P = Prisma.raw(`
  p.id, p.parent_id, p.position, p.title, p.title_key, p.icon, p.metadata, p.kind, p.asset_id,
  p.current_version_id, p.draft_title, p.draft_content, p.draft_revision, p.draft_base_version_id,
  p.draft_updated_at, p.created_at, p.updated_at, p.deleted_at
`)


function iso(v) {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

function filaArbol(r) {
  return {
    id: r.id,
    parent_id: r.parent_id,
    position: r.position,
    title: r.title,
    title_key: r.title_key,
    icon: r.icon,
    kind: r.kind || 'page',
    asset_id: r.asset_id || null,
    mime_type: r.mime_type || null,
    size_bytes: r.size_bytes != null ? Number(r.size_bytes) : null,
    original_name: r.original_name || null,
    has_draft: r.draft_content != null || r.draft_title != null,
    updated_at: iso(r.updated_at),
    deleted_at: iso(r.deleted_at),
  };
}

function filaPagina(r, version) {
  return {
    id: r.id,
    parent_id: r.parent_id,
    position: r.position,
    title: r.title,
    title_key: r.title_key,
    icon: r.icon,
    kind: r.kind || 'page',
    asset_id: r.asset_id || null,
    mime_type: r.mime_type || null,
    size_bytes: r.size_bytes != null ? Number(r.size_bytes) : null,
    original_name: r.original_name || null,
    metadata: r.metadata || {},
    current_version_id: r.current_version_id,
    draft_title: r.draft_title,
    draft_content: r.draft_content,
    draft_revision: Number(r.draft_revision) || 0,
    draft_base_version_id: r.draft_base_version_id,
    draft_updated_at: iso(r.draft_updated_at),
    created_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
    deleted_at: iso(r.deleted_at),
    version: version
      ? {
          id: version.id,
          version_number: Number(version.version_number),
          title: version.title,
          content: version.content,
          content_hash: version.content_hash,
          author: version.author,
          message: version.message,
          source: version.source,
          restored_from: version.restored_from,
          created_at: iso(version.created_at),
        }
      : null,
  };
}

function filaVersion(r) {
  return {
    id: r.id,
    page_id: r.page_id,
    version_number: Number(r.version_number),
    title: r.title,
    content: r.content,
    content_hash: r.content_hash,
    author: r.author,
    message: r.message,
    source: r.source,
    restored_from: r.restored_from,
    created_at: iso(r.created_at),
  };
}

export async function listarArbol({ papelera = false } = {}) {
  const filas = papelera
    ? await q(getPrisma())`
        select p.id, p.parent_id, p.position, p.title, p.title_key, p.icon,
               p.kind, p.asset_id, p.draft_title, p.draft_content,
               p.updated_at, p.deleted_at,
               a.mime_type, a.size_bytes, a.original_name
        from wiki.pages p
        left join wiki.assets a on a.id = p.asset_id
        where p.deleted_at is not null
        order by p.deleted_at desc
      `
    : await q(getPrisma())`
        select p.id, p.parent_id, p.position, p.title, p.title_key, p.icon,
               p.kind, p.asset_id, p.draft_title, p.draft_content,
               p.updated_at, p.deleted_at,
               a.mime_type, a.size_bytes, a.original_name
        from wiki.pages p
        left join wiki.assets a on a.id = p.asset_id
        where p.deleted_at is null
        order by p.parent_id nulls first, p.position, p.title
      `;
  return filas.map(filaArbol);
}

export async function obtenerPagina(id, db) {
  const c = dbOf(db);
  const [r] = await q(c)`
    select ${PAGE_COLS_P}, a.mime_type, a.size_bytes, a.original_name
    from wiki.pages p
    left join wiki.assets a on a.id = p.asset_id
    where p.id = ${id}::uuid
  `;
  if (!r) return null;
  let version = null;
  if (r.current_version_id) {
    const [v] = await q(c)`
      select * from wiki.page_versions where id = ${r.current_version_id}::uuid
    `;
    version = v || null;
  }
  return filaPagina(r, version);
}

/**
 * Árbol + contenido actual de todas las páginas activas en una sola lectura.
 * Pensado para el boot del cliente (cache SWR): evita N round-trips.
 * Los binarios de kind=file NO se incluyen (solo meta).
 */
export async function listarBootstrap() {
  const filas = await q(getPrisma())`
    select
      p.id, p.parent_id, p.position, p.title, p.title_key, p.icon, p.metadata,
      p.kind, p.asset_id,
      p.current_version_id, p.draft_title, p.draft_content, p.draft_revision,
      p.draft_base_version_id, p.draft_updated_at, p.created_at, p.updated_at, p.deleted_at,
      a.mime_type, a.size_bytes, a.original_name,
      v.id            as v_id,
      v.version_number as v_version_number,
      v.title         as v_title,
      v.content       as v_content,
      v.content_hash  as v_content_hash,
      v.author        as v_author,
      v.message       as v_message,
      v.source        as v_source,
      v.restored_from as v_restored_from,
      v.created_at    as v_created_at
    from wiki.pages p
    left join wiki.assets a on a.id = p.asset_id
    left join wiki.page_versions v on v.id = p.current_version_id
    where p.deleted_at is null
    order by p.parent_id nulls first, p.position, p.title
  `;

  const pages = filas.map(filaArbol);
  const contents = filas.map((r) =>
    filaPagina(
      r,
      r.v_id
        ? {
            id: r.v_id,
            version_number: r.v_version_number,
            title: r.v_title,
            content: r.v_content,
            content_hash: r.v_content_hash,
            author: r.v_author,
            message: r.v_message,
            source: r.v_source,
            restored_from: r.v_restored_from,
            created_at: r.v_created_at,
          }
        : null,
    ),
  );
  const aliases = await listarAliases();
  return { pages, contents, aliases };
}

export async function siguientePosicion(parentId, db) {
  const c = dbOf(db);
  const [row] = parentId
    ? await q(c)`
        select position from wiki.pages
        where parent_id = ${parentId}::uuid and deleted_at is null
        order by position desc limit 1
      `
    : await q(c)`
        select position from wiki.pages
        where parent_id is null and deleted_at is null
        order by position desc limit 1
      `;
  return positionBetween(row?.position || null, null);
}

export async function crearPagina({
  title,
  titleKey,
  parentId = null,
  icon = null,
  metadata = {},
  content = '',
  author = 'TuBroki',
  source = 'web',
  message = null,
}) {
  return begin(async (tx) => {
    const position = await siguientePosicion(parentId, tx);
    const hash = createHash('sha256').update(content || '').digest('hex');

    const [page] = await q(tx)`
      insert into wiki.pages (parent_id, position, title, title_key, icon, metadata)
      values (
        ${parentId}::uuid, ${position}, ${title}, ${titleKey},
        ${icon}, ${metadata || {}}::jsonb
      )
      returning ${PAGE_COLS}
    `;

    const [version] = await q(tx)`
      insert into wiki.page_versions
        (page_id, version_number, title, content, content_hash, author, message, source)
      values (
        ${page.id}::uuid, 1, ${title}, ${content || ''}, ${hash},
        ${author}, ${message}, ${source}::wiki.version_source
      )
      returning *
    `;

    await q(tx)`
      update wiki.pages set
        current_version_id = ${version.id}::uuid,
        search = to_tsvector(
          'spanish',
          extensions.unaccent(${title + ' ' + (content || '').slice(0, 500000)})
        ),
        updated_at = now()
      where id = ${page.id}::uuid
    `;

    await sincronizarEnlaces(tx, page.id, content || '');
    await sincronizarAssetsVersion(tx, version.id, content || '');
    await resolverEnlacesPendientes(tx, titleKey, page.id);

    return obtenerPagina(page.id, tx);
  });
}

/**
 * Crea una página kind=file ligada a un asset ya upsertado.
 * content = nota opcional (Markdown corto); el binario vive en assets.
 */
export async function crearPaginaArchivo({
  title,
  titleKey,
  parentId = null,
  icon = null,
  assetId,
  note = '',
  author = 'TuBroki',
  originalName = null,
}) {
  return begin(async (tx) => {
    const position = await siguientePosicion(parentId, tx);
    const content = note || '';
    const hash = createHash('sha256').update(content).digest('hex');
    const searchText = `${title} ${originalName || ''} ${content}`.trim();

    const [page] = await q(tx)`
      insert into wiki.pages
        (parent_id, position, title, title_key, icon, metadata, kind, asset_id)
      values (
        ${parentId}::uuid, ${position}, ${title}, ${titleKey},
        ${icon}, ${{}}::jsonb, 'file', ${assetId}::uuid
      )
      returning ${PAGE_COLS}
    `;

    const [version] = await q(tx)`
      insert into wiki.page_versions
        (page_id, version_number, title, content, content_hash, author, message, source)
      values (
        ${page.id}::uuid, 1, ${title}, ${content}, ${hash},
        ${author}, ${'Documento subido'}, 'web'::wiki.version_source
      )
      returning *
    `;

    await q(tx)`
      update wiki.pages set
        current_version_id = ${version.id}::uuid,
        search = to_tsvector('spanish', extensions.unaccent(${searchText.slice(0, 500000)})),
        updated_at = now()
      where id = ${page.id}::uuid
    `;

    await resolverEnlacesPendientes(tx, titleKey, page.id);
    return obtenerPagina(page.id, tx);
  });
}

/** Cambia el asset de una página kind=file (reemplazar archivo). */
export async function reemplazarAssetDePagina(pageId, assetId, { originalName = null } = {}) {
  return begin(async (tx) => {
    const [page] = await q(tx)`
      select ${PAGE_COLS} from wiki.pages where id = ${pageId}::uuid and deleted_at is null for update
    `;
    if (!page) return null;
    if (page.kind !== 'file') {
      const err = new Error('not_a_file_page');
      err.code = 'not_a_file_page';
      throw err;
    }

    await q(tx)`
      update wiki.pages set
        asset_id = ${assetId}::uuid,
        search = to_tsvector(
          'spanish',
          extensions.unaccent(${`${page.title} ${originalName || ''}`.slice(0, 500000)})
        ),
        updated_at = now()
      where id = ${pageId}::uuid
    `;
    return obtenerPagina(pageId, tx);
  });
}

export async function actualizarPaginaMeta(id, {
  title,
  titleKey,
  parentId,
  position,
  icon,
  metadata,
  rewriteLinks = false,
  author = 'TuBroki',
}) {
  return begin(async (tx) => {
    const [prev] = await q(tx)`select ${PAGE_COLS} from wiki.pages where id = ${id}::uuid and deleted_at is null for update`;
    if (!prev) return null;

    const nuevoTitulo = title != null ? title : prev.title;
    const nuevaKey = titleKey != null ? titleKey : prev.title_key;
    const nuevoParent = parentId !== undefined ? parentId : prev.parent_id;
    const nuevaPos = position != null ? position : prev.position;
    const nuevoIcon = icon !== undefined ? icon : prev.icon;
    const nuevoMeta = metadata != null ? metadata : prev.metadata;

    await q(tx)`
      update wiki.pages set
        title = ${nuevoTitulo},
        title_key = ${nuevaKey},
        parent_id = ${nuevoParent}::uuid,
        position = ${nuevaPos},
        icon = ${nuevoIcon},
        metadata = ${nuevoMeta || {}}::jsonb,
        updated_at = now()
      where id = ${id}::uuid
    `;

    if (rewriteLinks && prev.title_key !== nuevaKey) {
      await reescribirBacklinks(tx, prev.title_key, nuevaKey, prev.title, nuevoTitulo, author);
    } else if (prev.title_key !== nuevaKey) {
      await resolverEnlacesPendientes(tx, nuevaKey, id);
      await q(tx)`
        update wiki.page_links set target_page_id = null
        where target_page_id = ${id}::uuid and target_key <> ${nuevaKey}
      `;
      await q(tx)`
        update wiki.page_links set target_page_id = ${id}::uuid
        where target_key = ${nuevaKey}
      `;
    }

    return obtenerPagina(id, tx);
  });
}

export async function guardarBorrador(id, {
  draftTitle,
  draftContent,
  draftRevision,
  baseVersionId,
}) {
  return begin(async (tx) => {
    const [page] = await q(tx)`
      select ${PAGE_COLS} from wiki.pages where id = ${id}::uuid and deleted_at is null for update
    `;
    if (!page) return { ok: false, code: 'page_not_found' };

    if (Number(draftRevision) !== Number(page.draft_revision)) {
      return {
        ok: false,
        code: 'draft_changed',
        draft_revision: Number(page.draft_revision),
        draft_title: page.draft_title,
        draft_content: page.draft_content,
        draft_updated_at: iso(page.draft_updated_at),
      };
    }

    const [upd] = await q(tx)`
      update wiki.pages set
        draft_title = ${draftTitle ?? page.draft_title},
        draft_content = ${draftContent ?? page.draft_content},
        draft_base_version_id = ${baseVersionId ?? page.current_version_id}::uuid,
        draft_revision = draft_revision + 1,
        draft_updated_at = now(),
        updated_at = now()
      where id = ${id}::uuid
      returning draft_revision, draft_updated_at, draft_base_version_id
    `;
    return {
      ok: true,
      draft_revision: Number(upd.draft_revision),
      draft_updated_at: iso(upd.draft_updated_at),
      draft_base_version_id: upd.draft_base_version_id,
    };
  });
}

export async function descartarBorrador(id) {
  const [page] = await q(getPrisma())`
    update wiki.pages set
      draft_title = null,
      draft_content = null,
      draft_base_version_id = null,
      draft_updated_at = null,
      draft_revision = draft_revision + 1,
      updated_at = now()
    where id = ${id}::uuid and deleted_at is null
    returning draft_revision
  `;
  if (!page) return null;
  return { ok: true, draft_revision: Number(page.draft_revision) };
}

export async function guardarVersion({
  pageId,
  baseVersionId,
  title,
  content,
  message,
  author = 'TuBroki',
  source = 'web',
  db,
}) {
  const c = dbOf(db);
  try {
    const [version] = await q(c)`
      select * from wiki.save_page_version(
        ${pageId}::uuid,
        ${baseVersionId}::uuid,
        ${author},
        ${message},
        ${source}::wiki.version_source,
        ${title},
        ${content}
      )
    `;
    await sincronizarEnlaces(c, pageId, version.content);
    await sincronizarAssetsVersion(c, version.id, version.content);
    const page = await obtenerPagina(pageId, c);
    return { ok: true, version: filaVersion(version), page };
  } catch (e) {
    const msg = String(e.message || e);
    if (msg.includes('version_conflict')) {
      return { ok: false, code: 'version_conflict', detail: e.detail || null };
    }
    if (msg.includes('no_changes')) {
      return { ok: false, code: 'no_changes' };
    }
    if (msg.includes('page_not_found') || msg.includes('nothing_to_save')) {
      return { ok: false, code: msg.includes('nothing_to_save') ? 'nothing_to_save' : 'page_not_found' };
    }
    // El título nuevo choca con otra página activa (índice único sobre title_key).
    if (e.code === '23505') {
      return { ok: false, code: 'title_taken' };
    }
    throw e;
  }
}

export async function listarVersiones(pageId) {
  const filas = await q(getPrisma())`
    select id, page_id, version_number, title, content_hash, author, message,
           source, restored_from, created_at
    from wiki.page_versions
    where page_id = ${pageId}::uuid
    order by version_number desc
  `;
  return filas.map((r) => ({
    id: r.id,
    page_id: r.page_id,
    version_number: Number(r.version_number),
    title: r.title,
    content_hash: r.content_hash,
    author: r.author,
    message: r.message,
    source: r.source,
    restored_from: r.restored_from,
    created_at: iso(r.created_at),
  }));
}

export async function obtenerVersion(pageId, versionId) {
  const [r] = await q(getPrisma())`
    select * from wiki.page_versions
    where id = ${versionId}::uuid and page_id = ${pageId}::uuid
  `;
  return r ? filaVersion(r) : null;
}

/**
 * Restaura creando una versión nueva con `restored_from` apuntando a la original.
 * No se actualiza ni se borra nada: las versiones son inmutables.
 */
export async function restaurarVersionConOrigen(pageId, versionId, author = 'TuBroki') {
  return begin(async (tx) => {
    const [page] = await q(tx)`
      select ${PAGE_COLS} from wiki.pages where id = ${pageId}::uuid and deleted_at is null for update
    `;
    if (!page) return { ok: false, code: 'page_not_found' };

    const [vieja] = await q(tx)`
      select * from wiki.page_versions where id = ${versionId}::uuid and page_id = ${pageId}
    `;
    if (!vieja) return { ok: false, code: 'version_not_found' };

    const hash = createHash('sha256').update(vieja.content).digest('hex');
    const [version] = await q(tx)`
      insert into wiki.page_versions
        (page_id, version_number, title, content, content_hash, author, message, source, restored_from)
      values (
        ${pageId}::uuid,
        coalesce((select max(version_number) from wiki.page_versions where page_id = ${pageId}::uuid), 0) + 1,
        ${vieja.title}, ${vieja.content}, ${hash}, ${author},
        ${`Restaurada desde v${vieja.version_number}`}, 'web'::wiki.version_source, ${vieja.id}::uuid
      )
      returning *
    `;

    await q(tx)`
      update wiki.pages set
        title = ${vieja.title},
        title_key = wiki.normalize_title(${vieja.title}),
        current_version_id = ${version.id}::uuid,
        draft_title = null,
        draft_content = null,
        draft_base_version_id = null,
        draft_updated_at = null,
        draft_revision = draft_revision + 1,
        search = to_tsvector(
          'spanish',
          extensions.unaccent(${vieja.title + ' ' + String(vieja.content).slice(0, 500000)})
        ),
        updated_at = now()
      where id = ${pageId}::uuid
    `;

    await sincronizarEnlaces(tx, pageId, vieja.content);
    await sincronizarAssetsVersion(tx, version.id, vieja.content);

    return {
      ok: true,
      version: filaVersion(version),
      page: await obtenerPagina(pageId, tx),
    };
  });
}

export async function softDelete(id) {
  return begin(async (tx) => {
    const [r] = await q(tx)`
      update wiki.pages set deleted_at = now(), updated_at = now()
      where id = ${id}::uuid and deleted_at is null
      returning id
    `;
    if (!r) return false;
    // Las páginas en papelera no deben seguir resolviendo enlaces entrantes:
    // quedan "sin resolver" hasta que se recuperen.
    await q(tx)`
      update wiki.page_links set target_page_id = null where target_page_id = ${id}::uuid
    `;
    await q(tx)`delete from wiki.page_aliases where page_id = ${id}::uuid`;
    // Los hijos suben al abuelo para no quedar colgando de una página borrada.
    await q(tx)`
      update wiki.pages set parent_id = (
        select parent_id from wiki.pages where id = ${id}::uuid
      )
      where parent_id = ${id}::uuid and deleted_at is null
    `;
    return true;
  });
}

export async function untrash(id) {
  const [page] = await q(getPrisma())`select ${PAGE_COLS} from wiki.pages where id = ${id}::uuid`;
  if (!page || !page.deleted_at) return { ok: false, code: 'not_in_trash' };

  // Resolver conflicto de título
  let titleKey = page.title_key;
  let title = page.title;
  const [dup] = await q(getPrisma())`
    select id from wiki.pages
    where title_key = ${titleKey} and deleted_at is null and id <> ${id}::uuid
  `;
  if (dup) {
    title = `${page.title} (recuperada)`;
    titleKey = normalizeTitle(title);
  }

  await q(getPrisma())`
    update wiki.pages set
      deleted_at = null,
      title = ${title},
      title_key = ${titleKey},
      updated_at = now()
    where id = ${id}::uuid
  `;
  await resolverEnlacesPendientes(getPrisma(), titleKey, id);
  return { ok: true, page: await obtenerPagina(id) };
}

export async function backlinks(pageId) {
  const filas = await q(getPrisma())`
    select pl.source_page_id, pl.target_key,
           p.title as source_title, p.title_key as source_title_key,
           v.content
    from wiki.page_links pl
    join wiki.pages p on p.id = pl.source_page_id and p.deleted_at is null
    left join wiki.page_versions v on v.id = p.current_version_id
    where pl.target_page_id = ${pageId}::uuid
    order by p.title
  `;
  return filas.map((r) => ({
    source_page_id: r.source_page_id,
    source_title: r.source_title,
    snippet: fragmentoDelEnlace(r.content || '', r.target_key),
  }));
}

/**
 * Texto alrededor del `[[enlace]]` que apunta a `targetKey`.
 * El contenido guarda el título con tildes y `target_key` va normalizado,
 * así que se compara normalizando cada enlace encontrado.
 */
function fragmentoDelEnlace(content, targetKey) {
  for (const m of content.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?(?:#[^\]]+)?\]\]/g)) {
    if (normalizeTitle(m[1]) !== targetKey) continue;
    const desde = Math.max(0, m.index - 40);
    const hasta = m.index + m[0].length + 40;
    return `${desde > 0 ? '…' : ''}${content.slice(desde, hasta).replace(/\s+/g, ' ').trim()}${
      hasta < content.length ? '…' : ''
    }`;
  }
  return content.slice(0, 80).replace(/\s+/g, ' ').trim();
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function buscar(texto, { limit = 50 } = {}) {
  const query = String(texto || '').trim();
  if (!query) return [];

  // Marcadores propios (no HTML) para que el cliente escape y luego resalte seguro.
  const headlineOpts =
    'StartSel=<<, StopSel=>>, MaxWords=18, MinWords=8, MaxFragments=2, FragmentDelimiter= … ';

  const filas = await q(getPrisma())`
    with q as (
      select plainto_tsquery('spanish', extensions.unaccent(${query})) as tsq
    ),
    base as (
      select
        p.id, p.title, p.title_key, p.parent_id,
        coalesce(v.content, '') as content,
        ts_rank(p.search, q.tsq) as fts_rank,
        (
          lower(extensions.unaccent(p.title)) like '%' || lower(extensions.unaccent(${query})) || '%'
        ) as title_hit,
        (
          p.search @@ q.tsq
          or lower(extensions.unaccent(coalesce(v.content, '')))
             like '%' || lower(extensions.unaccent(${query})) || '%'
        ) as content_hit
      from wiki.pages p
      cross join q
      left join wiki.page_versions v on v.id = p.current_version_id
      where p.deleted_at is null
        and (
          p.search @@ q.tsq
          or lower(extensions.unaccent(p.title)) like '%' || lower(extensions.unaccent(${query})) || '%'
          or lower(extensions.unaccent(coalesce(v.content, '')))
             like '%' || lower(extensions.unaccent(${query})) || '%'
        )
    )
    select
      id, title, title_key, parent_id, title_hit, content_hit,
      (fts_rank
        + case when title_hit then 0.6 else 0 end
        + case when content_hit and not title_hit then 0.15 else 0 end
      ) as rank,
      case
        when content_hit then ts_headline(
          'spanish',
          left(content, 4000),
          plainto_tsquery('spanish', extensions.unaccent(${query})),
          ${headlineOpts}
        )
        else title
      end as headline
    from base
    order by rank desc, title
    limit ${limit}
  `;

  return filas.map((r) => {
    const titleHit = Boolean(r.title_hit);
    const contentHit = Boolean(r.content_hit);
    let match = 'content';
    if (titleHit && contentHit) match = 'both';
    else if (titleHit) match = 'title';
    return {
      id: r.id,
      title: r.title,
      title_key: r.title_key,
      parent_id: r.parent_id,
      rank: Number(r.rank) || 0,
      match,
      headline: r.headline || r.title,
    };
  });
}

export async function upsertAsset({ buffer, mimeType, originalName }) {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const [existente] = await q(getPrisma())`
    select id, sha256, mime_type, size_bytes, original_name, created_at
    from wiki.assets where sha256 = ${sha256}
  `;
  if (existente) {
    return {
      id: existente.id,
      sha256: existente.sha256,
      mime_type: existente.mime_type,
      size_bytes: Number(existente.size_bytes),
      original_name: existente.original_name,
      created_at: iso(existente.created_at),
      deduped: true,
    };
  }
  const [row] = await q(getPrisma())`
    insert into wiki.assets (sha256, mime_type, size_bytes, original_name, content)
    values (
      ${sha256}, ${mimeType}, ${buffer.length}, ${originalName || null}, ${buffer}
    )
    returning id, sha256, mime_type, size_bytes, original_name, created_at
  `;
  return {
    id: row.id,
    sha256: row.sha256,
    mime_type: row.mime_type,
    size_bytes: Number(row.size_bytes),
    original_name: row.original_name,
    created_at: iso(row.created_at),
    deduped: false,
  };
}

export async function obtenerAsset(id, { conContenido = false } = {}) {
  if (conContenido) {
    const [r] = await q(getPrisma())`
      select id, sha256, mime_type, size_bytes, original_name, content, created_at
      from wiki.assets where id = ${id}::uuid
    `;
    return r || null;
  }
  const [r] = await q(getPrisma())`
    select id, sha256, mime_type, size_bytes, original_name, created_at
    from wiki.assets where id = ${id}::uuid
  `;
  return r || null;
}

export async function listarAssetsPorIds(ids) {
  if (!ids.length) return [];
  return q(getPrisma())`
    select id, sha256, mime_type, size_bytes, original_name, content
    from wiki.assets where id in (${Prisma.join(ids)})
  `;
}

async function sincronizarEnlaces(db, sourcePageId, content) {
  const c = dbOf(db);
  const keys = extractWikilinks(content);
  await q(c)`delete from wiki.page_links where source_page_id = ${sourcePageId}::uuid`;
  for (const key of keys) {
    const targetId = await resolverTargetId(key, c);
    await q(c)`
      insert into wiki.page_links (source_page_id, target_key, target_page_id)
      values (${sourcePageId}::uuid, ${key}, ${targetId}::uuid)
      on conflict (source_page_id, target_key) do update
        set target_page_id = excluded.target_page_id
    `;
  }
}

/** Resuelve title_key o alias → page id. */
export async function resolverTargetId(key, db) {
  const c = dbOf(db);
  const [byTitle] = await q(c)`
    select id from wiki.pages where title_key = ${key} and deleted_at is null limit 1
  `;
  if (byTitle) return byTitle.id;
  const [byAlias] = await q(c)`
    select a.page_id as id
    from wiki.page_aliases a
    join wiki.pages p on p.id = a.page_id
    where a.alias_key = ${key} and p.deleted_at is null
    limit 1
  `;
  return byAlias?.id || null;
}

export async function listarAliases() {
  const rows = await q(getPrisma())`
    select a.alias_key, a.page_id
    from wiki.page_aliases a
    join wiki.pages p on p.id = a.page_id
    where p.deleted_at is null
  `;
  return rows.map((r) => ({ alias_key: r.alias_key, page_id: r.page_id }));
}

export async function upsertAlias(aliasKey, pageId, db) {
  const c = dbOf(db);
  const key = normalizeTitle(aliasKey);
  if (!key || !pageId) return null;
  await q(c)`
    insert into wiki.page_aliases (alias_key, page_id)
    values (${key}, ${pageId}::uuid)
    on conflict (alias_key) do update set page_id = excluded.page_id
  `;
  await q(c)`
    update wiki.page_links set target_page_id = ${pageId}::uuid
    where target_key = ${key}
  `;
  return { alias_key: key, page_id: pageId };
}

export async function renombrarPaginaSimple(id, nuevoTitulo, titleKey, db) {
  const c = dbOf(db);
  await q(c)`
    update wiki.pages set
      title = ${nuevoTitulo},
      title_key = ${titleKey},
      updated_at = now()
    where id = ${id}::uuid and deleted_at is null
  `;
  await resolverEnlacesPendientes(c, titleKey, id);
}

async function sincronizarAssetsVersion(db, versionId, content) {
  const c = dbOf(db);
  const ids = extractAssetIds(content);
  await q(c)`delete from wiki.version_assets where version_id = ${versionId}::uuid`;
  for (const assetId of ids) {
    const [a] = await q(c)`select id from wiki.assets where id = ${assetId}::uuid`;
    if (!a) continue;
    await q(c)`
      insert into wiki.version_assets (version_id, asset_id)
      values (${versionId}::uuid, ${assetId}::uuid)
      on conflict do nothing
    `;
  }
}

async function resolverEnlacesPendientes(db, titleKey, pageId) {
  if (!pageId) return;
  const c = dbOf(db);
  await q(c)`
    update wiki.page_links set target_page_id = ${pageId}::uuid
    where target_key = ${titleKey} and (target_page_id is null or target_page_id <> ${pageId}::uuid)
  `;
  await q(c)`
    update wiki.page_links set target_page_id = ${pageId}::uuid
    where target_key in (
      select alias_key from wiki.page_aliases where page_id = ${pageId}::uuid
    )
    and (target_page_id is null or target_page_id <> ${pageId}::uuid)
  `;
}

async function reescribirBacklinks(db, oldKey, newKey, oldTitle, newTitle, author) {
  const c = dbOf(db);
  const fuentes = await q(c)`
    select distinct source_page_id from wiki.page_links
    where target_key = ${oldKey} or target_page_id in (
      select id from wiki.pages where title_key = ${oldKey}
    )
  `;

  for (const f of fuentes) {
    const page = await obtenerPagina(f.source_page_id, c);
    if (!page?.version) continue;
    const content = page.version.content || '';
    // Reescribir [[Old]] y [[Old|alias]]
    const re = new RegExp(`\\[\\[${escapeReg(oldTitle)}(\\|[^\\]]*)?\\]\\]`, 'gi');
    const nuevo = content.replace(re, (_, alias) => `[[${newTitle}${alias || ''}]]`);
    if (nuevo === content) continue;

    await guardarVersion({
      pageId: page.id,
      baseVersionId: page.current_version_id,
      title: page.title,
      content: nuevo,
      message: 'Enlace actualizado por renombrado',
      author,
      source: 'system',
      db: c,
    });
  }

  await resolverEnlacesPendientes(c, newKey, (
    await q(c)`select id from wiki.pages where title_key = ${newKey} and deleted_at is null limit 1`
  )[0]?.id);
}

export async function tituloDisponible(titleKey, exceptId = null) {
  const [row] = exceptId
    ? await q(getPrisma())`
        select id from wiki.pages
        where title_key = ${titleKey} and deleted_at is null and id <> ${exceptId}::uuid
        limit 1
      `
    : await q(getPrisma())`
        select id from wiki.pages
        where title_key = ${titleKey} and deleted_at is null
        limit 1
      `;
  return !row;
}

export async function sugerirTituloUnico(baseTitle) {
  let title = String(baseTitle || 'Sin título').trim() || 'Sin título';
  let key = normalizeTitle(title);
  let n = 2;
  while (!(await tituloDisponible(key))) {
    title = `${baseTitle} (${n})`;
    key = normalizeTitle(title);
    n += 1;
    if (n > 200) break;
  }
  return { title, titleKey: key };
}

export { sincronizarEnlaces, filaVersion };

/* ─── MCP: resolve / search / grafo / aliases / purge / stats ─── */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolvePageId(ref, { includeDeleted = false } = {}) {
  const raw = String(ref || '').trim();
  if (!raw) return null;
  const [row] = await q(getPrisma())`
    select wiki.resolve_page(${raw}, ${includeDeleted}) as id
  `;
  return row?.id || null;
}

export async function resolvePageMeta(ref, { includeDeleted = false } = {}) {
  const raw = String(ref || '').trim();
  if (!raw) return null;

  if (UUID_RE.test(raw)) {
    const [byId] = await q(getPrisma())`
      select id, title, title_key from wiki.pages
      where id = ${raw}::uuid and (${includeDeleted} or deleted_at is null)
      limit 1
    `;
    if (byId) return { id: byId.id, title: byId.title, title_key: byId.title_key, via: 'id' };
  }

  const key = normalizeTitle(raw);
  const [byTitle] = await q(getPrisma())`
    select id, title, title_key from wiki.pages
    where title_key = ${key}
      and (${includeDeleted} or deleted_at is null)
    order by deleted_at nulls first
    limit 1
  `;
  if (byTitle) return { id: byTitle.id, title: byTitle.title, title_key: byTitle.title_key, via: 'title' };

  const [byAlias] = await q(getPrisma())`
    select p.id, p.title, p.title_key, a.alias_key
    from wiki.page_aliases a
    join wiki.pages p on p.id = a.page_id
    where a.alias_key = ${key}
      and (${includeDeleted} or p.deleted_at is null)
    order by p.deleted_at nulls first
    limit 1
  `;
  if (byAlias) {
    return { id: byAlias.id, title: byAlias.title, title_key: byAlias.title_key, via: 'alias', alias_key: byAlias.alias_key };
  }
  return null;
}

export async function sugerirTitulos(qtext, { limit = 5 } = {}) {
  const key = normalizeTitle(qtext);
  if (!key) return [];
  const filas = await q(getPrisma())`
    select title from wiki.pages
    where deleted_at is null
      and (title_key like ${key + '%'} or title_key % ${key})
    order by similarity(title_key, ${key}) desc nulls last, title
    limit ${limit}
  `.catch(async () => q(getPrisma())`
    select title from wiki.pages
    where deleted_at is null and title_key like ${'%' + key + '%'}
    order by title limit ${limit}
  `);
  return filas.map((r) => r.title);
}

export async function buscarAvanzado(texto, { limit = 50, mode = 'fts', under = null, kind = null } = {}) {
  const query = String(texto || '').trim();
  if (!query && mode !== 'title') return [];
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);

  let underIds = null;
  if (under) {
    underIds = await idsSubarbol(under);
    if (!underIds.length) return [];
  }

  if (mode === 'title') {
    const key = normalizeTitle(query);
    const filas = underIds
      ? await q(getPrisma())`
          select id, title, title_key, parent_id, kind
          from wiki.pages
          where deleted_at is null
            and id in (${Prisma.join(underIds)})
            and (${kind}::text is null or kind = ${kind})
            and (title_key like ${'%' + key + '%'} or lower(title) like ${'%' + query.toLowerCase() + '%'})
          order by title limit ${lim}
        `
      : await q(getPrisma())`
          select id, title, title_key, parent_id, kind
          from wiki.pages
          where deleted_at is null
            and (${kind}::text is null or kind = ${kind})
            and (title_key like ${'%' + key + '%'} or lower(title) like ${'%' + query.toLowerCase() + '%'})
          order by title limit ${lim}
        `;
    return filas.map((r) => ({
      id: r.id, title: r.title, title_key: r.title_key, parent_id: r.parent_id,
      kind: r.kind, rank: 1, match: 'title', headline: r.title,
    }));
  }

  if (mode === 'literal') {
    const like = `%${query}%`;
    const filas = underIds
      ? await q(getPrisma())`
          select p.id, p.title, p.title_key, p.parent_id, p.kind,
                 left(coalesce(v.content, ''), 200) as headline
          from wiki.pages p
          left join wiki.page_versions v on v.id = p.current_version_id
          where p.deleted_at is null
            and p.id in (${Prisma.join(underIds)})
            and (${kind}::text is null or p.kind = ${kind})
            and (p.title ilike ${like} or coalesce(v.content, '') ilike ${like})
          order by p.title limit ${lim}
        `
      : await q(getPrisma())`
          select p.id, p.title, p.title_key, p.parent_id, p.kind,
                 left(coalesce(v.content, ''), 200) as headline
          from wiki.pages p
          left join wiki.page_versions v on v.id = p.current_version_id
          where p.deleted_at is null
            and (${kind}::text is null or p.kind = ${kind})
            and (p.title ilike ${like} or coalesce(v.content, '') ilike ${like})
          order by p.title limit ${lim}
        `;
    return filas.map((r) => ({
      id: r.id, title: r.title, title_key: r.title_key, parent_id: r.parent_id,
      kind: r.kind, rank: 1, match: 'content', headline: r.headline || r.title,
    }));
  }

  // fts — reusa buscar y filtra
  const base = await buscar(query, { limit: lim * 2 });
  let out = base;
  if (kind) {
    const ids = out.map((r) => r.id);
    if (!ids.length) return [];
    const kinds = await q(getPrisma())`
      select id, kind from wiki.pages where id in (${Prisma.join(ids)})
    `;
    const map = new Map(kinds.map((k) => [k.id, k.kind]));
    out = out.filter((r) => map.get(r.id) === kind).map((r) => ({ ...r, kind: kind }));
  }
  if (underIds) {
    const set = new Set(underIds);
    out = out.filter((r) => set.has(r.id));
  }
  return out.slice(0, lim);
}

export async function idsSubarbol(rootId) {
  const filas = await q(getPrisma())`
    with recursive t as (
      select id from wiki.pages where id = ${rootId}::uuid and deleted_at is null
      union all
      select p.id from wiki.pages p join t on p.parent_id = t.id where p.deleted_at is null
    )
    select id from t
  `;
  return filas.map((r) => r.id);
}

export async function grepContenido({ pattern, regex = false, caseSensitive = false, under = null, maxMatches = 50 } = {}) {
  const lim = Math.min(Math.max(Number(maxMatches) || 50, 1), 200);
  let underIds = null;
  if (under) {
    underIds = await idsSubarbol(under);
    if (!underIds.length) return [];
  }

  const filas = underIds
    ? await q(getPrisma())`
        select p.id, p.title, coalesce(v.content, '') as content
        from wiki.pages p
        left join wiki.page_versions v on v.id = p.current_version_id
        where p.deleted_at is null and p.kind = 'page' and p.id in (${Prisma.join(underIds)})
      `
    : await q(getPrisma())`
        select p.id, p.title, coalesce(v.content, '') as content
        from wiki.pages p
        left join wiki.page_versions v on v.id = p.current_version_id
        where p.deleted_at is null and p.kind = 'page'
      `;

  let re;
  try {
    const flags = caseSensitive ? 'g' : 'gi';
    re = regex ? new RegExp(pattern, flags) : new RegExp(escapeReg(pattern), flags);
  } catch {
    throw Object.assign(new Error('regex_invalida'), { code: 'regex_invalida' });
  }

  const matches = [];
  for (const row of filas) {
    const lines = String(row.content || '').split('\n');
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      if (!re.test(lines[i])) continue;
      matches.push({
        page_id: row.id,
        title: row.title,
        line: i + 1,
        text: lines[i].slice(0, 240),
      });
      if (matches.length >= lim) return matches;
    }
  }
  return matches;
}

export async function linksDePagina(pageId, { direction = 'both', includeBroken = false, limit = 100 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const out = { out: [], in: [], broken: [] };

  if (direction === 'out' || direction === 'both') {
    const filas = await q(getPrisma())`
      select pl.target_key, pl.target_page_id, p.title as target_title
      from wiki.page_links pl
      left join wiki.pages p on p.id = pl.target_page_id and p.deleted_at is null
      where pl.source_page_id = ${pageId}::uuid
      order by pl.target_key
      limit ${lim}
    `;
    for (const r of filas) {
      if (r.target_page_id && r.target_title) {
        out.out.push({ target_key: r.target_key, page_id: r.target_page_id, title: r.target_title });
      } else if (includeBroken || !r.target_page_id) {
        out.broken.push({ target_key: r.target_key });
      }
    }
  }

  if (direction === 'in' || direction === 'both') {
    const filas = await q(getPrisma())`
      select pl.source_page_id, pl.target_key, p.title as source_title
      from wiki.page_links pl
      join wiki.pages p on p.id = pl.source_page_id and p.deleted_at is null
      where pl.target_page_id = ${pageId}::uuid
      order by p.title
      limit ${lim}
    `;
    out.in = filas.map((r) => ({
      page_id: r.source_page_id,
      title: r.source_title,
      target_key: r.target_key,
    }));
  }

  return out;
}

export async function graphNeighbors(pageId, { depth = 1, direction = 'both', limit = 50 } = {}) {
  const d = Math.min(Math.max(Number(depth) || 1, 1), 4);
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const filas = await q(getPrisma())`
    select * from wiki.graph_neighbors(${pageId}::uuid, ${d}, ${direction})
    limit ${lim}
  `;
  return filas.map((r) => ({
    page_id: r.page_id,
    title: r.title,
    depth: Number(r.depth),
    via: r.via,
  }));
}

export async function graphShortestPath(fromId, toId, { maxDepth = 6 } = {}) {
  const max = Math.min(Math.max(Number(maxDepth) || 6, 1), 6);
  const [row] = await q(getPrisma())`
    select wiki.graph_shortest_path(${fromId}::uuid, ${toId}::uuid, ${max}, true) as path
  `;
  const path = row?.path || null;
  if (!path || !path.length) return null;
  const pages = await q(getPrisma())`
    select id, title from wiki.pages where id in (${Prisma.join(path)})
  `;
  const map = new Map(pages.map((p) => [p.id, p.title]));
  return path.map((id) => ({ page_id: id, title: map.get(id) || id }));
}

export async function graphRelated(pageId, { limit = 10 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const filas = await q(getPrisma())`
    select * from wiki.graph_related(${pageId}::uuid, ${lim})
  `;
  return filas.map((r) => ({
    page_id: r.page_id,
    title: r.title,
    score: Number(r.score),
  }));
}

export async function enlacesRotos({ limit = 50, under = null } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  let underIds = null;
  if (under) {
    underIds = await idsSubarbol(under);
    if (!underIds.length) return [];
  }
  const filas = underIds
    ? await q(getPrisma())`
        select pl.target_key, count(*)::int as n,
               array_agg(distinct p.title order by p.title) as from_titles
        from wiki.page_links pl
        join wiki.pages p on p.id = pl.source_page_id and p.deleted_at is null
        where pl.target_page_id is null and pl.source_page_id in (${Prisma.join(underIds)})
        group by pl.target_key
        order by n desc, pl.target_key
        limit ${lim}
      `
    : await q(getPrisma())`
        select pl.target_key, count(*)::int as n,
               array_agg(distinct p.title order by p.title) as from_titles
        from wiki.page_links pl
        join wiki.pages p on p.id = pl.source_page_id and p.deleted_at is null
        where pl.target_page_id is null
        group by pl.target_key
        order by n desc, pl.target_key
        limit ${lim}
      `;
  return filas.map((r) => ({
    target_key: r.target_key,
    count: Number(r.n),
    from: (r.from_titles || []).slice(0, 8),
  }));
}

export async function paginasHuerfanas({ limit = 50, includeFiles = false } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const filas = await q(getPrisma())`
    select p.id, p.title, p.kind
    from wiki.pages p
    where p.deleted_at is null
      and p.parent_id is not null
      and (${includeFiles} or p.kind = 'page')
      and not exists (
        select 1 from wiki.page_links l where l.target_page_id = p.id
      )
      and not exists (
        select 1 from wiki.pages c where c.parent_id = p.id and c.deleted_at is null
      )
    order by p.title
    limit ${lim}
  `;
  return filas.map((r) => ({ id: r.id, title: r.title, kind: r.kind }));
}

export async function obtenerVersionPorNumero(pageId, n) {
  const [r] = await q(getPrisma())`
    select * from wiki.page_versions
    where page_id = ${pageId}::uuid and version_number = ${Number(n)}
    limit 1
  `;
  return r ? filaVersion(r) : null;
}

export async function softDeleteCascade(rootId) {
  return begin(async (tx) => {
    const filas = await q(tx)`
      with recursive t as (
        select id, 0 as depth from wiki.pages where id = ${rootId}::uuid and deleted_at is null
        union all
        select p.id, t.depth + 1 from wiki.pages p
        join t on p.parent_id = t.id where p.deleted_at is null
      )
      select id, depth from t order by depth desc
    `;
    if (!filas.length) return { ok: false, count: 0, ids: [] };
    const ids = filas.map((r) => r.id);
    for (const id of ids) {
      await q(tx)`
        update wiki.pages set deleted_at = now(), updated_at = now()
        where id = ${id}::uuid and deleted_at is null
      `;
      await q(tx)`update wiki.page_links set target_page_id = null where target_page_id = ${id}::uuid`;
      await q(tx)`delete from wiki.page_aliases where page_id = ${id}::uuid`;
    }
    return { ok: true, count: ids.length, ids };
  });
}

export async function purgarPagina(pageId) {
  const [row] = await q(getPrisma())`
    select wiki.mcp_purge(${pageId}::uuid) as ok
  `;
  return Boolean(row?.ok);
}

export async function listarArchivos({ under = null, mime = null, limit = 50 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  let underIds = null;
  if (under) {
    underIds = await idsSubarbol(under);
    if (!underIds.length) return [];
  }
  const filas = underIds
    ? await q(getPrisma())`
        select ${PAGE_COLS_P}, a.mime_type, a.size_bytes, a.original_name
        from wiki.pages p
        left join wiki.assets a on a.id = p.asset_id
        where p.deleted_at is null and p.kind = 'file'
          and p.id in (${Prisma.join(underIds)})
          and (${mime}::text is null or a.mime_type = ${mime})
        order by p.title limit ${lim}
      `
    : await q(getPrisma())`
        select ${PAGE_COLS_P}, a.mime_type, a.size_bytes, a.original_name
        from wiki.pages p
        left join wiki.assets a on a.id = p.asset_id
        where p.deleted_at is null and p.kind = 'file'
          and (${mime}::text is null or a.mime_type = ${mime})
        order by p.title limit ${lim}
      `;
  return filas.map(filaArbol);
}

export async function listarAliasesDePagina(pageId = null) {
  if (pageId) {
    const rows = await q(getPrisma())`
      select a.alias_key, a.page_id, p.title
      from wiki.page_aliases a
      join wiki.pages p on p.id = a.page_id
      where a.page_id = ${pageId}::uuid and p.deleted_at is null
      order by a.alias_key
    `;
    return rows.map((r) => ({ alias_key: r.alias_key, page_id: r.page_id, title: r.title }));
  }
  const rows = await q(getPrisma())`
    select a.alias_key, a.page_id, p.title
    from wiki.page_aliases a
    join wiki.pages p on p.id = a.page_id
    where p.deleted_at is null
    order by a.alias_key
    limit 500
  `;
  return rows.map((r) => ({ alias_key: r.alias_key, page_id: r.page_id, title: r.title }));
}

export async function quitarAlias(aliasKey) {
  const key = normalizeTitle(aliasKey);
  const [row] = await q(getPrisma())`
    delete from wiki.page_aliases where alias_key = ${key} returning alias_key, page_id
  `;
  if (row) {
    await q(getPrisma())`
      update wiki.page_links set target_page_id = null
      where target_key = ${key} and target_page_id = ${row.page_id}::uuid
    `;
  }
  return Boolean(row);
}

export async function listarTags({ limit = 100 } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const filas = await q(getPrisma())`
    select tag, count(*)::int as n from (
      select jsonb_array_elements_text(coalesce(metadata->'tags', '[]'::jsonb)) as tag
      from wiki.pages where deleted_at is null
    ) t
    group by tag order by n desc, tag
    limit ${lim}
  `;
  return filas.map((r) => ({ tag: r.tag, count: Number(r.n) }));
}

export async function versionesRecientes({ limit = 20, since = null, author = null } = {}) {
  const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const filas = await q(getPrisma())`
    select v.id, v.page_id, v.version_number, v.title, v.author, v.message, v.source, v.created_at,
           p.title as page_title
    from wiki.page_versions v
    join wiki.pages p on p.id = v.page_id
    where p.deleted_at is null
      and (${since}::timestamptz is null or v.created_at >= ${since}::timestamptz)
      and (${author}::text is null or v.author = ${author})
    order by v.created_at desc
    limit ${lim}
  `;
  return filas.map((r) => ({
    id: r.id,
    page_id: r.page_id,
    page_title: r.page_title,
    version_number: Number(r.version_number),
    title: r.title,
    author: r.author,
    message: r.message,
    source: r.source,
    created_at: iso(r.created_at),
  }));
}

export async function statsWiki() {
  const [c] = await q(getPrisma())`
    select
      (select count(*)::int from wiki.pages where deleted_at is null and kind = 'page') as pages,
      (select count(*)::int from wiki.pages where deleted_at is null and kind = 'file') as files,
      (select count(*)::int from wiki.pages where deleted_at is not null) as trash,
      (select count(*)::int from wiki.page_links where target_page_id is null) as broken_links,
      (select count(*)::int from wiki.page_aliases) as aliases,
      (select count(*)::int from wiki.assets) as assets
  `;
  const hubs = await q(getPrisma())`
    select p.id, p.title, count(*)::int as backlinks
    from wiki.page_links l
    join wiki.pages p on p.id = l.target_page_id and p.deleted_at is null
    group by p.id, p.title
    order by backlinks desc, p.title
    limit 10
  `;
  return {
    pages: Number(c?.pages || 0),
    files: Number(c?.files || 0),
    trash: Number(c?.trash || 0),
    broken_links: Number(c?.broken_links || 0),
    aliases: Number(c?.aliases || 0),
    assets: Number(c?.assets || 0),
    hubs: hubs.map((h) => ({ id: h.id, title: h.title, backlinks: Number(h.backlinks) })),
  };
}

export async function siguientePosicionFraccionaria(parentId, { position = 'end', after = null, before = null } = {}, db) {
  const c = dbOf(db);
  if (position === 'start') {
    const [first] = await q(c)`
      select position from wiki.pages
      where parent_id is not distinct from ${parentId}::uuid and deleted_at is null
      order by position asc limit 1
    `;
    if (!first) return 'a0';
    return positionBetween(null, first.position);
  }
  if (after) {
    const [a] = await q(c)`
      select position from wiki.pages where id = ${after}::uuid and deleted_at is null
    `;
    const [b] = await q(c)`
      select position from wiki.pages
      where parent_id is not distinct from ${parentId}::uuid and deleted_at is null
        and position > ${a?.position || ''}
      order by position asc limit 1
    `;
    return positionBetween(a?.position || null, b?.position || null);
  }
  if (before) {
    const [b] = await q(c)`
      select position from wiki.pages where id = ${before}::uuid and deleted_at is null
    `;
    const [a] = await q(c)`
      select position from wiki.pages
      where parent_id is not distinct from ${parentId}::uuid and deleted_at is null
        and position < ${b?.position || 'zzzz'}
      order by position desc limit 1
    `;
    return positionBetween(a?.position || null, b?.position || null);
  }
  return siguientePosicion(parentId, c);
}
