/**
 * Casos de uso de la app wiki. Las rutas de `api/wiki/*` solo llaman aquí.
 */

import { getSql } from '../../../shared/db.js';
import { ErrorHttp } from '../../../shared/http.js';
import { AUTOR, validarTitulo, validarContenido, validarAsset, normalizarMime, iconoPorMime } from './modelo.js';
import {
  parseFrontmatter,
  serializeFrontmatter,
  rewriteAssetRefsForExport,
  normalizeTitle,
} from './markdown.js';
import * as repo from './repositorio.js';

export async function arbol({ papelera = false } = {}) {
  return repo.listarArbol(getSql(), { papelera });
}

/**
 * Carga inicial del cliente: meta del árbol + contenido de cada página activa.
 * Una sola respuesta para llenar el cache SWR sin N peticiones.
 */
export async function bootstrap() {
  const data = await repo.listarBootstrap(getSql());
  return {
    pages: data.pages,
    contents: data.contents,
    aliases: data.aliases || [],
    bootstrapped_at: new Date().toISOString(),
  };
}

export async function obtener(id) {
  const page = await repo.obtenerPagina(getSql(), id);
  if (!page) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  return page;
}

export async function crear({ title, parentId, icon, content, metadata, source, message }) {
  const v = validarTitulo(title);
  if (!v.ok) throw new ErrorHttp(400, v.error);
  const c = validarContenido(content ?? '');
  if (!c.ok) throw new ErrorHttp(400, c.error);

  const sql = getSql();
  // Los títulos son únicos (como los nombres de nota en un vault): si choca,
  // se añade sufijo " (2)", " (3)"… igual que al importar.
  const unico = await repo.sugerirTituloUnico(sql, v.titulo);

  try {
    return await repo.crearPagina(sql, {
      title: unico.title,
      titleKey: unico.titleKey,
      parentId: parentId || null,
      icon: icon || null,
      metadata: metadata || {},
      content: c.content ?? '',
      author: AUTOR,
      source: source || 'web',
      message: message || null,
    });
  } catch (e) {
    if (e.code === '23505') {
      throw new ErrorHttp(409, 'Ya existe una página con ese título. Intenta con otro.', {
        code: 'title_taken',
      });
    }
    throw e;
  }
}

/**
 * Sube un PDF/HTML/imagen y crea una página hija kind=file bajo parentId.
 */
export async function crearDocumento({
  title,
  parentId,
  mimeType,
  base64,
  originalName,
  note = '',
}) {
  const mime = normalizarMime(mimeType, originalName);
  const buffer = Buffer.from(base64 || '', 'base64');
  const vAsset = validarAsset({ mimeType: mime, buffer });
  if (!vAsset.ok) throw new ErrorHttp(400, vAsset.error);

  const nombre = (originalName || title || 'documento').trim() || 'documento';
  const tituloBase = (title || nombre.replace(/\.[^.]+$/, '') || nombre).trim();
  const v = validarTitulo(tituloBase);
  if (!v.ok) throw new ErrorHttp(400, v.error);

  const sql = getSql();
  const unico = await repo.sugerirTituloUnico(sql, v.titulo);
  const asset = await repo.upsertAsset(sql, {
    buffer,
    mimeType: mime,
    originalName: nombre,
  });

  try {
    return await repo.crearPaginaArchivo(sql, {
      title: unico.title,
      titleKey: unico.titleKey,
      parentId: parentId || null,
      icon: iconoPorMime(mime),
      assetId: asset.id,
      note: note || '',
      author: AUTOR,
      originalName: nombre,
    });
  } catch (e) {
    if (e.code === '23505') {
      throw new ErrorHttp(409, 'Ya existe una página con ese título.', { code: 'title_taken' });
    }
    throw e;
  }
}

/** Reemplaza el binario de una página-documento existente. */
export async function reemplazarDocumento(id, { mimeType, base64, originalName }) {
  const sql = getSql();
  const existente = await repo.obtenerPagina(sql, id);
  if (!existente || existente.deleted_at) {
    throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  }
  if (existente.kind !== 'file') {
    throw new ErrorHttp(400, 'Solo se puede reemplazar el archivo de una página-documento.', {
      code: 'not_a_file_page',
    });
  }

  const mime = normalizarMime(mimeType, originalName);
  const buffer = Buffer.from(base64 || '', 'base64');
  const vAsset = validarAsset({ mimeType: mime, buffer });
  if (!vAsset.ok) throw new ErrorHttp(400, vAsset.error);

  const nombre = (originalName || existente.original_name || 'documento').trim();
  const asset = await repo.upsertAsset(sql, {
    buffer,
    mimeType: mime,
    originalName: nombre,
  });

  try {
    await repo.reemplazarAssetDePagina(sql, id, asset.id, { originalName: nombre });
    return (
      (await repo.actualizarPaginaMeta(sql, id, {
        icon: iconoPorMime(mime),
        author: AUTOR,
      })) || (await repo.obtenerPagina(sql, id))
    );
  } catch (e) {
    if (e.code === 'not_a_file_page') {
      throw new ErrorHttp(400, 'No es una página-documento.', { code: e.code });
    }
    throw e;
  }
}

export async function actualizar(id, body) {
  const sql = getSql();
  const existente = await repo.obtenerPagina(sql, id);
  if (!existente || existente.deleted_at) {
    throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  }

  let titleKey;
  let title = body.title;
  if (title != null) {
    const v = validarTitulo(title);
    if (!v.ok) throw new ErrorHttp(400, v.error);
    title = v.titulo;
    titleKey = v.titleKey;
    const libre = await repo.tituloDisponible(sql, titleKey, id);
    if (!libre) throw new ErrorHttp(409, 'Ya existe una página con ese título.', { code: 'title_taken' });
  }

  let page;
  try {
    page = await repo.actualizarPaginaMeta(sql, id, {
      title,
      titleKey,
      parentId: body.parent_id !== undefined ? body.parent_id : undefined,
      position: body.position,
      icon: body.icon,
      metadata: body.metadata,
      rewriteLinks: body.rewrite_links === true,
      author: AUTOR,
    });
  } catch (e) {
    // El trigger wiki.pages_sin_ciclos y el check pages_parent_distinto cortan
    // los movimientos que desconectarían el subárbol de la raíz (mover una
    // página dentro de su propia subpágina, o hacerla su propia madre).
    if (e.message?.includes('tree_cycle') || e.message?.includes('pages_parent_distinto')) {
      throw new ErrorHttp(409, 'No puedes mover una página dentro de una de sus subpáginas.', {
        code: 'tree_cycle',
      });
    }
    if (e.code === '23503') {
      throw new ErrorHttp(404, 'La página destino no existe.', { code: 'parent_not_found' });
    }
    throw e;
  }
  if (!page) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  return page;
}

export async function eliminar(id) {
  const ok = await repo.softDelete(getSql(), id);
  if (!ok) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  return { ok: true };
}

export async function recuperar(id) {
  const r = await repo.untrash(getSql(), id);
  if (!r.ok) throw new ErrorHttp(400, 'La página no está en la papelera.', { code: r.code });
  return r.page;
}

export async function guardarBorrador(id, body) {
  const c = validarContenido(body.content);
  if (!c.ok) throw new ErrorHttp(400, c.error);
  if (body.title != null) {
    const v = validarTitulo(body.title);
    if (!v.ok) throw new ErrorHttp(400, v.error);
  }
  // Sin revisión no hay control de concurrencia; mejor rechazar que comparar
  // contra NaN y devolver un conflicto que confunde al cliente.
  if (!Number.isInteger(Number(body.draft_revision))) {
    throw new ErrorHttp(400, 'Falta draft_revision.', { code: 'missing_revision' });
  }

  const r = await repo.guardarBorrador(getSql(), id, {
    draftTitle: body.title ?? null,
    draftContent: c.content,
    draftRevision: body.draft_revision,
    baseVersionId: body.base_version_id ?? null,
  });

  if (!r.ok) {
    if (r.code === 'page_not_found') {
      throw new ErrorHttp(404, 'Página no encontrada.', { code: r.code });
    }
    throw new ErrorHttp(409, 'El borrador cambió. Recarga antes de seguir.', {
      code: 'draft_changed',
      draft_revision: r.draft_revision,
      draft_title: r.draft_title,
      draft_content: r.draft_content,
      draft_updated_at: r.draft_updated_at,
    });
  }
  return r;
}

export async function descartarBorrador(id) {
  const r = await repo.descartarBorrador(getSql(), id);
  if (!r) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  return r;
}

export async function guardarVersion(id, body) {
  const c = validarContenido(body.content);
  if (!c.ok) throw new ErrorHttp(400, c.error);
  if (body.title != null) {
    const v = validarTitulo(body.title);
    if (!v.ok) throw new ErrorHttp(400, v.error);
  }

  const r = await repo.guardarVersion(getSql(), {
    pageId: id,
    baseVersionId: body.base_version_id,
    title: body.title ?? null,
    content: c.content,
    message: body.message || null,
    author: AUTOR,
    source: body.source || 'web',
  });

  if (!r.ok) {
    const map = {
      version_conflict: [409, 'Alguien guardó una versión nueva. Recarga o fuerza el guardado.'],
      title_taken: [409, 'Ya existe otra página con ese título.'],
      no_changes: [422, 'No hay cambios para guardar.'],
      nothing_to_save: [422, 'No hay nada que guardar.'],
      page_not_found: [404, 'Página no encontrada.'],
    };
    const [status, msg] = map[r.code] || [400, r.code];
    throw new ErrorHttp(status, msg, { code: r.code, detail: r.detail });
  }
  return r;
}

export async function listarVersiones(id) {
  await obtener(id);
  return repo.listarVersiones(getSql(), id);
}

export async function obtenerVersion(id, vid) {
  const v = await repo.obtenerVersion(getSql(), id, vid);
  if (!v) throw new ErrorHttp(404, 'Versión no encontrada.', { code: 'version_not_found' });
  return v;
}

export async function restaurar(id, vid) {
  const r = await repo.restaurarVersionConOrigen(getSql(), id, vid, AUTOR);
  if (!r.ok) {
    throw new ErrorHttp(
      r.code === 'page_not_found' ? 404 : 404,
      r.code === 'page_not_found' ? 'Página no encontrada.' : 'Versión no encontrada.',
      { code: r.code },
    );
  }
  return r;
}

export async function backlinks(id) {
  await obtener(id);
  return repo.backlinks(getSql(), id);
}

export async function buscar(q, { limit = 50 } = {}) {
  return repo.buscar(getSql(), q, { limit });
}

export async function subirAsset({ buffer, mimeType, originalName }) {
  const v = validarAsset({ mimeType, sizeBytes: buffer.length, buffer });
  if (!v.ok) throw new ErrorHttp(400, v.error);
  return repo.upsertAsset(getSql(), { buffer, mimeType, originalName });
}

export async function servirAsset(id) {
  const asset = await repo.obtenerAsset(getSql(), id, { conContenido: true });
  if (!asset) throw new ErrorHttp(404, 'Archivo no encontrado.', { code: 'asset_not_found' });
  return asset;
}

/**
 * Importa un lote de páginas (el cliente abre el ZIP y manda JSON).
 * items: [{ path, title?, content, parent_path? }]
 * assets: [{ path, mime_type, base64, original_name? }]  (lote de archivos)
 * assetMap: { [rutaEnElZip]: assetId } — archivos subidos en lotes previos. Hace
 *   falta para reescribir `![img](ruta)` → `![img](asset:UUID)` en páginas que
 *   llegan en una petición distinta a la de sus imágenes.
 */
export async function importarLote({
  items = [],
  assets = [],
  assetMap = {},
  resolveLinks = false,
}) {
  const sql = getSql();
  const pathToId = new Map();
  const assetPathToId = new Map(Object.entries(assetMap || {}));
  const created = [];
  const omitted = [];
  const unresolved = [];

  for (const a of assets) {
    try {
      const buf = Buffer.from(a.base64, 'base64');
      const mime = a.mime_type || 'application/octet-stream';
      const v = validarAsset({ mimeType: mime, sizeBytes: buf.length, buffer: buf });
      if (!v.ok) {
        omitted.push({ path: a.path, reason: v.error });
        continue;
      }
      const asset = await repo.upsertAsset(sql, {
        buffer: buf,
        mimeType: mime,
        originalName: a.original_name || a.path?.split('/').pop(),
      });
      assetPathToId.set(a.path, asset.id);
    } catch (e) {
      omitted.push({ path: a.path, reason: e.message });
    }
  }

  for (const item of items) {
    try {
      const raw = item.content || '';
      const { metadata, body } = parseFrontmatter(raw);
      let content = body;

      // Reescribir rutas de imagen locales a asset:UUID
      for (const [p, id] of assetPathToId) {
        const name = p.split('/').pop();
        const patterns = [
          new RegExp(`\\]\\(${escapeReg(p)}\\)`, 'g'),
          new RegExp(`\\]\\(${escapeReg(name)}\\)`, 'g'),
          new RegExp(`\\]\\(assets/${escapeReg(name)}\\)`, 'g'),
        ];
        for (const re of patterns) {
          content = content.replace(re, `](asset:${id})`);
        }
        // ![[image.png]]
        content = content.replace(
          new RegExp(`!\\[\\[${escapeReg(name)}\\]\\]`, 'g'),
          `![](asset:${id})`,
        );
      }

      const baseTitle = item.title || metadata.title || item.path?.replace(/\.md$/i, '').split('/').pop() || 'Sin título';
      const parentId = item.parent_id
        || (item.parent_path ? pathToId.get(item.parent_path) : null)
        || null;

      const unico = await repo.sugerirTituloUnico(sql, baseTitle);
      const page = await repo.crearPagina(sql, {
        title: unico.title,
        titleKey: unico.titleKey,
        parentId,
        metadata,
        content,
        author: AUTOR,
        source: 'import',
        message: 'Importación Obsidian',
      });
      if (item.path) pathToId.set(item.path, page.id);
      created.push({ id: page.id, title: page.title, path: item.path });
    } catch (e) {
      omitted.push({ path: item.path, reason: e.message });
    }
  }

  if (resolveLinks) {
    // Segunda pasada ya ocurre en crearPagina vía resolverEnlacesPendientes;
    // reportar sin resolver:
    const filas = await sql`
      select target_key, count(*)::int as n
      from wiki.page_links where target_page_id is null
      group by target_key order by n desc limit 50
    `;
    for (const f of filas) unresolved.push({ target_key: f.target_key, count: f.n });
  }

  return {
    created: created.length,
    pages: created,
    omitted,
    unresolved,
    asset_map: Object.fromEntries(assetPathToId),
  };
}

function escapeReg(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Exporta el árbol activo a estructura lista para ZIP en el cliente:
 * { files: [{ path, content }], assets: [{ path, mime_type, base64 }] }
 */
export async function exportarTodo() {
  const sql = getSql();
  const pages = await repo.listarArbol(sql, { papelera: false });
  const byId = new Map(pages.map((p) => [p.id, p]));

  function pathFor(page) {
    const parts = [];
    let cur = page;
    const seen = new Set();
    while (cur) {
      if (seen.has(cur.id)) break;
      seen.add(cur.id);
      parts.unshift(sanitizeFileName(cur.title));
      cur = cur.parent_id ? byId.get(cur.parent_id) : null;
    }
    return parts.join('/') + '.md';
  }

  const files = [];
  const assetIds = new Set();
  const idToExportName = new Map();

  for (const p of pages) {
    const full = await repo.obtenerPagina(sql, p.id);
    if (!full?.version) continue;
    let content = full.version.content || '';
    const ids = content.match(/asset:([0-9a-f-]{36})/gi) || [];
    for (const raw of ids) {
      const id = raw.replace(/^asset:/i, '').toLowerCase();
      assetIds.add(id);
    }

    const meta = {
      ...(full.metadata || {}),
      title: full.title,
      id: full.id,
      version: full.version.version_number,
      updated_by: full.version.author,
      updated_at: full.version.created_at,
    };
    files.push({
      path: pathFor(p),
      page_id: p.id,
      content_raw: content,
      metadata: meta,
    });
  }

  const assetsOut = [];
  if (assetIds.size) {
    const rows = await repo.listarAssetsPorIds(sql, [...assetIds]);
    for (const a of rows) {
      const ext = extFromMime(a.mime_type);
      const name = `${a.sha256.slice(0, 12)}${ext}`;
      idToExportName.set(a.id, name);
      assetsOut.push({
        path: `assets/${name}`,
        mime_type: a.mime_type,
        base64: Buffer.from(a.content).toString('base64'),
      });
    }
  }

  const outFiles = files.map((f) => ({
    path: f.path,
    content: serializeFrontmatter(
      f.metadata,
      rewriteAssetRefsForExport(f.content_raw, idToExportName),
    ),
  }));

  return { files: outFiles, assets: assetsOut };
}

function sanitizeFileName(title) {
  return String(title || 'sin-titulo')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'sin-titulo';
}

function extFromMime(mime) {
  const map = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
  };
  return map[mime] || '.bin';
}

export { normalizeTitle };
