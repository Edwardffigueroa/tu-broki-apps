/**
 * Cache SWR en memoria para la Wiki.
 *
 * - Hit → pintar al instante.
 * - En background → revalidar; si cambió y no hay edits locales, refrescar.
 * - Invalidación explícita en mutaciones (guardar, renombrar, papelera…).
 *
 * No persiste a disco: al recargar la pestaña vuelve a bootstrap.
 */

const PAGE_SOFT_TTL_MS = 60_000;
const PANEL_SOFT_TTL_MS = 30_000;
const TREE_SOFT_TTL_MS = 60_000;

const pages = new Map(); // id → { data, fetchedAt }
const versions = new Map(); // pageId → { data, fetchedAt }
const backlinks = new Map(); // pageId → { data, fetchedAt }

let tree = null; // { data, fetchedAt }

function entry(data) {
  return { data, fetchedAt: Date.now() };
}

function isStale(rec, ttl) {
  if (!rec) return true;
  return Date.now() - rec.fetchedAt > ttl;
}

/* ── páginas (contenido completo) ─────────────────────────────── */

export function getPage(id) {
  return pages.get(id)?.data ?? null;
}

export function setPage(page) {
  if (!page?.id) return;
  pages.set(page.id, entry(page));
}

export function setPages(list) {
  for (const p of list || []) setPage(p);
}

export function isPageStale(id, ttl = PAGE_SOFT_TTL_MS) {
  return isStale(pages.get(id), ttl);
}

export function patchPage(id, patch) {
  const prev = getPage(id);
  if (!prev) return null;
  const next = { ...prev, ...patch };
  setPage(next);
  return next;
}

export function invalidatePage(id) {
  pages.delete(id);
  versions.delete(id);
  backlinks.delete(id);
}

export function invalidateContents() {
  pages.clear();
  versions.clear();
  backlinks.clear();
}

/* ── árbol ────────────────────────────────────────────────────── */

export function getTree() {
  return tree?.data ?? null;
}

export function setTree(list) {
  tree = entry(list || []);
}

export function isTreeStale(ttl = TREE_SOFT_TTL_MS) {
  return isStale(tree, ttl);
}

export function invalidateTree() {
  tree = null;
}

export function patchTreePage(id, patch) {
  if (!tree?.data) return;
  const i = tree.data.findIndex((p) => p.id === id);
  if (i < 0) return;
  tree.data[i] = { ...tree.data[i], ...patch };
  tree.fetchedAt = Date.now();
}

/* ── paneles (historial / backlinks) ──────────────────────────── */

export function getVersions(id) {
  return versions.get(id)?.data ?? null;
}

export function setVersions(id, list) {
  versions.set(id, entry(list || []));
}

export function isVersionsStale(id, ttl = PANEL_SOFT_TTL_MS) {
  return isStale(versions.get(id), ttl);
}

export function invalidateVersions(id) {
  versions.delete(id);
}

export function getBacklinks(id) {
  return backlinks.get(id)?.data ?? null;
}

export function setBacklinks(id, list) {
  backlinks.set(id, entry(list || []));
}

export function isBacklinksStale(id, ttl = PANEL_SOFT_TTL_MS) {
  return isStale(backlinks.get(id), ttl);
}

export function invalidateBacklinks(id) {
  backlinks.delete(id);
}

/** Tras un rename con rewrite: no sabemos qué páginas cambiaron. */
export function invalidateAll() {
  pages.clear();
  versions.clear();
  backlinks.clear();
  tree = null;
}

export function stats() {
  return {
    pages: pages.size,
    versions: versions.size,
    backlinks: backlinks.size,
    tree: tree?.data?.length ?? 0,
  };
}
