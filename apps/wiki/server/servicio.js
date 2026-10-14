/**
 * Casos de uso de la app wiki. Las rutas de `api/wiki/*` solo llaman aquí.
 */

import { Prisma } from '@prisma/client';
import { ErrorHttp } from '../../../shared/http.js';
import { getPrisma } from '../../../shared/prisma.js';
import { AUTOR, validarTitulo, validarContenido, validarAsset, normalizarMime, iconoPorMime } from './modelo.js';
import {
  parseFrontmatter,
  serializeFrontmatter,
  rewriteAssetRefsForExport,
  normalizeTitle,
} from './markdown.js';
import * as repo from './repositorio.js';

export async function arbol({ papelera = false } = {}) {
  return repo.listarArbol({ papelera });
}

/**
 * Carga inicial del cliente: meta del árbol + contenido de cada página activa.
 * Una sola respuesta para llenar el cache SWR sin N peticiones.
 */
export async function bootstrap() {
  const data = await repo.listarBootstrap();
  return {
    pages: data.pages,
    contents: data.contents,
    aliases: data.aliases || [],
    bootstrapped_at: new Date().toISOString(),
  };
}

export async function obtener(id) {
  const page = await repo.obtenerPagina(id);
  if (!page) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  return page;
}

export async function crear({ title, parentId, icon, content, metadata, source, message }) {
  const v = validarTitulo(title);
  if (!v.ok) throw new ErrorHttp(400, v.error);
  const c = validarContenido(content ?? '');
  if (!c.ok) throw new ErrorHttp(400, c.error);
  // Los títulos son únicos (como los nombres de nota en un vault): si choca,
  // se añade sufijo " (2)", " (3)"… igual que al importar.
  const unico = await repo.sugerirTituloUnico(v.titulo);

  try {
    return await repo.crearPagina({
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
  const unico = await repo.sugerirTituloUnico(v.titulo);
  const asset = await repo.upsertAsset({
    buffer,
    mimeType: mime,
    originalName: nombre,
  });

  try {
    return await repo.crearPaginaArchivo({
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
  const existente = await repo.obtenerPagina(id);
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
  const asset = await repo.upsertAsset({
    buffer,
    mimeType: mime,
    originalName: nombre,
  });

  try {
    await repo.reemplazarAssetDePagina(id, asset.id, { originalName: nombre });
    return (
      (await repo.actualizarPaginaMeta(id, {
        icon: iconoPorMime(mime),
        author: AUTOR,
      })) || (await repo.obtenerPagina(id))
    );
  } catch (e) {
    if (e.code === 'not_a_file_page') {
      throw new ErrorHttp(400, 'No es una página-documento.', { code: e.code });
    }
    throw e;
  }
}

export async function actualizar(id, body) {
  const existente = await repo.obtenerPagina(id);
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
    const libre = await repo.tituloDisponible(titleKey, id);
    if (!libre) throw new ErrorHttp(409, 'Ya existe una página con ese título.', { code: 'title_taken' });
  }

  let page;
  try {
    page = await repo.actualizarPaginaMeta(id, {
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
  const ok = await repo.softDelete(id);
  if (!ok) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  return { ok: true };
}

export async function recuperar(id) {
  const r = await repo.untrash(id);
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

  const r = await repo.guardarBorrador(id, {
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
  const r = await repo.descartarBorrador(id);
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

  const r = await repo.guardarVersion({
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
  return repo.listarVersiones(id);
}

export async function obtenerVersion(id, vid) {
  const v = await repo.obtenerVersion(id, vid);
  if (!v) throw new ErrorHttp(404, 'Versión no encontrada.', { code: 'version_not_found' });
  return v;
}

export async function restaurar(id, vid) {
  const r = await repo.restaurarVersionConOrigen(id, vid, AUTOR);
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
  return repo.backlinks(id);
}

export async function buscar(q, { limit = 50 } = {}) {
  return repo.buscar(q, { limit });
}

export async function subirAsset({ buffer, mimeType, originalName }) {
  const v = validarAsset({ mimeType, sizeBytes: buffer.length, buffer });
  if (!v.ok) throw new ErrorHttp(400, v.error);
  return repo.upsertAsset({ buffer, mimeType, originalName });
}

export async function servirAsset(id) {
  const asset = await repo.obtenerAsset(id, { conContenido: true });
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
      const asset = await repo.upsertAsset({
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

      const unico = await repo.sugerirTituloUnico(baseTitle);
      const page = await repo.crearPagina({
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
    const filas = await getPrisma().$queryRaw(Prisma.sql`
      select target_key, count(*)::int as n
      from wiki.page_links where target_page_id is null
      group by target_key order by n desc limit 50
    `);
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
  const pages = await repo.listarArbol({ papelera: false });
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
    const full = await repo.obtenerPagina(p.id);
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
    const rows = await repo.listarAssetsPorIds([...assetIds]);
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

/* ─── MCP: resolve / search / grafo / writes / files / meta ─── */

const MCP_BASE64_MAX = 3 * 1024 * 1024;
const UUID_RE_S = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function autorMcp(ctx) {
  return ctx?.author || AUTOR;
}

export async function resolverRef(ref, { includeDeleted = false } = {}) {
  return repo.resolvePageMeta(ref, { includeDeleted });
}

export async function resolverRefs(refs = []) {
  const out = [];
  for (const ref of refs) {
    const hit = await repo.resolvePageMeta(ref);
    if (hit) {
      out.push({ ref, ok: true, ...hit });
    } else {
      const suggestions = await repo.sugerirTitulos(ref, { limit: 5 });
      out.push({ ref, ok: false, suggestions });
    }
  }
  return out;
}

export async function obtenerPorRef(ref, opts = {}) {
  const meta = await repo.resolvePageMeta(ref, opts);
  if (!meta) throw new ErrorHttp(404, `No encontré la página "${ref}".`, { code: 'page_not_found' });
  return obtener(meta.id);
}

export async function buscarAvanzado(opts) {
  return repo.buscarAvanzado(opts.q, opts);
}

export async function grep(opts) {
  try {
    return await repo.grepContenido(opts);
  } catch (e) {
    if (e.code === 'regex_invalida') {
      throw new ErrorHttp(400, 'Expresión regular inválida.', { code: 'regex_invalida' });
    }
    throw e;
  }
}

export async function linksDe(pageId, opts) {
  await obtener(pageId);
  return repo.linksDePagina(pageId, opts);
}

export async function vecinos(pageId, opts) {
  await obtener(pageId);
  return repo.graphNeighbors(pageId, opts);
}

export async function caminoCorto(fromId, toId, opts) {
  await obtener(fromId);
  await obtener(toId);
  return repo.graphShortestPath(fromId, toId, opts);
}

export async function relacionadas(pageId, opts) {
  await obtener(pageId);
  return repo.graphRelated(pageId, opts);
}

export async function enlacesRotos(opts) {
  return repo.enlacesRotos(opts);
}

export async function huerfanas(opts) {
  return repo.paginasHuerfanas(opts);
}

export async function crearPaginaMcp(input, tokenCtx) {
  const ifExists = input.if_exists || 'suffix';
  const v = validarTitulo(input.title);
  if (!v.ok) throw new ErrorHttp(400, v.error, { code: 'validacion' });
  const existing = await repo.resolvePageMeta(v.titulo);
  if (existing) {
    if (ifExists === 'error') {
      throw new ErrorHttp(409, `Ya existe la página "${existing.title}".`, {
        code: 'page_exists',
        id: existing.id,
        title: existing.title,
      });
    }
    if (ifExists === 'return') {
      return { ...(await obtener(existing.id)), existed: true };
    }
  }

  let parentId = input.parent_id || null;
  if (input.parent) {
    const p = await repo.resolvePageMeta(input.parent);
    if (!p) throw new ErrorHttp(404, `Padre no encontrado: "${input.parent}".`, { code: 'parent_not_found' });
    parentId = p.id;
  }

  const c = validarContenido(input.content ?? '');
  if (!c.ok) throw new ErrorHttp(400, c.error, { code: 'validacion' });

  const unico =
    ifExists === 'suffix' || !existing
      ? await repo.sugerirTituloUnico(v.titulo)
      : { title: v.titulo, titleKey: v.titleKey };

  try {
    const page = await repo.crearPagina({
      title: unico.title,
      titleKey: unico.titleKey,
      parentId,
      icon: input.icon || null,
      metadata: input.metadata || {},
      content: c.content ?? '',
      author: autorMcp(tokenCtx),
      source: 'mcp',
      message: input.message || 'Creada vía MCP',
    });
    return { ...page, existed: false };
  } catch (e) {
    if (e.code === '23505') {
      throw new ErrorHttp(409, 'Ya existe una página con ese título.', { code: 'title_taken' });
    }
    throw e;
  }
}

export async function guardarVersionMcp(id, body, tokenCtx) {
  const page = await obtener(id);
  if (page.draft_content != null && !body.discard_draft) {
    throw new ErrorHttp(409, 'Hay un borrador humano sin publicar. Pasa discard_draft:true para sobrescribir.', {
      code: 'draft_exists',
      draft_revision: page.draft_revision,
    });
  }
  if (body.discard_draft) {
    await repo.descartarBorrador(id);
  }

  let baseVersionId = body.base_version_id || page.current_version_id;
  if (body.expected_version != null) {
    const n = Number(body.expected_version);
    const ver = await repo.obtenerVersionPorNumero(id, n);
    if (!ver) {
      throw new ErrorHttp(409, `La versión esperada v${n} no existe.`, { code: 'version_conflict' });
    }
    if (page.current_version_id && ver.id !== page.current_version_id) {
      throw new ErrorHttp(409, `Se esperaba v${n} pero la actual es otra.`, {
        code: 'version_conflict',
        current_version_id: page.current_version_id,
      });
    }
    baseVersionId = ver.id;
  }

  const c = validarContenido(body.content);
  if (!c.ok) throw new ErrorHttp(400, c.error, { code: 'validacion' });
  if (body.title != null) {
    const v = validarTitulo(body.title);
    if (!v.ok) throw new ErrorHttp(400, v.error, { code: 'validacion' });
  }

  const r = await repo.guardarVersion({
    pageId: id,
    baseVersionId,
    title: body.title ?? null,
    content: c.content,
    message: body.message || null,
    author: autorMcp(tokenCtx),
    source: 'mcp',
  });

  if (!r.ok) {
    if (r.code === 'no_changes') {
      return { ok: true, no_changes: true, page, version: page.version };
    }
    const map = {
      version_conflict: [409, 'Conflicto de versión. Recarga o fuerza el guardado.'],
      title_taken: [409, 'Ya existe otra página con ese título.'],
      nothing_to_save: [422, 'No hay nada que guardar.'],
      page_not_found: [404, 'Página no encontrada.'],
    };
    const [status, msg] = map[r.code] || [400, r.code];
    throw new ErrorHttp(status, msg, { code: r.code, detail: r.detail });
  }
  return r;
}

export async function renombrarMcp(id, { newTitle, rewriteLinks = true, keepAlias = true }, tokenCtx) {
  const page = await obtener(id);
  const v = validarTitulo(newTitle);
  if (!v.ok) throw new ErrorHttp(400, v.error, { code: 'validacion' });
  const oldTitle = page.title;
  const oldKey = page.title_key;

  const updated = await actualizar(id, {
    title: v.titulo,
    rewrite_links: rewriteLinks,
  });

  // actualizar usa AUTOR; re-touch author via meta if needed — keepAlias
  if (keepAlias && oldKey && oldKey !== v.titleKey) {
    await repo.upsertAlias(oldTitle, id);
  }

  // Force source tracking is on versions; rename is meta-only.
  void tokenCtx;
  return { ...updated, previous_title: oldTitle };
}

export async function moverMcp(id, { newParent, position = 'end' }, tokenCtx) {
  await obtener(id);
  let parentId = null;
  if (newParent != null && newParent !== '' && newParent !== '/') {
    const p = await repo.resolvePageMeta(newParent);
    if (!p) throw new ErrorHttp(404, `Padre no encontrado: "${newParent}".`, { code: 'parent_not_found' });
    parentId = p.id;
  }

  let pos = undefined;
  if (typeof position === 'string') {
    if (position === 'start' || position === 'end') {
      pos = await repo.siguientePosicionFraccionaria(parentId, { position });
    }
  } else if (position && typeof position === 'object') {
    pos = await repo.siguientePosicionFraccionaria(parentId, {
      after: position.after ? (await repo.resolvePageMeta(position.after))?.id : null,
      before: position.before ? (await repo.resolvePageMeta(position.before))?.id : null,
    });
  }

  void tokenCtx;
  return actualizar(id, { parent_id: parentId, position: pos });
}

export async function eliminarCascada(id, { confirm = false } = {}) {
  await obtener(id);
  const ids = await repo.idsSubarbol(id);
  if (ids.length > 1 && !confirm) {
    throw new ErrorHttp(400, `Se borrarían ${ids.length} páginas (cascada). Confirma con confirm:true.`, {
      code: 'confirm_required',
      count: ids.length,
    });
  }
  if (ids.length <= 1) {
    await eliminar(id);
    return { ok: true, count: 1, ids: [id] };
  }
  return repo.softDeleteCascade(id);
}

export async function purgar(id, { confirm = false, purgeOrphanAssets = false } = {}) {
  const page = await repo.obtenerPagina(id);
  if (!page) throw new ErrorHttp(404, 'Página no encontrada.', { code: 'page_not_found' });
  if (!page.deleted_at) {
    throw new ErrorHttp(400, 'Solo se puede purgar desde la papelera. Borra primero.', { code: 'not_in_trash' });
  }
  if (!confirm) {
    throw new ErrorHttp(400, 'Purga permanente: confirma con confirm:true.', { code: 'confirm_required' });
  }
  const ok = await repo.purgarPagina(id);
  if (!ok) throw new ErrorHttp(400, 'No se pudo purgar.', { code: 'not_in_trash' });
  void purgeOrphanAssets;
  return { ok: true };
}

export async function obtenerVersionPorNumero(pageId, n) {
  await obtener(pageId);
  const v = await repo.obtenerVersionPorNumero(pageId, n);
  if (!v) throw new ErrorHttp(404, 'Versión no encontrada.', { code: 'version_not_found' });
  return v;
}

export async function restaurarVersionMcp(id, vidOrNum, tokenCtx, { discard_draft = false } = {}) {
  const page = await obtener(id);
  if (page.draft_content != null && !discard_draft) {
    throw new ErrorHttp(409, 'Hay un borrador humano. Pasa discard_draft:true para continuar.', {
      code: 'draft_exists',
    });
  }
  if (discard_draft) await repo.descartarBorrador(id);

  let versionId = vidOrNum;
  if (!UUID_RE_S.test(String(vidOrNum))) {
    const v = await repo.obtenerVersionPorNumero(id, Number(vidOrNum));
    if (!v) throw new ErrorHttp(404, 'Versión no encontrada.', { code: 'version_not_found' });
    versionId = v.id;
  }

  const r = await repo.restaurarVersionConOrigen(id, versionId, autorMcp(tokenCtx));
  if (!r.ok) {
    throw new ErrorHttp(404, r.code === 'page_not_found' ? 'Página no encontrada.' : 'Versión no encontrada.', {
      code: r.code,
    });
  }
  return r;
}

function esIpPrivada(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

export async function subirDesdeUrl({ url, filename, parentId, parent, title, note }, tokenCtx) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ErrorHttp(400, 'URL inválida.', { code: 'url_no_permitida' });
  }
  if (parsed.protocol !== 'https:') {
    throw new ErrorHttp(400, 'Solo se permiten URLs https.', { code: 'url_no_permitida' });
  }
  if (esIpPrivada(parsed.hostname)) {
    throw new ErrorHttp(400, 'URL no permitida (host privado).', { code: 'url_no_permitida' });
  }

  let pid = parentId || null;
  if (parent) {
    const p = await repo.resolvePageMeta(parent);
    if (!p) throw new ErrorHttp(404, `Padre no encontrado: "${parent}".`, { code: 'parent_not_found' });
    pid = p.id;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  let res;
  try {
    res = await fetch(parsed.href, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'TuBroki-Wiki-MCP/1.0' },
    });
  } catch (e) {
    throw new ErrorHttp(400, `No se pudo descargar: ${e.message}`, { code: 'url_no_permitida' });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ErrorHttp(400, `HTTP ${res.status} al descargar.`, { code: 'url_no_permitida' });

  const finalUrl = new URL(res.url);
  if (finalUrl.protocol !== 'https:' || esIpPrivada(finalUrl.hostname)) {
    throw new ErrorHttp(400, 'Redirect a host no permitido.', { code: 'url_no_permitida' });
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 20 * 1024 * 1024) {
    throw new ErrorHttp(400, 'El archivo supera 20 MB.', { code: 'payload_grande' });
  }

  const mimeType = (res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
  const name =
    filename ||
    decodeURIComponent(finalUrl.pathname.split('/').pop() || '') ||
    title ||
    'archivo';

  const page = await crearDocumento({
    title: title || name.replace(/\.[^.]+$/, ''),
    parentId: pid,
    mimeType,
    base64: buf.toString('base64'),
    originalName: name,
    note: note || '',
  });
  void tokenCtx;
  return page;
}

export async function urlDescargaFirmada(assetId, ttlSec = 600, origin = '') {
  const asset = await repo.obtenerAsset(assetId, { conContenido: false });
  if (!asset) throw new ErrorHttp(404, 'Archivo no encontrado.', { code: 'asset_not_found' });
  const { urlFirmada } = await import('../mcp/signed-url.mjs');
  const base =
    origin ||
    (process.env.MCP_PUBLIC_URL || '').replace(/\/api\/mcp\/?$/, '') ||
    globalThis.__tb_mcp_origin ||
    '';
  return {
    url: urlFirmada(base, assetId, ttlSec),
    mime_type: asset.mime_type,
    size_bytes: Number(asset.size_bytes),
    original_name: asset.original_name,
    expires_in: Math.min(Math.max(Number(ttlSec) || 600, 60), 3600),
  };
}

export async function listarArchivos(opts) {
  return repo.listarArchivos(opts);
}

export async function listarAliases(opts = {}) {
  return repo.listarAliasesDePagina(opts.pageId || null);
}

export async function agregarAlias(pageId, alias) {
  await obtener(pageId);
  const v = validarTitulo(alias);
  if (!v.ok) throw new ErrorHttp(400, v.error, { code: 'validacion' });
  return repo.upsertAlias(alias, pageId);
}

export async function quitarAlias(alias) {
  const ok = await repo.quitarAlias(alias);
  if (!ok) throw new ErrorHttp(404, 'Alias no encontrado.', { code: 'page_not_found' });
  return { ok: true };
}

export async function listarTags(opts) {
  return repo.listarTags(opts);
}

export async function recientes(opts) {
  return repo.versionesRecientes(opts);
}

export async function stats() {
  return repo.statsWiki();
}

export async function whoamiMcp(tokenCtx) {
  const s = await stats();
  return {
    label: tokenCtx.label,
    email: tokenCtx.email,
    scopes: [...tokenCtx.scopes],
    author: tokenCtx.author,
    stats: { pages: s.pages, files: s.files, trash: s.trash, broken_links: s.broken_links },
  };
}

export function validarBase64Mcp(base64) {
  const buf = Buffer.from(base64 || '', 'base64');
  if (buf.length > MCP_BASE64_MAX) {
    throw new ErrorHttp(400, 'Payload base64 > 3 MB. Usa wiki_upload_from_url.', {
      code: 'payload_grande',
      hint: 'Sube el archivo a una URL https y usa wiki_upload_from_url.',
    });
  }
  return buf;
}

export { MCP_BASE64_MAX };
