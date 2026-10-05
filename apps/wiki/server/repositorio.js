/**
 * Acceso a datos del schema `wiki`.
 */

import { createHash } from 'node:crypto';
import { normalizeTitle, extractWikilinks, extractAssetIds, positionBetween } from './markdown.js';

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

export async function listarArbol(sql, { papelera = false } = {}) {
  const filas = papelera
    ? await sql`
        select p.id, p.parent_id, p.position, p.title, p.title_key, p.icon,
               p.kind, p.asset_id, p.draft_title, p.draft_content,
               p.updated_at, p.deleted_at,
               a.mime_type, a.size_bytes, a.original_name
        from wiki.pages p
        left join wiki.assets a on a.id = p.asset_id
        where p.deleted_at is not null
        order by p.deleted_at desc
      `
    : await sql`
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

export async function obtenerPagina(sql, id) {
  const [r] = await sql`
    select p.*, a.mime_type, a.size_bytes, a.original_name
    from wiki.pages p
    left join wiki.assets a on a.id = p.asset_id
    where p.id = ${id}
  `;
  if (!r) return null;
  let version = null;
  if (r.current_version_id) {
    const [v] = await sql`
      select * from wiki.page_versions where id = ${r.current_version_id}
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
export async function listarBootstrap(sql) {
  const filas = await sql`
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
  return { pages, contents };
}

export async function siguientePosicion(sql, parentId) {
  const [row] = parentId
    ? await sql`
        select position from wiki.pages
        where parent_id = ${parentId} and deleted_at is null
        order by position desc limit 1
      `
    : await sql`
        select position from wiki.pages
        where parent_id is null and deleted_at is null
        order by position desc limit 1
      `;
  return positionBetween(row?.position || null, null);
}

export async function crearPagina(sql, {
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
  return sql.begin(async (tx) => {
    const position = await siguientePosicion(tx, parentId);
    const hash = createHash('sha256').update(content || '').digest('hex');

    const [page] = await tx`
      insert into wiki.pages (parent_id, position, title, title_key, icon, metadata)
      values (
        ${parentId}, ${position}, ${title}, ${titleKey},
        ${icon}, ${tx.json(metadata || {})}
      )
      returning *
    `;

    const [version] = await tx`
      insert into wiki.page_versions
        (page_id, version_number, title, content, content_hash, author, message, source)
      values (
        ${page.id}, 1, ${title}, ${content || ''}, ${hash},
        ${author}, ${message}, ${source}
      )
      returning *
    `;

    await tx`
      update wiki.pages set
        current_version_id = ${version.id},
        search = to_tsvector(
          'spanish',
          extensions.unaccent(${title + ' ' + (content || '').slice(0, 500000)})
        ),
        updated_at = now()
      where id = ${page.id}
    `;

    await sincronizarEnlaces(tx, page.id, content || '');
    await sincronizarAssetsVersion(tx, version.id, content || '');
    await resolverEnlacesPendientes(tx, titleKey, page.id);

    const actualizada = await obtenerPagina(tx, page.id);
    return actualizada;
  });
}

/**
 * Crea una página kind=file ligada a un asset ya upsertado.
 * content = nota opcional (Markdown corto); el binario vive en assets.
 */
export async function crearPaginaArchivo(sql, {
  title,
  titleKey,
  parentId = null,
  icon = null,
  assetId,
  note = '',
  author = 'TuBroki',
  originalName = null,
}) {
  return sql.begin(async (tx) => {
    const position = await siguientePosicion(tx, parentId);
    const content = note || '';
    const hash = createHash('sha256').update(content).digest('hex');
    const searchText = `${title} ${originalName || ''} ${content}`.trim();

    const [page] = await tx`
      insert into wiki.pages
        (parent_id, position, title, title_key, icon, metadata, kind, asset_id)
      values (
        ${parentId}, ${position}, ${title}, ${titleKey},
        ${icon}, ${tx.json({})}, 'file', ${assetId}
      )
      returning *
    `;

    const [version] = await tx`
      insert into wiki.page_versions
        (page_id, version_number, title, content, content_hash, author, message, source)
      values (
        ${page.id}, 1, ${title}, ${content}, ${hash},
        ${author}, ${'Documento subido'}, 'web'
      )
      returning *
    `;

    await tx`
      update wiki.pages set
        current_version_id = ${version.id},
        search = to_tsvector('spanish', extensions.unaccent(${searchText.slice(0, 500000)})),
        updated_at = now()
      where id = ${page.id}
    `;

    await resolverEnlacesPendientes(tx, titleKey, page.id);
    return obtenerPagina(tx, page.id);
  });
}

/** Cambia el asset de una página kind=file (reemplazar archivo). */
export async function reemplazarAssetDePagina(sql, pageId, assetId, { originalName = null } = {}) {
  return sql.begin(async (tx) => {
    const [page] = await tx`
      select * from wiki.pages where id = ${pageId} and deleted_at is null for update
    `;
    if (!page) return null;
    if (page.kind !== 'file') {
      const err = new Error('not_a_file_page');
      err.code = 'not_a_file_page';
      throw err;
    }

    await tx`
      update wiki.pages set
        asset_id = ${assetId},
        search = to_tsvector(
          'spanish',
          extensions.unaccent(${`${page.title} ${originalName || ''}`.slice(0, 500000)})
        ),
        updated_at = now()
      where id = ${pageId}
    `;
    return obtenerPagina(tx, pageId);
  });
}

export async function actualizarPaginaMeta(sql, id, {
  title,
  titleKey,
  parentId,
  position,
  icon,
  metadata,
  rewriteLinks = false,
  author = 'TuBroki',
}) {
  return sql.begin(async (tx) => {
    const [prev] = await tx`select * from wiki.pages where id = ${id} and deleted_at is null for update`;
    if (!prev) return null;

    const nuevoTitulo = title != null ? title : prev.title;
    const nuevaKey = titleKey != null ? titleKey : prev.title_key;
    const nuevoParent = parentId !== undefined ? parentId : prev.parent_id;
    const nuevaPos = position != null ? position : prev.position;
    const nuevoIcon = icon !== undefined ? icon : prev.icon;
    const nuevoMeta = metadata != null ? metadata : prev.metadata;

    await tx`
      update wiki.pages set
        title = ${nuevoTitulo},
        title_key = ${nuevaKey},
        parent_id = ${nuevoParent},
        position = ${nuevaPos},
        icon = ${nuevoIcon},
        metadata = ${tx.json(nuevoMeta || {})},
        updated_at = now()
      where id = ${id}
    `;

    if (rewriteLinks && prev.title_key !== nuevaKey) {
      await reescribirBacklinks(tx, prev.title_key, nuevaKey, prev.title, nuevoTitulo, author);
    } else if (prev.title_key !== nuevaKey) {
      await resolverEnlacesPendientes(tx, nuevaKey, id);
      await tx`
        update wiki.page_links set target_page_id = null
        where target_page_id = ${id} and target_key <> ${nuevaKey}
      `;
      await tx`
        update wiki.page_links set target_page_id = ${id}
        where target_key = ${nuevaKey}
      `;
    }

    return obtenerPagina(tx, id);
  });
}

export async function guardarBorrador(sql, id, {
  draftTitle,
  draftContent,
  draftRevision,
  baseVersionId,
}) {
  return sql.begin(async (tx) => {
    const [page] = await tx`
      select * from wiki.pages where id = ${id} and deleted_at is null for update
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

    const [upd] = await tx`
      update wiki.pages set
        draft_title = ${draftTitle ?? page.draft_title},
        draft_content = ${draftContent ?? page.draft_content},
        draft_base_version_id = ${baseVersionId ?? page.current_version_id},
        draft_revision = draft_revision + 1,
        draft_updated_at = now(),
        updated_at = now()
      where id = ${id}
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

export async function descartarBorrador(sql, id) {
  const [page] = await sql`
    update wiki.pages set
      draft_title = null,
      draft_content = null,
      draft_base_version_id = null,
      draft_updated_at = null,
      draft_revision = draft_revision + 1,
      updated_at = now()
    where id = ${id} and deleted_at is null
    returning draft_revision
  `;
  if (!page) return null;
  return { ok: true, draft_revision: Number(page.draft_revision) };
}

export async function guardarVersion(sql, {
  pageId,
  baseVersionId,
  title,
  content,
  message,
  author = 'TuBroki',
  source = 'web',
}) {
  try {
    const [version] = await sql`
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
    await sincronizarEnlaces(sql, pageId, version.content);
    await sincronizarAssetsVersion(sql, version.id, version.content);
    const page = await obtenerPagina(sql, pageId);
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

export async function listarVersiones(sql, pageId) {
  const filas = await sql`
    select id, page_id, version_number, title, content_hash, author, message,
           source, restored_from, created_at
    from wiki.page_versions
    where page_id = ${pageId}
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

export async function obtenerVersion(sql, pageId, versionId) {
  const [r] = await sql`
    select * from wiki.page_versions
    where id = ${versionId} and page_id = ${pageId}
  `;
  return r ? filaVersion(r) : null;
}

/**
 * Restaura creando una versión nueva con `restored_from` apuntando a la original.
 * No se actualiza ni se borra nada: las versiones son inmutables.
 */
export async function restaurarVersionConOrigen(sql, pageId, versionId, author = 'TuBroki') {
  return sql.begin(async (tx) => {
    const [page] = await tx`
      select * from wiki.pages where id = ${pageId} and deleted_at is null for update
    `;
    if (!page) return { ok: false, code: 'page_not_found' };

    const [vieja] = await tx`
      select * from wiki.page_versions where id = ${versionId} and page_id = ${pageId}
    `;
    if (!vieja) return { ok: false, code: 'version_not_found' };

    const hash = createHash('sha256').update(vieja.content).digest('hex');
    const [version] = await tx`
      insert into wiki.page_versions
        (page_id, version_number, title, content, content_hash, author, message, source, restored_from)
      values (
        ${pageId},
        coalesce((select max(version_number) from wiki.page_versions where page_id = ${pageId}), 0) + 1,
        ${vieja.title}, ${vieja.content}, ${hash}, ${author},
        ${`Restaurada desde v${vieja.version_number}`}, 'web'::wiki.version_source, ${vieja.id}
      )
      returning *
    `;

    await tx`
      update wiki.pages set
        title = ${vieja.title},
        title_key = wiki.normalize_title(${vieja.title}),
        current_version_id = ${version.id},
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
      where id = ${pageId}
    `;

    await sincronizarEnlaces(tx, pageId, vieja.content);
    await sincronizarAssetsVersion(tx, version.id, vieja.content);

    return {
      ok: true,
      version: filaVersion(version),
      page: await obtenerPagina(tx, pageId),
    };
  });
}

export async function softDelete(sql, id) {
  return sql.begin(async (tx) => {
    const [r] = await tx`
      update wiki.pages set deleted_at = now(), updated_at = now()
      where id = ${id} and deleted_at is null
      returning id
    `;
    if (!r) return false;
    // Las páginas en papelera no deben seguir resolviendo enlaces entrantes:
    // quedan "sin resolver" hasta que se recuperen.
    await tx`
      update wiki.page_links set target_page_id = null where target_page_id = ${id}
    `;
    // Los hijos suben al abuelo para no quedar colgando de una página borrada.
    await tx`
      update wiki.pages set parent_id = (
        select parent_id from wiki.pages where id = ${id}
      )
      where parent_id = ${id} and deleted_at is null
    `;
    return true;
  });
}

export async function untrash(sql, id) {
  const [page] = await sql`select * from wiki.pages where id = ${id}`;
  if (!page || !page.deleted_at) return { ok: false, code: 'not_in_trash' };

  // Resolver conflicto de título
  let titleKey = page.title_key;
  let title = page.title;
  const [dup] = await sql`
    select id from wiki.pages
    where title_key = ${titleKey} and deleted_at is null and id <> ${id}
  `;
  if (dup) {
    title = `${page.title} (recuperada)`;
    titleKey = normalizeTitle(title);
  }

  await sql`
    update wiki.pages set
      deleted_at = null,
      title = ${title},
      title_key = ${titleKey},
      updated_at = now()
    where id = ${id}
  `;
  await resolverEnlacesPendientes(sql, titleKey, id);
  return { ok: true, page: await obtenerPagina(sql, id) };
}

export async function backlinks(sql, pageId) {
  const filas = await sql`
    select pl.source_page_id, pl.target_key,
           p.title as source_title, p.title_key as source_title_key,
           v.content
    from wiki.page_links pl
    join wiki.pages p on p.id = pl.source_page_id and p.deleted_at is null
    left join wiki.page_versions v on v.id = p.current_version_id
    where pl.target_page_id = ${pageId}
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

export async function buscar(sql, q, { limit = 50 } = {}) {
  const query = String(q || '').trim();
  if (!query) return [];

  // Marcadores propios (no HTML) para que el cliente escape y luego resalte seguro.
  const headlineOpts =
    'StartSel=<<, StopSel=>>, MaxWords=18, MinWords=8, MaxFragments=2, FragmentDelimiter= … ';

  const filas = await sql`
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

export async function upsertAsset(sql, { buffer, mimeType, originalName }) {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const [existente] = await sql`
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
  const [row] = await sql`
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

export async function obtenerAsset(sql, id, { conContenido = false } = {}) {
  if (conContenido) {
    const [r] = await sql`
      select id, sha256, mime_type, size_bytes, original_name, content, created_at
      from wiki.assets where id = ${id}
    `;
    return r || null;
  }
  const [r] = await sql`
    select id, sha256, mime_type, size_bytes, original_name, created_at
    from wiki.assets where id = ${id}
  `;
  return r || null;
}

export async function listarAssetsPorIds(sql, ids) {
  if (!ids.length) return [];
  return sql`
    select id, sha256, mime_type, size_bytes, original_name, content
    from wiki.assets where id in ${sql(ids)}
  `;
}

async function sincronizarEnlaces(sql, sourcePageId, content) {
  const keys = extractWikilinks(content);
  await sql`delete from wiki.page_links where source_page_id = ${sourcePageId}`;
  for (const key of keys) {
    const [target] = await sql`
      select id from wiki.pages where title_key = ${key} and deleted_at is null limit 1
    `;
    await sql`
      insert into wiki.page_links (source_page_id, target_key, target_page_id)
      values (${sourcePageId}, ${key}, ${target?.id || null})
      on conflict (source_page_id, target_key) do update
        set target_page_id = excluded.target_page_id
    `;
  }
}

async function sincronizarAssetsVersion(sql, versionId, content) {
  const ids = extractAssetIds(content);
  await sql`delete from wiki.version_assets where version_id = ${versionId}`;
  for (const assetId of ids) {
    const [a] = await sql`select id from wiki.assets where id = ${assetId}`;
    if (!a) continue;
    await sql`
      insert into wiki.version_assets (version_id, asset_id)
      values (${versionId}, ${assetId})
      on conflict do nothing
    `;
  }
}

async function resolverEnlacesPendientes(sql, titleKey, pageId) {
  await sql`
    update wiki.page_links set target_page_id = ${pageId}
    where target_key = ${titleKey} and (target_page_id is null or target_page_id <> ${pageId})
  `;
}

async function reescribirBacklinks(sql, oldKey, newKey, oldTitle, newTitle, author) {
  const fuentes = await sql`
    select distinct source_page_id from wiki.page_links
    where target_key = ${oldKey} or target_page_id in (
      select id from wiki.pages where title_key = ${oldKey}
    )
  `;

  for (const f of fuentes) {
    const page = await obtenerPagina(sql, f.source_page_id);
    if (!page?.version) continue;
    const content = page.version.content || '';
    // Reescribir [[Old]] y [[Old|alias]]
    const re = new RegExp(`\\[\\[${escapeReg(oldTitle)}(\\|[^\\]]*)?\\]\\]`, 'gi');
    const nuevo = content.replace(re, (_, alias) => `[[${newTitle}${alias || ''}]]`);
    if (nuevo === content) continue;

    await guardarVersion(sql, {
      pageId: page.id,
      baseVersionId: page.current_version_id,
      title: page.title,
      content: nuevo,
      message: 'Enlace actualizado por renombrado',
      author,
      source: 'system',
    });
  }

  await resolverEnlacesPendientes(sql, newKey, (
    await sql`select id from wiki.pages where title_key = ${newKey} and deleted_at is null limit 1`
  )[0]?.id);
}

export async function tituloDisponible(sql, titleKey, exceptId = null) {
  const [row] = exceptId
    ? await sql`
        select id from wiki.pages
        where title_key = ${titleKey} and deleted_at is null and id <> ${exceptId}
        limit 1
      `
    : await sql`
        select id from wiki.pages
        where title_key = ${titleKey} and deleted_at is null
        limit 1
      `;
  return !row;
}

export async function sugerirTituloUnico(sql, baseTitle) {
  let title = String(baseTitle || 'Sin título').trim() || 'Sin título';
  let key = normalizeTitle(title);
  let n = 2;
  while (!(await tituloDisponible(sql, key))) {
    title = `${baseTitle} (${n})`;
    key = normalizeTitle(title);
    n += 1;
    if (n > 200) break;
  }
  return { title, titleKey: key };
}

export { sincronizarEnlaces, filaVersion };
