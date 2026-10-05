/**
 * Wiki TuBroki — UI tipo Confluence
 */

import { api } from './api.js';
import * as cache from './cache.js';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const state = {
  pages: [],
  trash: [],
  aliases: [],
  current: null,
  draftRevision: 0,
  dirty: false,
  saving: false,
  mode: 'preview', // edit | preview — al abrir páginas se fuerza preview
  panel: 'historial',
  showTrash: false,
  versions: [],
  backlinks: [],
  selectedVersionId: null,
  collapsed: new Set(JSON.parse(localStorage.getItem('wiki.collapsed') || '[]')),
};

let draftTimer = null;
let titleById = new Map();
let idByTitleKey = new Map();
let lastFocusRevalidate = 0;
/** Evita que una revalidación vieja pise una navegación más reciente. */
let abrirSeq = 0;

const THEME_KEY = 'wiki.theme';

/** Solo oscuro si el usuario lo eligió; por defecto siempre claro. */
function resolvedTheme() {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

function syncThemeButton() {
  const btn = $('#btn-theme');
  if (!btn) return;
  const dark = resolvedTheme() === 'dark';
  btn.textContent = dark ? '☀' : '☾';
  btn.title = dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  btn.setAttribute('aria-label', btn.title);
}

function applyMermaidTheme(theme) {
  if (!window.mermaid) return;
  window.mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'neutral',
    securityLevel: 'strict',
    fontFamily: 'Manrope, -apple-system, BlinkMacSystemFont, sans-serif',
  });
}

function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  if (next === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    try {
      localStorage.setItem(THEME_KEY, 'dark');
    } catch (_) {}
  } else {
    document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.removeItem(THEME_KEY);
    } catch (_) {}
  }
  syncThemeButton();
  applyMermaidTheme(next);
  if (state.mode === 'preview' && state.current?.kind !== 'file') {
    void renderPreview();
  }
}

function toggleTheme() {
  applyTheme(resolvedTheme() === 'dark' ? 'light' : 'dark');
}

function setStatus(kind, text) {
  const el = $('#save-ind');
  el.className = `save-ind ${kind || ''}`;
  el.textContent = text;
}

function banner(tipo, html) {
  const el = $('#banner');
  el.className = `banner show ${tipo}`;
  el.innerHTML = html;
}

function hideBanner() {
  $('#banner').className = 'banner';
  $('#banner').innerHTML = '';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeKey(t) {
  return String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function rebuildIndexes() {
  titleById = new Map(state.pages.map((p) => [p.id, p.title]));
  idByTitleKey = new Map(state.pages.map((p) => [p.title_key || normalizeKey(p.title), p.id]));
  for (const a of state.aliases || []) {
    if (a?.alias_key && a?.page_id) idByTitleKey.set(a.alias_key, a.page_id);
  }
}

function aplicarArbol(pages) {
  state.pages = pages || [];
  cache.setTree(state.pages);
  rebuildIndexes();
  renderTree();
}

async function cargarArbol({ force = false } = {}) {
  if (!force) {
    const cached = cache.getTree();
    if (cached && !cache.isTreeStale()) {
      state.pages = cached;
      rebuildIndexes();
      renderTree();
      void revalidateArbol();
      return;
    }
  }
  const data = await api.arbol(false);
  aplicarArbol(data.pages || []);
}

async function revalidateArbol() {
  try {
    const data = await api.arbol(false);
    const next = data.pages || [];
    const prev = cache.getTree() || [];
    const same =
      prev.length === next.length &&
      prev.every((p, i) =>
        p.id === next[i].id &&
        p.title === next[i].title &&
        p.parent_id === next[i].parent_id &&
        p.position === next[i].position &&
        p.has_draft === next[i].has_draft,
      );
    if (!same) aplicarArbol(next);
    else cache.setTree(next);
  } catch {
    /* silencioso: el árbol cacheado sigue sirviendo */
  }
}

async function cargarPapelera() {
  const data = await api.arbol(true);
  state.trash = data.pages || [];
  renderTree();
}

/** ¿`id` está dentro del subárbol de `ancestroId`? (incluye el propio nodo) */
function esDescendiente(id, ancestroId) {
  const byId = new Map(state.pages.map((p) => [p.id, p]));
  let cur = byId.get(id);
  const vistos = new Set();
  while (cur && !vistos.has(cur.id)) {
    if (cur.id === ancestroId) return true;
    vistos.add(cur.id);
    cur = cur.parent_id ? byId.get(cur.parent_id) : null;
  }
  return false;
}

// Misma indexación fraccionaria que el servidor (apps/wiki/server/markdown.js).
const ALFABETO = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function positionBetween(antes, despues) {
  const a = antes || '0';
  if (!despues) {
    const i = ALFABETO.indexOf(a.slice(-1));
    if (i >= 0 && i < ALFABETO.length - 1) return a.slice(0, -1) + ALFABETO[i + 1];
    return `${a}0`;
  }
  if (a >= despues) return `${a}0`;
  let i = 0;
  while (i < a.length && i < despues.length && a[i] === despues[i]) i += 1;
  if (i < a.length && i < despues.length) {
    const ai = ALFABETO.indexOf(a[i]);
    const bi = ALFABETO.indexOf(despues[i]);
    if (bi - ai > 1) return a.slice(0, i) + ALFABETO[Math.floor((ai + bi) / 2)];
  }
  return `${a}V`;
}

function childrenOf(parentId) {
  return state.pages
    .filter((p) => (p.parent_id || null) === (parentId || null))
    .sort((a, b) => String(a.position).localeCompare(String(b.position)) || a.title.localeCompare(b.title));
}

function iconoNodo(page) {
  if (page.icon) return page.icon;
  if (page.kind !== 'file') return '📄';
  const mime = page.mime_type || '';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📑';
  if (mime === 'text/html') return '🌐';
  return '📎';
}

function formatBytes(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function etiquetaMime(mime) {
  if (!mime) return 'Archivo';
  if (mime.startsWith('image/')) return 'Imagen';
  if (mime === 'application/pdf') return 'PDF';
  if (mime === 'text/html') return 'HTML';
  return mime;
}

function renderTreeNode(page, depth = 0) {
  const kids = childrenOf(page.id);
  const collapsed = state.collapsed.has(page.id);
  const active = state.current?.id === page.id;
  const twisty = kids.length
    ? `<span class="twisty" data-toggle="${page.id}">${collapsed ? '▶' : '▼'}</span>`
    : `<span class="twisty"></span>`;
  const kind = page.kind === 'file' ? 'file' : 'page';
  const dl =
    kind === 'file' && page.asset_id
      ? `<button type="button" class="tree-dl" data-download-asset="${page.asset_id}" data-download-name="${escapeHtml(page.original_name || page.title)}" title="Descargar">↓</button>`
      : kind === 'page'
        ? `<button type="button" class="tree-dl" data-download-page="${page.id}" title="Descargar .md">↓</button>`
        : '';
  let html = `
    <div class="tree-item ${active ? 'active' : ''}" data-id="${page.id}" data-kind="${kind}" draggable="true" style="padding-left:${8 + depth * 14}px">
      ${twisty}
      <span class="tree-kind" aria-hidden="true">${iconoNodo(page)}</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(page.title)}</span>
      ${page.has_draft ? '<span class="draft-dot" title="Borrador"></span>' : ''}
      ${dl}
    </div>`;
  if (kids.length && !collapsed) {
    html += `<div class="tree-children">${kids.map((k) => renderTreeNode(k, depth + 1)).join('')}</div>`;
  }
  return html;
}

function renderTree() {
  const body = $('#tree');
  if (state.showTrash) {
    if (!state.trash.length) {
      body.innerHTML = `<p style="color:var(--ink-faint);padding:12px;font-size:13px">La papelera está vacía.</p>`;
      return;
    }
    body.innerHTML = state.trash
      .map(
        (p) => `
      <div class="tree-item" data-trash-id="${p.id}">
        <span style="flex:1">${escapeHtml(p.title)}</span>
        <button class="btn btn-sm btn-ghost" data-restore="${p.id}">Recuperar</button>
      </div>`,
      )
      .join('');
    return;
  }

  const roots = childrenOf(null);
  if (!roots.length) {
    body.innerHTML = `<p style="color:var(--ink-faint);padding:12px;font-size:13px">Aún no hay páginas. Crea la primera.</p>`;
    return;
  }
  body.innerHTML = roots.map((p) => renderTreeNode(p)).join('');
}

function breadcrumbs(page) {
  if (!page) return '';
  const parts = [];
  let cur = page;
  const byId = new Map(state.pages.map((p) => [p.id, p]));
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    parts.unshift(cur.title);
    cur = cur.parent_id ? byId.get(cur.parent_id) : null;
  }
  return parts
    .map((t, i) => (i === parts.length - 1 ? `<strong>${escapeHtml(t)}</strong>` : `<span>${escapeHtml(t)}</span> › `))
    .join('');
}

function paginaFingerprint(page) {
  if (!page) return '';
  return [
    page.current_version_id,
    page.draft_revision,
    page.updated_at,
    page.title,
    page.parent_id,
    page.kind,
    page.asset_id,
  ].join('|');
}

/** Pinta el editor o el visor según kind. No hace fetch. */
function aplicarPaginaAlEditor(page) {
  state.current = page;
  state.draftRevision = page.draft_revision || 0;
  state.selectedVersionId = null;

  const title = page.draft_title ?? page.title;
  $('#page-title').value = title;
  $('#crumbs').innerHTML = breadcrumbs(page);
  $('#editor-empty').style.display = 'none';
  $('#editor-main').style.display = 'flex';

  const esFile = page.kind === 'file';
  $('#toolbar-page').style.display = esFile ? 'none' : 'flex';
  $('#toolbar-file').style.display = esFile ? 'flex' : 'none';
  $('#pane-page').style.display = esFile ? 'none' : 'flex';
  $('#pane-file').style.display = esFile ? 'flex' : 'none';

  if (esFile) {
    const note = page.draft_content ?? page.version?.content ?? '';
    $('#doc-notes').value = note;
    $('#meta-line').textContent = [
      etiquetaMime(page.mime_type),
      formatBytes(page.size_bytes),
      page.original_name || null,
      page.updated_at ? `actualizado ${relTime(page.updated_at)}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    void renderDocumentViewer(page);
  } else {
    const content = page.draft_content ?? page.version?.content ?? '';
    $('#md-input').value = content;
    const v = page.version;
    const draftInfo =
      page.draft_content != null || page.draft_title != null
        ? ` · Borrador · ${relTime(page.draft_updated_at)}`
        : '';
    $('#meta-line').textContent = v
      ? `Versión ${v.version_number} guardada por ${v.author} · ${relTime(v.created_at)}${draftInfo}`
      : `Sin versiones${draftInfo}`;
    // Páginas existentes → vista previa; páginas nuevas vacías → editor.
    const vacia = !String(content || '').trim();
    setMode(vacia ? 'edit' : 'preview');
  }

  renderTree();
  history.replaceState(null, '', `/wiki#${idSeguro(page.id)}`);
}

function idSeguro(id) {
  return encodeURIComponent(id);
}

/**
 * Abre una página con SWR: si hay cache, pinta ya y revalida en background.
 * Historial/backlinks no bloquean el editor.
 */
async function abrirPagina(id, { force = false } = {}) {
  if (state.dirty && state.current?.id && state.current.id !== id) {
    await flushDraft();
  }
  hideBanner();
  const seq = ++abrirSeq;

  const cached = !force ? cache.getPage(id) : null;
  if (cached) {
    state.dirty = false;
    setStatus('ok', 'Guardado');
    aplicarPaginaAlEditor(cached);
    state.versions = cache.getVersions(id) || [];
    state.backlinks = cache.getBacklinks(id) || [];
    renderPanel();
    void cargarHistorial();
    void cargarBacklinks();
    void revalidatePage(id, seq);
    return;
  }

  setStatus('saving', 'Cargando…');
  const page = await api.obtener(id);
  if (seq !== abrirSeq) return;
  cache.setPage(page);
  state.dirty = false;
  setStatus('ok', 'Guardado');
  aplicarPaginaAlEditor(page);
  state.versions = cache.getVersions(id) || [];
  state.backlinks = cache.getBacklinks(id) || [];
  renderPanel();
  void cargarHistorial();
  void cargarBacklinks();
}

async function revalidatePage(id, seq) {
  try {
    const page = await api.obtener(id);
    const prev = cache.getPage(id);
    cache.setPage(page);
    if (seq != null && seq !== abrirSeq) return;
    if (state.current?.id !== id) return;

    const changed = paginaFingerprint(prev) !== paginaFingerprint(page);
    if (!changed) {
      // Refresca refs internas sin tocar el textarea.
      state.current = page;
      state.draftRevision = page.draft_revision || 0;
      return;
    }
    if (state.dirty) {
      // Hay edits locales: no pisa el editor; solo alinea metadatos de concurrencia.
      state.current = {
        ...state.current,
        current_version_id: page.current_version_id,
        updated_at: page.updated_at,
        title: page.title,
        title_key: page.title_key,
        parent_id: page.parent_id,
        version: page.version,
      };
      return;
    }
    aplicarPaginaAlEditor(page);
    void cargarHistorial({ force: true });
    void cargarBacklinks({ force: true });
  } catch {
    /* el cache sigue visible */
  }
}

function relTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'hace un momento';
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function cargarHistorial({ force = false } = {}) {
  if (!state.current) return;
  const id = state.current.id;
  const cached = !force ? cache.getVersions(id) : null;
  if (cached) {
    state.versions = cached;
    if (state.panel === 'historial') renderPanel();
  }
  if (cached && !force && !cache.isVersionsStale(id)) return;
  try {
    const data = await api.versiones(id);
    const list = data.versions || [];
    cache.setVersions(id, list);
    if (state.current?.id !== id) return;
    state.versions = list;
    if (state.panel === 'historial') renderPanel();
  } catch {
    /* panel vacío o cache viejo */
  }
}

async function cargarBacklinks({ force = false } = {}) {
  if (!state.current) return;
  const id = state.current.id;
  const cached = !force ? cache.getBacklinks(id) : null;
  if (cached) {
    state.backlinks = cached;
    if (state.panel === 'backlinks') renderPanel();
  }
  if (cached && !force && !cache.isBacklinksStale(id)) return;
  try {
    const data = await api.backlinks(id);
    const list = data.backlinks || [];
    cache.setBacklinks(id, list);
    if (state.current?.id !== id) return;
    state.backlinks = list;
    if (state.panel === 'backlinks') renderPanel();
  } catch {
    /* panel vacío o cache viejo */
  }
}

function renderPanel() {
  const body = $('#panel-body');
  if (state.panel === 'historial') {
    if (!state.versions.length) {
      body.innerHTML = `<p style="color:var(--ink-faint);font-size:13px;padding:8px">Sin historial todavía.</p>`;
      return;
    }
    body.innerHTML = state.versions
      .map(
        (v) => `
      <div class="hist-item ${state.selectedVersionId === v.id ? 'active' : ''}" data-vid="${v.id}">
        <div class="v">v${v.version_number} · ${escapeHtml(v.source || 'web')}</div>
        <div class="meta">${escapeHtml(v.author)} · ${relTime(v.created_at)}</div>
        ${v.message ? `<div class="msg">${escapeHtml(v.message)}</div>` : ''}
        <div style="margin-top:8px;display:flex;gap:6px">
          <button class="btn btn-sm" data-diff="${v.id}">Diff</button>
          <button class="btn btn-sm btn-primary" data-restore-v="${v.id}">Restaurar</button>
        </div>
      </div>`,
      )
      .join('');
  } else {
    if (!state.backlinks.length) {
      body.innerHTML = `<p style="color:var(--ink-faint);font-size:13px;padding:8px">Nadie enlaza esta página todavía. Usa [[título]] en otras notas.</p>`;
      return;
    }
    body.innerHTML = state.backlinks
      .map(
        (b) => `
      <div class="blink-item" data-open="${b.source_page_id}">
        <strong>${escapeHtml(b.source_title)}</strong>
        <div class="snip">${escapeHtml(b.snippet || '')}</div>
      </div>`,
      )
      .join('');
  }
}

let previewBlobUrls = [];
let docBlobUrls = [];

function revokePreviewBlobs() {
  for (const url of previewBlobUrls) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
  previewBlobUrls = [];
}

function revokeDocBlobs() {
  for (const url of docBlobUrls) {
    try { URL.revokeObjectURL(url); } catch { /* ignore */ }
  }
  docBlobUrls = [];
}

async function renderDocumentViewer(page) {
  const stage = $('#doc-stage');
  if (!stage || !page?.asset_id) return;
  revokeDocBlobs();
  stage.innerHTML = `<p class="doc-missing">Cargando documento…</p>`;

  try {
    const r = await fetch(api.assetUrl(page.asset_id), { credentials: 'same-origin' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const mime = page.mime_type || r.headers.get('content-type') || 'application/octet-stream';
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    docBlobUrls.push(url);
    const nombre = page.original_name || `${page.title}.bin`;

    if (mime.startsWith('image/')) {
      stage.innerHTML = `<img class="doc-img" src="${url}" alt="${escapeHtml(page.title)}">`;
      stage.querySelector('img')?.addEventListener('click', () =>
        abrirLightbox(url, page.title, {
          assetId: page.asset_id,
          filename: nombre,
        }),
      );
    } else if (mime === 'application/pdf') {
      stage.innerHTML = `<iframe class="doc-frame" title="${escapeHtml(page.title)}" src="${url}#toolbar=1"></iframe>`;
    } else if (mime === 'text/html') {
      montarVistaNavegadorHtml(stage, {
        url,
        titulo: page.title,
        nombre,
      });
    } else {
      stage.innerHTML = `<p class="doc-missing">Vista previa no disponible para <code>${escapeHtml(mime)}</code>. Usa Descargar.</p>`;
    }
  } catch (e) {
    stage.innerHTML = `<p class="doc-missing">No se pudo cargar el documento. ${escapeHtml(e.message || '')}</p>`;
  }
}

/**
 * Vista tipo navegador para HTML:
 * - chrome con URL / recargar / abrir
 * - iframe sandboxed con scripts (sin allow-same-origin → no toca cookies ni DOM de la wiki)
 */
function montarVistaNavegadorHtml(stage, { url, titulo, nombre }) {
  const pathLabel = `wiki://${escapeHtml(nombre)}`;
  stage.innerHTML = `
    <div class="browser-shell">
      <div class="browser-chrome" role="toolbar" aria-label="Vista previa HTML">
        <div class="browser-dots" aria-hidden="true"><span></span><span></span><span></span></div>
        <button type="button" class="browser-nav" data-html-reload title="Recargar">↻</button>
        <div class="browser-url" title="${pathLabel}">
          <span class="browser-lock" aria-hidden="true">🔒</span>
          <span class="browser-path">${pathLabel}</span>
        </div>
        <button type="button" class="browser-nav" data-html-open title="Abrir en pestaña nueva">↗</button>
      </div>
      <iframe
        class="browser-frame"
        title="${escapeHtml(titulo || nombre)}"
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-downloads"
        referrerpolicy="no-referrer"
      ></iframe>
      <p class="browser-hint">Vista aislada · el HTML no puede leer la sesión de la Wiki</p>
    </div>`;

  const frame = stage.querySelector('iframe.browser-frame');
  if (frame) frame.src = url;

  stage.querySelector('[data-html-reload]')?.addEventListener('click', () => {
    if (!frame) return;
    // Fuerza recarga del blob (misma URL).
    frame.src = 'about:blank';
    requestAnimationFrame(() => {
      frame.src = url;
    });
  });

  stage.querySelector('[data-html-open]')?.addEventListener('click', () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}

async function renderPreview() {
  const md = $('#md-input').value;
  let html = window.marked?.parse?.(md) || escapeHtml(md).replace(/\n/g, '<br>');

  // Wikilinks: [[Title]] or [[Title|alias]]
  html = html.replace(/\[\[([^\]|#]+)(?:\|([^\]]+))?(?:#[^\]]+)?\]\]/g, (_, title, alias) => {
    const key = normalizeKey(title);
    const id = idByTitleKey.get(key);
    const label = alias || title;
    if (id) return `<a href="#${id}" class="wikilink" data-page="${id}">${escapeHtml(label)}</a>`;
    return `<a href="#" class="wikilink unresolved" data-create="${escapeHtml(title)}">${escapeHtml(label)}</a>`;
  });

  // `![alt](asset:UUID)` → img autenticada; `[doc](asset:UUID)` → enlace de descarga.
  html = html.replace(
    /(src|href)="asset:([0-9a-f-]{36})"/gi,
    (_, attr, id) => `${attr}="${api.assetUrl(id)}"`,
  );

  if (window.DOMPurify) {
    html = window.DOMPurify.sanitize(html, {
      ADD_ATTR: ['data-page', 'data-create', 'target', 'loading'],
      ADD_TAGS: ['figure', 'figcaption'],
    });
  }

  revokePreviewBlobs();
  const root = $('#md-preview');
  root.innerHTML = html;
  await hydrateAssetMedia(root);
  await renderMermaidDiagrams(root);
}

/**
 * Carga assets con la cookie de sesión (fetch → blob URL) para que las
 * imágenes se vean siempre en la vista previa, y envuelve cada una en
 * una figura clickeable (lightbox).
 */
async function hydrateAssetMedia(root) {
  if (!root) return;

  for (const a of root.querySelectorAll('a[href*="/api/wiki/assets"]')) {
    a.classList.add('asset-file');
    const href = a.getAttribute('href') || '';
    const idMatch = href.match(/[?&]id=([0-9a-f-]{36})/i);
    if (idMatch) a.dataset.assetId = idMatch[1];
    if (!a.textContent.trim()) a.textContent = 'Descargar archivo';
    a.title = a.title || 'Descargar';
  }

  const imgs = [...root.querySelectorAll('img[src*="/api/wiki/assets"]')];
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src');
      const alt = img.getAttribute('alt') || '';
      const idMatch = (src || '').match(/[?&]id=([0-9a-f-]{36})/i);
      const assetId = idMatch?.[1] || '';
      img.classList.add('preview-img', 'preview-img-loading');
      img.removeAttribute('width');
      img.removeAttribute('height');

      try {
        const r = await fetch(src, { credentials: 'same-origin' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const mime = r.headers.get('content-type') || '';
        const blob = await r.blob();

        // PDF referenciado como imagen: tarjeta con descarga.
        if (mime.includes('pdf') || alt.toLowerCase().endsWith('.pdf')) {
          const link = document.createElement('a');
          link.href = '#';
          link.className = 'asset-file';
          link.dataset.assetId = assetId;
          link.dataset.downloadName = alt || 'documento.pdf';
          link.textContent = alt || 'Descargar PDF';
          link.title = 'Descargar';
          img.replaceWith(link);
          return;
        }

        const url = URL.createObjectURL(blob);
        previewBlobUrls.push(url);
        img.dataset.fullSrc = url;
        img.dataset.caption = alt;
        if (assetId) img.dataset.assetId = assetId;
        img.dataset.downloadName = alt || 'imagen';
        img.src = url;
        img.classList.remove('preview-img-loading');
        img.loading = 'lazy';

        if (!img.closest('figure')) {
          const fig = document.createElement('figure');
          fig.className = 'preview-figure';
          img.replaceWith(fig);
          fig.appendChild(img);
          const actions = document.createElement('div');
          actions.className = 'preview-figure-actions';
          if (alt) {
            const cap = document.createElement('figcaption');
            cap.textContent = alt;
            actions.appendChild(cap);
          }
          const dl = document.createElement('button');
          dl.type = 'button';
          dl.className = 'btn btn-sm preview-dl';
          dl.textContent = 'Descargar';
          dl.dataset.assetId = assetId;
          dl.dataset.downloadName = alt || 'imagen';
          dl.dataset.blobSrc = url;
          actions.appendChild(dl);
          fig.appendChild(actions);
        }
      } catch {
        img.classList.remove('preview-img-loading', 'preview-img');
        img.classList.add('preview-img-broken');
        img.removeAttribute('src');
        img.alt = `${alt || 'Imagen'} — no se pudo cargar`;
      }
    }),
  );
}

function abrirLightbox(src, caption = '', meta = {}) {
  const box = $('#img-lightbox');
  const img = $('#img-lightbox-img');
  const cap = $('#img-lightbox-caption');
  const dl = $('#img-lightbox-download');
  if (!box || !img) return;
  img.src = src;
  img.alt = caption || '';
  img.dataset.assetId = meta.assetId || '';
  img.dataset.downloadName = meta.filename || caption || 'imagen';
  cap.textContent = caption || '';
  cap.hidden = !caption;
  if (dl) dl.hidden = false;
  box.hidden = false;
}

function cerrarLightbox() {
  const box = $('#img-lightbox');
  if (!box || box.hidden) return;
  box.hidden = true;
  const img = $('#img-lightbox-img');
  if (img) img.removeAttribute('src');
}

/** Bloques ```mermaid → SVG en la vista previa (solo cliente; el .md guarda el texto). */
async function renderMermaidDiagrams(root) {
  if (!root || !window.mermaid) return;
  const nodes = [...root.querySelectorAll('.mermaid')];
  if (!nodes.length) return;
  try {
    await window.mermaid.run({ nodes, suppressErrors: false });
  } catch (e) {
    console.warn('mermaid:', e);
    for (const n of nodes) {
      if (n.querySelector('svg')) continue;
      n.innerHTML = `<p class="mermaid-err">No se pudo renderizar el diagrama. Revisa la sintaxis.</p>`;
    }
  }
}

function markDirty() {
  state.dirty = true;
  setStatus('dirty', 'Cambios sin guardar');
  clearTimeout(draftTimer);
  draftTimer = setTimeout(flushDraft, 2000);
}

async function flushDraft() {
  if (!state.current || !state.dirty) return;
  setStatus('saving', 'Autoguardando…');
  try {
    const title = $('#page-title').value;
    const content =
      state.current.kind === 'file' ? $('#doc-notes').value : $('#md-input').value;
    const r = await api.draft(state.current.id, {
      title,
      content,
      draft_revision: state.draftRevision,
      base_version_id: state.current.current_version_id,
    });
    state.draftRevision = r.draft_revision;
    state.dirty = false;
    setStatus('ok', 'Borrador guardado');
    cache.patchPage(state.current.id, {
      draft_title: title,
      draft_content: content,
      draft_revision: r.draft_revision,
      draft_updated_at: r.draft_updated_at,
      draft_base_version_id: r.draft_base_version_id,
      updated_at: r.draft_updated_at || state.current.updated_at,
    });
    if (state.current) {
      state.current = {
        ...state.current,
        draft_title: title,
        draft_content: content,
        draft_revision: r.draft_revision,
        draft_updated_at: r.draft_updated_at,
        draft_base_version_id: r.draft_base_version_id,
      };
    }
    cache.patchTreePage(state.current.id, { has_draft: true });
    const nodo = state.pages.find((p) => p.id === state.current.id);
    if (nodo) nodo.has_draft = true;
    renderTree();
  } catch (e) {
    if (e.code === 'draft_changed') {
      banner(
        'warn',
        `El borrador cambió en otro lado. <button class="btn btn-sm" id="btn-reload-draft">Recargar borrador</button>`,
      );
      $('#btn-reload-draft')?.addEventListener('click', async () => {
        cache.invalidatePage(state.current.id);
        await abrirPagina(state.current.id, { force: true });
      });
    }
    setStatus('error', 'Error al autoguardar');
  }
}

/**
 * Si cambió el título y hay páginas que la enlazan, ofrece reescribir esos
 * `[[enlaces]]` (el servidor crea versiones `source=system` en cada origen).
 * Devuelve false si el usuario cancela todo el guardado.
 */
async function renombrarSiHaceFalta() {
  const nuevo = $('#page-title').value.trim();
  const anterior = state.current.title;
  if (!nuevo || nuevo === anterior) return true;

  const entrantes = state.backlinks.length;
  let reescribir = false;
  if (entrantes > 0) {
    const r = await pedirConfirmacion({
      titulo: 'Renombrar página',
      descripcion: `${entrantes} ${entrantes === 1 ? 'página enlaza' : 'páginas enlazan'} a «${anterior}». ¿Actualizo esos enlaces al nuevo título?`,
      ok: 'Sí, actualizar enlaces',
      alterno: 'No, dejarlos como están',
    });
    if (r === null) return false;
    reescribir = r;
  }

  await api.actualizar(state.current.id, { title: nuevo, rewrite_links: reescribir });
  if (reescribir) {
    // El rewrite toca el contenido de otras páginas: el cache de contenidos queda obsoleto.
    cache.invalidateContents();
  } else {
    cache.invalidatePage(state.current.id);
    cache.invalidateBacklinks(state.current.id);
  }
  cache.invalidateTree();
  const fresca = await api.obtener(state.current.id);
  cache.setPage(fresca);
  state.current = fresca;
  await cargarArbol({ force: true });
  return true;
}

async function guardarVersion({ message = null } = {}) {
  if (!state.current) return;

  setStatus('saving', 'Guardando versión…');
  try {
    if (!(await renombrarSiHaceFalta())) {
      setStatus('dirty', 'Cambios sin guardar');
      return;
    }

    const r = await api.guardar(state.current.id, {
      title: $('#page-title').value,
      content: state.current.kind === 'file' ? $('#doc-notes').value : $('#md-input').value,
      base_version_id: state.current.current_version_id,
      message: message || null,
    });
    state.dirty = false;
    setStatus('ok', 'Versión guardada');
    if (r.page) cache.setPage(r.page);
    cache.invalidateVersions(r.page?.id || state.current.id);
    cache.invalidateTree();
    await cargarArbol({ force: true });
    await abrirPagina(r.page.id, { force: true });
  } catch (e) {
    if (e.code === 'version_conflict') {
      banner(
        'warn',
        `Alguien guardó una versión nueva. <button class="btn btn-sm" id="btn-force">Guardar sobre la última</button> <button class="btn btn-sm" id="btn-reload">Descartar mis cambios</button>`,
      );
      $('#btn-reload')?.addEventListener('click', () => {
        cache.invalidatePage(state.current.id);
        abrirPagina(state.current.id, { force: true });
      });
      $('#btn-force')?.addEventListener('click', async () => {
        hideBanner();
        cache.invalidatePage(state.current.id);
        state.current = await api.obtener(state.current.id);
        cache.setPage(state.current);
        await guardarVersion({ message });
      });
      setStatus('error', 'Conflicto de versión');
    } else if (e.code === 'no_changes') {
      // Puede pasar si solo cambió el título (ya aplicado por el renombrado).
      state.dirty = false;
      setStatus('ok', 'Guardado');
      cache.invalidateTree();
      await cargarArbol({ force: true });
      await abrirPagina(state.current.id, { force: true });
    } else {
      setStatus('error', e.message);
      banner('err', escapeHtml(e.message));
    }
  }
}

async function abrirDialogoGuardar() {
  if (!state.current) return;
  const message = await pedirTexto({
    titulo: 'Guardar versión',
    descripcion: 'Describe el cambio para encontrarlo después en el historial. Puedes dejarlo vacío.',
    etiqueta: 'Ej: agregué los precios de los PACKs',
    ok: 'Guardar versión',
  });
  if (message === null) return;
  await guardarVersion({ message });
}

async function crearPagina(parentId = null) {
  const title = await pedirTexto({
    titulo: parentId ? 'Nueva subpágina' : 'Nueva página',
    etiqueta: 'Título de la página',
    valor: '',
    ok: 'Crear',
  });
  if (title === null || !title.trim()) return;
  try {
    const page = await api.crear({ title: title.trim(), parent_id: parentId, content: '' });
    cache.setPage(page);
    cache.invalidateTree();
    await cargarArbol({ force: true });
    await abrirPagina(page.id, { force: true });
  } catch (e) {
    banner('err', escapeHtml(e.message));
  }
}

function lineDiff(a, b) {
  const al = String(a || '').split('\n');
  const bl = String(b || '').split('\n');
  const max = Math.max(al.length, bl.length);
  const lines = [];
  for (let i = 0; i < max; i += 1) {
    if (al[i] === bl[i]) {
      if (al[i] != null) lines.push(`  ${escapeHtml(al[i])}`);
    } else {
      if (al[i] != null) lines.push(`<span class="diff-del">- ${escapeHtml(al[i])}</span>`);
      if (bl[i] != null) lines.push(`<span class="diff-add">+ ${escapeHtml(bl[i])}</span>`);
    }
  }
  return lines.join('\n');
}

async function mostrarDiff(vid) {
  const v = await api.version(state.current.id, vid);
  const current = state.current.version?.content ?? '';
  const html = `<div class="diff-view">${lineDiff(v.content, current)}</div>
    <p style="font-size:12px;color:var(--ink-soft);margin-top:8px">Rojo = versión elegida · Verde = versión actual</p>`;
  openModal('Comparar con versión actual', html);
}

// Se invoca si el modal se cierra por fuera (Escape, backdrop, botón Cerrar)
// para que las promesas de pedirTexto/pedirConfirmacion no queden colgadas.
let alCerrarModal = null;

function openModal(title, bodyHtml, actionsHtml = '', { wide = false } = {}) {
  const modal = $('#modal-bg .modal');
  modal.classList.toggle('modal-wide', wide);
  $('#modal-bg').classList.add('show');
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHtml;
  $('#modal-actions').innerHTML = actionsHtml || `<button class="btn" data-close-modal>Cerrar</button>`;
}

function closeModal() {
  $('#modal-bg').classList.remove('show');
  $('#modal-bg .modal')?.classList.remove('modal-wide');
  const cb = alCerrarModal;
  alCerrarModal = null;
  if (cb) cb();
}

function pedirTexto({ titulo, descripcion = '', etiqueta = '', valor = '', ok = 'Aceptar' }) {
  return new Promise((resolve) => {
    openModal(
      titulo,
      `${descripcion ? `<p>${escapeHtml(descripcion)}</p>` : ''}
       <input id="prompt-input" value="${escapeHtml(valor)}" placeholder="${escapeHtml(etiqueta)}" autocomplete="off">`,
      `<button class="btn" id="prompt-cancel">Cancelar</button>
       <button class="btn btn-primary" id="prompt-ok">${escapeHtml(ok)}</button>`,
    );
    let hecho = false;
    const cerrar = (resultado) => {
      if (hecho) return;
      hecho = true;
      alCerrarModal = null;
      closeModal();
      resolve(resultado);
    };
    alCerrarModal = () => {
      if (!hecho) {
        hecho = true;
        resolve(null);
      }
    };
    const input = $('#prompt-input');
    input.focus();
    input.select();
    $('#prompt-ok').addEventListener('click', () => cerrar(input.value));
    $('#prompt-cancel').addEventListener('click', () => cerrar(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        cerrar(input.value);
      }
    });
  });
}

/** Resuelve true / false / null (cancelado). */
function pedirConfirmacion({ titulo, descripcion = '', ok = 'Sí', alterno = null }) {
  return new Promise((resolve) => {
    openModal(
      titulo,
      descripcion ? `<p>${escapeHtml(descripcion)}</p>` : '',
      `<button class="btn" id="conf-cancel">Cancelar</button>
       ${alterno ? `<button class="btn" id="conf-no">${escapeHtml(alterno)}</button>` : ''}
       <button class="btn btn-primary" id="conf-ok">${escapeHtml(ok)}</button>`,
    );
    let hecho = false;
    const cerrar = (resultado) => {
      if (hecho) return;
      hecho = true;
      alCerrarModal = null;
      closeModal();
      resolve(resultado);
    };
    alCerrarModal = () => {
      if (!hecho) {
        hecho = true;
        resolve(null);
      }
    };
    $('#conf-ok').addEventListener('click', () => cerrar(true));
    $('#conf-no')?.addEventListener('click', () => cerrar(false));
    $('#conf-cancel').addEventListener('click', () => cerrar(null));
  });
}

/* ——— Buscador inteligente (título + contenido) ——— */

function rutaPagina(id) {
  const byId = new Map(state.pages.map((p) => [p.id, p]));
  const partes = [];
  let cur = byId.get(id);
  const vistos = new Set();
  while (cur && !vistos.has(cur.id)) {
    vistos.add(cur.id);
    partes.unshift(cur.title);
    cur = cur.parent_id ? byId.get(cur.parent_id) : null;
  }
  return partes.slice(0, -1).join(' / ');
}

/** Convierte headline del servidor (`<<hit>>`) en HTML seguro con <mark>. */
function formatHeadline(raw) {
  const marked = String(raw || '')
    .replace(/<</g, '\u0001')
    .replace(/>>/g, '\u0002');
  return escapeHtml(marked)
    .replace(/\u0001/g, '<mark>')
    .replace(/\u0002/g, '</mark>');
}

function etiquetaMatch(match) {
  if (match === 'title') return { cls: 'match-title', label: 'Título' };
  if (match === 'both') return { cls: 'match-both', label: 'Ambos' };
  return { cls: 'match-content', label: 'Texto' };
}

function resaltarTitulo(title, q) {
  const t = String(title || '');
  const qq = String(q || '').trim();
  if (!qq) return escapeHtml(t);
  const i = t.toLowerCase().indexOf(qq.toLowerCase());
  if (i < 0) return escapeHtml(t);
  return (
    escapeHtml(t.slice(0, i)) +
    '<mark>' +
    escapeHtml(t.slice(i, i + qq.length)) +
    '</mark>' +
    escapeHtml(t.slice(i + qq.length))
  );
}

async function openCommandPalette() {
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  openModal(
    'Buscar',
    `<div class="search-shell">
      <div class="search-field">
        <span class="search-field-icon" aria-hidden="true">⌕</span>
        <input id="search-input" type="search" placeholder="Buscar en títulos y contenido…" autocomplete="off" spellcheck="false">
        <span class="search-field-hint">${isMac ? 'esc' : 'Esc'}</span>
      </div>
      <div class="search-meta" id="search-meta">Escribe para buscar en toda la wiki</div>
      <div class="search-results" id="search-results" role="listbox" aria-label="Resultados"></div>
      <div class="search-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navegar</span>
        <span><kbd>↵</kbd> abrir</span>
        <span><kbd>esc</kbd> cerrar</span>
      </div>
    </div>`,
    '',
    { wide: true },
  );

  const input = $('#search-input');
  const list = $('#search-results');
  const meta = $('#search-meta');
  input.focus();

  let results = [];
  let active = 0;
  let reqId = 0;
  let debounce;

  const setActive = (i) => {
    if (!results.length) {
      active = 0;
      return;
    }
    active = (i + results.length) % results.length;
    $$('.search-item', list).forEach((el, idx) => {
      el.classList.toggle('active', idx === active);
      if (idx === active) el.scrollIntoView({ block: 'nearest' });
    });
  };

  const renderEmpty = (title, subtitle) => {
    list.innerHTML = `<div class="search-empty"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span></div>`;
  };

  const renderResults = (q) => {
    if (!results.length) {
      renderEmpty('Sin coincidencias', `No hay páginas que mencionen «${q}» en el título ni en el contenido.`);
      return;
    }
    list.innerHTML = results
      .map((r, idx) => {
        const badge = etiquetaMatch(r.match);
        const path = rutaPagina(r.id);
        const titleHtml =
          r.match === 'title' || r.match === 'both' ? resaltarTitulo(r.title, q) : escapeHtml(r.title);
        const snippet =
          r.match === 'title' && (!r.headline || r.headline === r.title)
            ? '<em style="opacity:.7">Coincidencia en el título</em>'
            : formatHeadline(r.headline);
        return `<button type="button" class="search-item ${idx === active ? 'active' : ''}" role="option" data-open="${r.id}" data-idx="${idx}">
          <span class="search-item-badge ${badge.cls}">${badge.label}</span>
          <span class="search-item-title">${titleHtml}</span>
          ${path ? `<span class="search-item-path">${escapeHtml(path)}</span>` : ''}
          <span class="search-item-snippet">${snippet}</span>
        </button>`;
      })
      .join('');
  };

  const resultadosLocales = (q) => {
    const qq = normalizeKey(q);
    return state.pages
      .filter((p) => !qq || normalizeKey(p.title).includes(qq) || (p.title_key || '').includes(qq))
      .map((p) => ({
        id: p.id,
        title: p.title,
        parent_id: p.parent_id,
        match: 'title',
        headline: p.title,
        rank: 1,
      }));
  };

  const correrBusqueda = async (q) => {
    const my = ++reqId;
    meta.innerHTML = `Buscando <strong>${escapeHtml(q)}</strong>…`;
    try {
      const data = await api.search(q);
      if (my !== reqId) return;
      results = data.results || [];
      active = 0;
      const n = results.length;
      meta.innerHTML =
        n === 0
          ? `Sin resultados para <strong>${escapeHtml(q)}</strong>`
          : `<span><strong>${n}</strong> ${n === 1 ? 'página' : 'páginas'} con coincidencias</span><span>Título y contenido</span>`;
      renderResults(q);
    } catch {
      if (my !== reqId) return;
      meta.textContent = 'No se pudo buscar. Reintenta.';
    }
  };

  const onQuery = (q) => {
    clearTimeout(debounce);
    if (!q) {
      reqId += 1;
      results = state.pages.slice(0, 12).map((p) => ({
        id: p.id,
        title: p.title,
        parent_id: p.parent_id,
        match: 'title',
        headline: 'Página de la wiki',
        rank: 0,
      }));
      active = 0;
      meta.innerHTML = `<span>Páginas recientes del árbol</span><span>${state.pages.length} en total</span>`;
      renderResults('');
      return;
    }
    if (q.length === 1) {
      results = resultadosLocales(q);
      active = 0;
      meta.innerHTML = `Filtrando títulos… escribe otra letra para buscar en el contenido`;
      renderResults(q);
      return;
    }
    // Instantáneo por título mientras llega el FTS.
    results = resultadosLocales(q);
    active = 0;
    meta.innerHTML = `Buscando en contenido…`;
    renderResults(q);
    debounce = setTimeout(() => correrBusqueda(q), 180);
  };

  input.addEventListener('input', () => onQuery(input.value.trim()));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(active - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[active];
      if (hit) {
        closeModal();
        abrirPagina(hit.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
    }
  });

  list.addEventListener('mousemove', (e) => {
    const item = e.target.closest('.search-item');
    if (!item) return;
    const idx = Number(item.dataset.idx);
    if (Number.isInteger(idx) && idx !== active) setActive(idx);
  });

  onQuery('');
}

/* ——— Autocomplete [[ ——— */
const acMenu = document.createElement('div');
acMenu.className = 'ac-menu';
acMenu.id = 'ac-menu';
document.body.appendChild(acMenu);

function showAutocomplete(textarea) {
  const val = textarea.value;
  const pos = textarea.selectionStart;
  const before = val.slice(0, pos);
  const m = before.match(/\[\[([^\]]{0,60})$/);
  if (!m) {
    acMenu.classList.remove('show');
    return;
  }
  const q = normalizeKey(m[1]);
  const hits = state.pages
    .filter((p) => !q || normalizeKey(p.title).includes(q) || (p.title_key || '').includes(q))
    .slice(0, 8);
  if (!hits.length) {
    acMenu.classList.remove('show');
    return;
  }
  acMenu.innerHTML = hits
    .map((p, i) => `<button class="ac-item ${i === 0 ? 'active' : ''}" data-title="${escapeHtml(p.title)}">${escapeHtml(p.title)}</button>`)
    .join('');
  const rect = textarea.getBoundingClientRect();
  acMenu.style.left = `${rect.left + 16}px`;
  acMenu.style.top = `${rect.top + 40}px`;
  acMenu.classList.add('show');
}

function insertWikilink(title) {
  const ta = $('#md-input');
  const val = ta.value;
  const pos = ta.selectionStart;
  const before = val.slice(0, pos);
  const after = val.slice(pos);
  const m = before.match(/\[\[([^\]]{0,60})$/);
  if (!m) return;
  const start = before.length - m[0].length;
  ta.value = `${val.slice(0, start)}[[${title}]]${after}`;
  const np = start + title.length + 4;
  ta.selectionStart = ta.selectionEnd = np;
  acMenu.classList.remove('show');
  markDirty();
  ta.focus();
}

/* ——— Import / Export ——— */
async function exportarZip() {
  setStatus('saving', 'Exportando…');
  try {
    const data = await api.exportar();
    const zip = new window.JSZip();
    for (const f of data.files || []) zip.file(f.path, f.content);
    for (const a of data.assets || []) zip.file(a.path, a.base64, { base64: true });
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tubroki-wiki-${new Date().toISOString().slice(0, 10)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('ok', 'Exportado');
  } catch (e) {
    setStatus('error', e.message);
    banner('err', escapeHtml(e.message));
  }
}

async function importarZip(file) {
  setStatus('saving', 'Importando…');
  try {
    const zip = await window.JSZip.loadAsync(file);
    const assets = [];
    const mdFiles = [];

    const paths = Object.keys(zip.files).filter((p) => !zip.files[p].dir);
    for (const path of paths) {
      const entry = zip.files[path];
      if (/\.(png|jpe?g|gif|webp|pdf)$/i.test(path)) {
        const base64 = await entry.async('base64');
        const ext = path.split('.').pop().toLowerCase();
        const mime =
          { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', pdf: 'application/pdf' }[
            ext
          ] || 'application/octet-stream';
        assets.push({ path, mime_type: mime, base64, original_name: path.split('/').pop() });
      } else if (/\.md$/i.test(path)) {
        const content = await entry.async('string');
        const parts = path.replace(/\\/g, '/').split('/');
        mdFiles.push({
          path,
          title: parts[parts.length - 1].replace(/\.md$/i, ''),
          content,
          parent_folder: parts.length > 1 ? parts.slice(0, -1).join('/') : null,
        });
      }
    }

    if (!mdFiles.length && !assets.length) {
      setStatus('error', 'ZIP vacío');
      banner('warn', 'El ZIP no trae archivos .md ni imágenes.');
      return;
    }

    // Las carpetas se vuelven páginas contenedoras. Hay que incluir también las
    // intermedias (ej. "a/b/c" requiere "a" y "a/b"), aunque no tengan .md propio.
    const folderSet = new Set();
    for (const f of mdFiles) {
      if (!f.parent_folder) continue;
      const parts = f.parent_folder.split('/');
      for (let i = 1; i <= parts.length; i += 1) {
        folderSet.add(parts.slice(0, i).join('/'));
      }
    }
    const folders = [...folderSet].sort((a, b) => a.split('/').length - b.split('/').length);
    const folderId = new Map();
    for (const folder of folders) {
      const parts = folder.split('/');
      const name = parts[parts.length - 1];
      const parentFolder = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
      const page = await api.crear({
        title: name,
        parent_id: parentFolder ? folderId.get(parentFolder) : null,
        content: '',
        source: 'import',
      });
      folderId.set(folder, page.id);
    }

    // Assets de a dos: cada uno viaja en base64 y el cuerpo de la función
    // serverless no puede pasar de ~4,5 MB.
    const assetBatches = [];
    for (let i = 0; i < assets.length; i += 2) assetBatches.push(assets.slice(i, i + 2));
    let assetMap = {};
    for (const [i, batch] of assetBatches.entries()) {
      setStatus('saving', `Subiendo archivos ${i + 1}/${assetBatches.length}…`);
      const r = await api.importar({ items: [], assets: batch, resolve_links: false });
      assetMap = { ...assetMap, ...(r.asset_map || {}) };
    }

    // Páginas md
    const items = mdFiles.map((f) => ({
      path: f.path,
      title: f.title,
      content: f.content,
      parent_id: f.parent_folder ? folderId.get(f.parent_folder) : null,
    }));
    const pageBatches = [];
    for (let i = 0; i < items.length; i += 10) pageBatches.push(items.slice(i, i + 10));
    let created = 0;
    let omitted = [];
    let unresolved = [];
    for (const [i, batch] of pageBatches.entries()) {
      setStatus('saving', `Creando páginas ${i + 1}/${pageBatches.length}…`);
      const r = await api.importar({
        items: batch,
        assets: [],
        asset_map: assetMap,
        resolve_links: true,
      });
      created += r.created || 0;
      omitted = omitted.concat(r.omitted || []);
      unresolved = r.unresolved || unresolved;
    }

    cache.invalidateAll();
    await cargarArbol({ force: true });
    setStatus('ok', `Importadas ${created} páginas`);
    banner(
      'info',
      `Importación lista: <strong>${created}</strong> páginas` +
        (omitted.length ? `, ${omitted.length} omitidas` : '') +
        (unresolved.length ? `, ${unresolved.length} enlaces sin resolver` : '') +
        `.`,
    );
    // Recalienta contenidos en idle tras un import grande.
    void prefetchMissingContents();
  } catch (e) {
    setStatus('error', e.message);
    banner('err', escapeHtml(e.message));
  }
}

async function pegarImagen(file) {
  if (!state.current) return;
  if (!file) return;
  const okMime = /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/i.test(file.type);
  if (!okMime) {
    banner('err', 'Solo se admiten JPEG, PNG, GIF, WebP o PDF (máx. 3 MB).');
    return;
  }
  setStatus('saving', 'Subiendo imagen…');
  try {
    const asset = await api.subirAsset(file);
    const ta = $('#md-input');
    const nombre = (file.name || 'archivo').replace(/[\[\]]/g, '');
    const insert =
      file.type === 'application/pdf'
        ? `[${nombre}](asset:${asset.id})`
        : `![${nombre}](asset:${asset.id})`;
    const pos = ta.selectionStart ?? ta.value.length;
    ta.value = `${ta.value.slice(0, pos)}${insert}${ta.value.slice(pos)}`;
    ta.selectionStart = ta.selectionEnd = pos + insert.length;
    markDirty();
    setStatus('ok', file.type.startsWith('image/') ? 'Imagen subida' : 'Archivo subido');
    // Tras subir, muestra la vista previa con la imagen ya visible.
    setMode('preview');
  } catch (e) {
    setStatus('error', e.message);
    banner('err', escapeHtml(e.message));
  }
}

function esMimeDocumento(file) {
  if (!file) return false;
  const t = (file.type || '').toLowerCase();
  const n = (file.name || '').toLowerCase();
  if (/^image\/(jpeg|png|gif|webp)$/.test(t)) return true;
  if (t === 'application/pdf') return true;
  if (t === 'text/html') return true;
  if (t === 'text/plain' && (n.endsWith('.html') || n.endsWith('.htm'))) return true;
  // macOS/Finder a veces manda type vacío u octet-stream
  if (
    (!t || t === 'application/octet-stream') &&
    /\.(jpe?g|png|gif|webp|pdf|html?)$/i.test(n)
  ) {
    return true;
  }
  return false;
}

/** Resuelve el padre al soltar un archivo sobre un nodo del árbol. */
function parentIdDesdeNodoArbol(itemEl) {
  if (!itemEl?.dataset?.id) return null;
  const nodo = state.pages.find((p) => p.id === itemEl.dataset.id);
  if (!nodo) return itemEl.dataset.id;
  // Sobre un documento → hermano (mismo padre); sobre Markdown → hijo.
  return nodo.kind === 'file' ? nodo.parent_id : nodo.id;
}

/** Sube un archivo y lo crea como página hija kind=file. */
async function subirDocumentoComoHija(file, parentId = null) {
  if (!file) return;
  if (!esMimeDocumento(file)) {
    banner('err', 'Solo se admiten JPEG, PNG, GIF, WebP, PDF o HTML (máx. 3 MB).');
    return;
  }
  if (file.size > 3 * 1024 * 1024) {
    banner('err', 'El archivo supera el máximo de 3 MB.');
    return;
  }
  setStatus('saving', 'Subiendo documento…');
  try {
    const page = await api.crearDocumento(file, {
      parentId: parentId ?? state.current?.id ?? null,
    });
    cache.setPage(page);
    cache.invalidateTree();
    await cargarArbol({ force: true });
    setStatus('ok', 'Documento creado');
    await abrirPagina(page.id, { force: true });
  } catch (e) {
    setStatus('error', e.message);
    banner('err', escapeHtml(e.message));
  }
}

async function reemplazarDocumentoActual(file) {
  if (!state.current || state.current.kind !== 'file') return;
  if (!esMimeDocumento(file)) {
    banner('err', 'Solo se admiten JPEG, PNG, GIF, WebP, PDF o HTML (máx. 3 MB).');
    return;
  }
  setStatus('saving', 'Reemplazando archivo…');
  try {
    const page = await api.reemplazarDocumento(state.current.id, file);
    cache.setPage(page);
    cache.invalidateTree();
    await cargarArbol({ force: true });
    setStatus('ok', 'Archivo reemplazado');
    await abrirPagina(page.id, { force: true });
  } catch (e) {
    setStatus('error', e.message);
    banner('err', escapeHtml(e.message));
  }
}

async function descargarDocumentoActual() {
  if (!state.current?.asset_id) return;
  await descargarAssetPorId(
    state.current.asset_id,
    state.current.original_name || `${state.current.title}.bin`,
  );
}

function slugNombreArchivo(titulo, ext = 'md') {
  const base = String(titulo || 'pagina')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.\-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'pagina';
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

function dispararDescarga(blobOrUrl, filename) {
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'archivo';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof blobOrUrl !== 'string') {
    setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
}

async function descargarDesdeUrl(url, filename) {
  try {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const blob = await r.blob();
    dispararDescarga(blob, filename);
  } catch (e) {
    banner('err', escapeHtml(e.message || 'Error al descargar'));
  }
}

async function descargarAssetPorId(assetId, filename) {
  if (!assetId) return;
  await descargarDesdeUrl(api.assetUrl(assetId), filename || `${assetId}.bin`);
}

async function descargarPaginaMarkdown(pageOrId = null) {
  try {
    let page = pageOrId;
    if (typeof pageOrId === 'string') {
      page = cache.getPage(pageOrId) || (await api.obtener(pageOrId));
      if (page) cache.setPage(page);
    }
    if (!page && state.current?.kind !== 'file') page = state.current;
    if (!page || page.kind === 'file') {
      banner('warn', 'Elige una página Markdown para descargar.');
      return;
    }
    const title =
      page.id === state.current?.id ? $('#page-title')?.value || page.title : page.title;
    const content =
      page.id === state.current?.id
        ? $('#md-input')?.value ?? page.draft_content ?? page.version?.content ?? ''
        : page.draft_content ?? page.version?.content ?? '';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    dispararDescarga(blob, slugNombreArchivo(title, 'md'));
  } catch (e) {
    banner('err', escapeHtml(e.message || 'Error al descargar'));
  }
}

async function guardarNotaDocumento() {
  if (!state.current || state.current.kind !== 'file') return;
  setStatus('saving', 'Guardando nota…');
  try {
    if (!(await renombrarSiHaceFalta())) {
      setStatus('dirty', 'Cambios sin guardar');
      return;
    }
    const note = $('#doc-notes').value;
    const r = await api.guardar(state.current.id, {
      title: $('#page-title').value,
      content: note,
      base_version_id: state.current.current_version_id,
      message: 'Nota del documento',
    });
    if (r.page) cache.setPage(r.page);
    cache.invalidateVersions(state.current.id);
    state.dirty = false;
    setStatus('ok', 'Nota guardada');
    await abrirPagina(state.current.id, { force: true });
  } catch (e) {
    if (e.code === 'no_changes') {
      state.dirty = false;
      setStatus('ok', 'Sin cambios');
      return;
    }
    setStatus('error', e.message);
    banner('err', escapeHtml(e.message));
  }
}

/* ——— Sidebar resize ——— */
const SIDEBAR_W_KEY = 'wiki.sidebarW';
const SIDEBAR_W_MIN = 180;
const SIDEBAR_W_MAX = 520;
const SIDEBAR_W_DEFAULT = 280;

function clampSidebarW(px) {
  const max = Math.min(SIDEBAR_W_MAX, Math.floor(window.innerWidth * 0.55));
  return Math.max(SIDEBAR_W_MIN, Math.min(max, Math.round(px)));
}

function setSidebarWidth(px, { persist = true } = {}) {
  const w = clampSidebarW(px);
  document.documentElement.style.setProperty('--sidebar-w', `${w}px`);
  const handle = $('#sidebar-resizer');
  if (handle) {
    handle.setAttribute('aria-valuenow', String(w));
    handle.setAttribute('aria-valuemin', String(SIDEBAR_W_MIN));
    handle.setAttribute('aria-valuemax', String(SIDEBAR_W_MAX));
  }
  if (persist) localStorage.setItem(SIDEBAR_W_KEY, String(w));
  return w;
}

function aplicarAnchoSidebarGuardado() {
  const raw = Number(localStorage.getItem(SIDEBAR_W_KEY));
  setSidebarWidth(Number.isFinite(raw) && raw > 0 ? raw : SIDEBAR_W_DEFAULT, { persist: false });
}

function wireSidebarResize() {
  const handle = $('#sidebar-resizer');
  if (!handle) return;

  handle.setAttribute('aria-valuemin', String(SIDEBAR_W_MIN));
  handle.setAttribute('aria-valuemax', String(SIDEBAR_W_MAX));

  let dragging = false;

  const onMove = (clientX) => {
    if (!dragging) return;
    setSidebarWidth(clientX);
  };

  const stop = () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('resizing-sidebar');
  };

  handle.addEventListener('pointerdown', (e) => {
    if (window.matchMedia('(max-width:640px)').matches) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    document.body.classList.add('resizing-sidebar');
    handle.setPointerCapture?.(e.pointerId);
    onMove(e.clientX);
  });

  handle.addEventListener('pointermove', (e) => onMove(e.clientX));
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
  handle.addEventListener('lostpointercapture', stop);

  handle.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 32 : 16;
    const cur =
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) ||
      SIDEBAR_W_DEFAULT;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSidebarWidth(cur - step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSidebarWidth(cur + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_W_MIN);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSidebarWidth(SIDEBAR_W_MAX);
    }
  });

  handle.addEventListener('dblclick', () => setSidebarWidth(SIDEBAR_W_DEFAULT));

  window.addEventListener('resize', () => {
    const cur =
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w')) ||
      SIDEBAR_W_DEFAULT;
    setSidebarWidth(cur, { persist: true });
  });
}

/* ——— Events ——— */
function wireEvents() {
  aplicarAnchoSidebarGuardado();
  wireSidebarResize();

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  const kbd = document.querySelector('.search-trigger-kbd');
  if (kbd) kbd.textContent = isMac ? '⌘K' : 'Ctrl K';

  $('#btn-nueva')?.addEventListener('click', () => crearPagina(null));
  $('#btn-sub')?.addEventListener('click', () => {
    if (!state.current) return crearPagina(null);
    // Subpágina Markdown solo bajo páginas Markdown (o raíz).
    if (state.current.kind === 'file') {
      banner('warn', 'Los documentos no tienen subpáginas. Elige una página Markdown como madre.');
      return;
    }
    crearPagina(state.current.id);
  });
  $('#btn-subir-doc')?.addEventListener('click', () => {
    const parent = state.current?.kind === 'file' ? state.current.parent_id : state.current?.id;
    state._uploadParentId = parent ?? null;
    $('#file-documento')?.click();
  });
  $('#file-documento')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    const parentId = state._uploadParentId ?? null;
    state._uploadParentId = undefined;
    if (f) void subirDocumentoComoHija(f, parentId);
    e.target.value = '';
  });
  $('#btn-guardar')?.addEventListener('click', abrirDialogoGuardar);
  $('#btn-crear-primera')?.addEventListener('click', () => crearPagina(null));
  $('#btn-importar-vacio')?.addEventListener('click', () => $('#file-import').click());
  $('#btn-buscar')?.addEventListener('click', openCommandPalette);
  $('#btn-theme')?.addEventListener('click', toggleTheme);
  $('#btn-export')?.addEventListener('click', exportarZip);
  $('#btn-import')?.addEventListener('click', () => $('#file-import').click());
  $('#btn-insertar-imagen')?.addEventListener('click', () => {
    if (!state.current || state.current.kind === 'file') {
      banner('warn', 'Abre una página Markdown para insertar una imagen en el texto.');
      return;
    }
    $('#file-imagen')?.click();
  });
  $('#file-imagen')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) void pegarImagen(f);
    e.target.value = '';
  });
  $('#btn-descargar-doc')?.addEventListener('click', () => void descargarDocumentoActual());
  $('#btn-descargar-md')?.addEventListener('click', () => void descargarPaginaMarkdown());
  $('#btn-reemplazar-doc')?.addEventListener('click', () => $('#file-reemplazar')?.click());
  $('#file-reemplazar')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) void reemplazarDocumentoActual(f);
    e.target.value = '';
  });
  $('#btn-eliminar-doc')?.addEventListener('click', () => $('#btn-eliminar')?.click());
  $('#btn-guardar-nota')?.addEventListener('click', () => void guardarNotaDocumento());
  $('#doc-notes')?.addEventListener('input', markDirty);
  $('#file-import')?.addEventListener('change', (e) => {
    const f = e.target.files?.[0];
    if (f) importarZip(f);
    e.target.value = '';
  });
  $('#btn-papelera')?.addEventListener('click', async () => {
    state.showTrash = !state.showTrash;
    $('#btn-papelera').classList.toggle('btn-primary', state.showTrash);
    if (state.showTrash) await cargarPapelera();
    else renderTree();
  });
  $('#btn-toggle-side')?.addEventListener('click', () => {
    $('#sidebar').classList.toggle('collapsed');
    $('#sidebar').classList.toggle('mobile-open');
  });
  $('#btn-toggle-panel')?.addEventListener('click', () => $('#panel').classList.toggle('collapsed'));
  $('#btn-mode-edit')?.addEventListener('click', () => setMode('edit'));
  $('#btn-mode-preview')?.addEventListener('click', () => setMode('preview'));
  $('#btn-descartar')?.addEventListener('click', async () => {
    if (!state.current) return;
    const ok = await pedirConfirmacion({
      titulo: 'Descartar borrador',
      descripcion: 'Pierdes los cambios sin guardar y vuelves a la última versión guardada.',
      ok: 'Descartar',
    });
    if (ok !== true) return;
    clearTimeout(draftTimer);
    state.dirty = false;
    await api.descartarDraft(state.current.id);
    cache.invalidatePage(state.current.id);
    cache.patchTreePage(state.current.id, { has_draft: false });
    await abrirPagina(state.current.id, { force: true });
  });
  $('#btn-eliminar')?.addEventListener('click', async () => {
    if (!state.current) return;
    const ok = await pedirConfirmacion({
      titulo: 'Mover a la papelera',
      descripcion: `«${state.current.title}» deja de aparecer en el árbol y sus enlaces quedan sin resolver. Puedes recuperarla desde la papelera.`,
      ok: 'Mover a la papelera',
    });
    if (ok !== true) return;
    clearTimeout(draftTimer);
    state.dirty = false;
    await api.eliminar(state.current.id);
    cache.invalidatePage(state.current.id);
    cache.invalidateTree();
    state.current = null;
    $('#editor-main').style.display = 'none';
    $('#editor-empty').style.display = 'block';
    $('#crumbs').innerHTML = '<span>Elige una página o crea una nueva</span>';
    setStatus('', 'Listo');
    await cargarArbol({ force: true });
  });

  $$('.panel-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.panel = tab.dataset.panel;
      $$('.panel-tab').forEach((t) => t.classList.toggle('active', t.dataset.panel === state.panel));
      if (state.panel === 'historial') void cargarHistorial();
      else if (state.panel === 'backlinks') void cargarBacklinks();
      else renderPanel();
    });
  });

  $('#tree').addEventListener('click', async (e) => {
    const toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      const id = toggle.dataset.toggle;
      if (state.collapsed.has(id)) state.collapsed.delete(id);
      else state.collapsed.add(id);
      localStorage.setItem('wiki.collapsed', JSON.stringify([...state.collapsed]));
      renderTree();
      return;
    }
    const restore = e.target.closest('[data-restore]');
    if (restore) {
      await api.recuperar(restore.dataset.restore);
      state.showTrash = false;
      cache.invalidateAll();
      await cargarArbol({ force: true });
      void prefetchMissingContents();
      return;
    }
    const dlAsset = e.target.closest('[data-download-asset]');
    if (dlAsset) {
      e.preventDefault();
      e.stopPropagation();
      await descargarAssetPorId(dlAsset.dataset.downloadAsset, dlAsset.dataset.downloadName);
      return;
    }
    const dlPage = e.target.closest('[data-download-page]');
    if (dlPage) {
      e.preventDefault();
      e.stopPropagation();
      await descargarPaginaMarkdown(dlPage.dataset.downloadPage);
      return;
    }
    const item = e.target.closest('[data-id]');
    if (item) await abrirPagina(item.dataset.id);
  });

  // Arrastrar: el tercio superior/inferior reordena entre hermanos, el centro
  // convierte la página en subpágina del destino.
  // Archivos del SO → página hija kind=file bajo el nodo resaltado.
  let dragId = null;
  let fileDropTargetId = null;

  const limpiarDrop = () =>
    $$('.tree-item').forEach((el) =>
      el.classList.remove('drag-over', 'drop-before', 'drop-after', 'drop-file'),
    );

  const marcarDropArchivo = (item) => {
    $$('.tree-item').forEach((el) => el.classList.remove('drop-file'));
    if (!item) {
      fileDropTargetId = null;
      return;
    }
    item.classList.add('drop-file');
    fileDropTargetId = item.dataset.id || null;
  };

  const zonaDe = (item, clientY) => {
    const r = item.getBoundingClientRect();
    const rel = (clientY - r.top) / r.height;
    if (rel < 0.3) return 'before';
    if (rel > 0.7) return 'after';
    return 'inside';
  };

  const esArrastreDeArchivos = (dt) =>
    [...(dt?.types || [])].includes('Files');

  $('#tree').addEventListener('dragstart', (e) => {
    if (e.target.closest?.('.tree-dl')) {
      e.preventDefault();
      return;
    }
    const item = e.target.closest('[data-id]');
    if (!item) return;
    dragId = item.dataset.id;
    fileDropTargetId = null;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });

  // dragenter + dragover con preventDefault: sin eso el navegador no acepta el drop.
  $('#tree').addEventListener('dragenter', (e) => {
    if (!esArrastreDeArchivos(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    const item = e.target.closest?.('[data-id]');
    if (item) marcarDropArchivo(item);
  });

  $('#tree').addEventListener('dragover', (e) => {
    e.preventDefault();
    const item = e.target.closest('[data-id]');
    if (esArrastreDeArchivos(e.dataTransfer)) {
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      limpiarDrop();
      if (item) marcarDropArchivo(item);
      return;
    }
    limpiarDrop();
    if (!item || !dragId || item.dataset.id === dragId) return;
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const zona = zonaDe(item, e.clientY);
    item.classList.add(zona === 'inside' ? 'drag-over' : `drop-${zona}`);
  });

  $('#tree').addEventListener('dragleave', (e) => {
    const related = e.relatedTarget;
    // Solo limpiar al salir del árbol (no al cruzar spans hijos del mismo ítem).
    if (related && $('#tree')?.contains(related)) {
      const nextItem = related.closest?.('[data-id]');
      if (nextItem && esArrastreDeArchivos(e.dataTransfer)) {
        marcarDropArchivo(nextItem);
        return;
      }
      if (nextItem) return;
    }
    limpiarDrop();
    fileDropTargetId = null;
  });

  $('#tree').addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) {
      const itemEl =
        e.target.closest('[data-id]') ||
        (fileDropTargetId
          ? $(`.tree-item[data-id="${fileDropTargetId}"]`)
          : null);
      const parentId = parentIdDesdeNodoArbol(itemEl);
      const docs = files.filter((f) => esMimeDocumento(f));
      limpiarDrop();
      fileDropTargetId = null;
      dragId = null;
      if (!docs.length) {
        banner('err', 'Solo se admiten JPEG, PNG, GIF, WebP, PDF o HTML (máx. 3 MB).');
        return;
      }
      for (const f of docs) {
        await subirDocumentoComoHija(f, parentId);
      }
      return;
    }

    limpiarDrop();
    fileDropTargetId = null;
    const item = e.target.closest('[data-id]');
    if (!dragId || !item || dragId === item.dataset.id) {
      dragId = null;
      return;
    }

    const destino = state.pages.find((p) => p.id === item.dataset.id);
    const movida = state.pages.find((p) => p.id === dragId);
    if (!destino || !movida) return;

    // Soltar una página dentro de su propia descendencia crearía un ciclo.
    if (esDescendiente(destino.id, movida.id)) {
      banner('warn', 'No puedes mover una página dentro de una de sus subpáginas.');
      dragId = null;
      return;
    }

    const zona = zonaDe(item, e.clientY);
    // Los documentos no tienen hijas: "inside" sobre un file = hermano (after).
    const zonaEfectiva = zona === 'inside' && destino.kind === 'file' ? 'after' : zona;
    let cambios;
    if (zonaEfectiva === 'inside') {
      const hijos = childrenOf(destino.id).filter((p) => p.id !== dragId);
      cambios = {
        parent_id: destino.id,
        position: positionBetween(hijos.at(-1)?.position || null, null),
      };
      state.collapsed.delete(destino.id);
    } else {
      const hermanos = childrenOf(destino.parent_id).filter((p) => p.id !== dragId);
      const i = hermanos.findIndex((p) => p.id === destino.id);
      const [antes, despues] =
        zonaEfectiva === 'before'
          ? [hermanos[i - 1]?.position || null, destino.position]
          : [destino.position, hermanos[i + 1]?.position || null];
      cambios = {
        parent_id: destino.parent_id,
        position: positionBetween(antes, despues),
      };
    }

    dragId = null;
    try {
      await api.actualizar(movida.id, cambios);
      cache.invalidatePage(movida.id);
      cache.invalidateTree();
      await cargarArbol({ force: true });
    } catch (err) {
      banner('err', escapeHtml(err.message));
    }
  });

  $('#panel-body').addEventListener('click', async (e) => {
    const open = e.target.closest('[data-open]');
    if (open) {
      closeModal();
      await abrirPagina(open.dataset.open);
      return;
    }
    const diff = e.target.closest('[data-diff]');
    if (diff) {
      await mostrarDiff(diff.dataset.diff);
      return;
    }
    const restore = e.target.closest('[data-restore-v]');
    if (restore) {
      const ok = await pedirConfirmacion({
        titulo: 'Restaurar versión',
        descripcion: 'No se borra nada: se crea una versión nueva con ese contenido.',
        ok: 'Restaurar',
      });
      if (ok !== true) return;
      try {
        await api.restaurar(state.current.id, restore.dataset.restoreV);
        cache.invalidatePage(state.current.id);
        cache.invalidateVersions(state.current.id);
        await abrirPagina(state.current.id, { force: true });
        await cargarArbol({ force: true });
      } catch (err) {
        banner('err', escapeHtml(err.message));
      }
    }
  });

  $('#page-title').addEventListener('input', markDirty);
  $('#md-input').addEventListener('input', () => {
    markDirty();
    showAutocomplete($('#md-input'));
    if (state.mode === 'preview') void renderPreview();
  });
  $('#md-input').addEventListener('keydown', (e) => {
    if (acMenu.classList.contains('show') && e.key === 'Enter') {
      const active = acMenu.querySelector('.ac-item.active');
      if (active) {
        e.preventDefault();
        insertWikilink(active.dataset.title);
      }
    }
  });
  acMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-title]');
    if (item) insertWikilink(item.dataset.title);
  });

  $('#md-preview').addEventListener('click', async (e) => {
    const dlBtn = e.target.closest('.preview-dl');
    if (dlBtn) {
      e.preventDefault();
      e.stopPropagation();
      if (dlBtn.dataset.blobSrc) {
        dispararDescarga(dlBtn.dataset.blobSrc, dlBtn.dataset.downloadName || 'archivo');
      } else if (dlBtn.dataset.assetId) {
        await descargarAssetPorId(dlBtn.dataset.assetId, dlBtn.dataset.downloadName);
      }
      return;
    }
    const assetLink = e.target.closest('a.asset-file');
    if (assetLink) {
      e.preventDefault();
      const id =
        assetLink.dataset.assetId ||
        (assetLink.getAttribute('href') || '').match(/[?&]id=([0-9a-f-]{36})/i)?.[1];
      const name =
        assetLink.dataset.downloadName ||
        assetLink.textContent.trim() ||
        'archivo';
      if (id) await descargarAssetPorId(id, name);
      return;
    }
    const img = e.target.closest('img.preview-img');
    if (img?.dataset.fullSrc) {
      e.preventDefault();
      abrirLightbox(img.dataset.fullSrc, img.dataset.caption || img.alt || '', {
        assetId: img.dataset.assetId,
        filename: img.dataset.downloadName || img.alt || 'imagen',
      });
      return;
    }
    const a = e.target.closest('a.wikilink');
    if (!a) return;
    e.preventDefault();
    if (a.dataset.page) {
      await abrirPagina(a.dataset.page);
      return;
    }
    if (!a.dataset.create) return;
    const ok = await pedirConfirmacion({
      titulo: 'Enlace sin resolver',
      descripcion: `La página «${a.dataset.create}» todavía no existe. ¿La creas ahora? Los enlaces que la mencionan quedarán resueltos.`,
      ok: 'Crear página',
    });
    if (ok !== true) return;
    try {
      const page = await api.crear({ title: a.dataset.create, content: '' });
      cache.setPage(page);
      cache.invalidateTree();
      await cargarArbol({ force: true });
      await abrirPagina(page.id, { force: true });
    } catch (err) {
      banner('err', escapeHtml(err.message));
    }
  });

  $('#img-lightbox-close')?.addEventListener('click', cerrarLightbox);
  $('#img-lightbox-download')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const img = $('#img-lightbox-img');
    if (!img) return;
    if (img.dataset.assetId) {
      await descargarAssetPorId(img.dataset.assetId, img.dataset.downloadName || img.alt || 'imagen');
      return;
    }
    if (img.src) dispararDescarga(img.src, img.dataset.downloadName || img.alt || 'imagen');
  });
  $('#img-lightbox')?.addEventListener('click', (e) => {
    if (e.target === $('#img-lightbox')) cerrarLightbox();
  });

  $('#md-input').addEventListener('paste', (e) => {
    const items = [...(e.clipboardData?.items || [])];
    const img = items.find((i) => i.type.startsWith('image/'));
    if (img) {
      e.preventDefault();
      pegarImagen(img.getAsFile());
    }
  });

  // Arrastrar imagen/PDF al editor.
  const pane = document.querySelector('.editor-pane');
  if (pane) {
    pane.addEventListener('dragover', (e) => {
      if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
      e.preventDefault();
      pane.classList.add('drag-file');
    });
    pane.addEventListener('dragleave', (e) => {
      if (e.target === pane) pane.classList.remove('drag-file');
    });
    pane.addEventListener('drop', (e) => {
      pane.classList.remove('drag-file');
      const file = [...(e.dataTransfer?.files || [])].find(
        (f) => f.type.startsWith('image/') || f.type === 'application/pdf',
      );
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      void pegarImagen(file);
    });
  }

  document.addEventListener('click', (e) => {
    if (e.target.matches('[data-close-modal]') || e.target === $('#modal-bg')) closeModal();
    const open = e.target.closest('#modal-body [data-open]');
    if (open) {
      closeModal();
      abrirPagina(open.dataset.open);
    }
  });

  document.addEventListener('keydown', (e) => {
    const meta = e.metaKey || e.ctrlKey;
    const modalAbierto = $('#modal-bg').classList.contains('show');
    if (meta && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (!modalAbierto) guardarVersion();
    }
    if (meta && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
    if (meta && e.shiftKey && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      state.panel = 'historial';
      $$('.panel-tab').forEach((t) => t.classList.toggle('active', t.dataset.panel === 'historial'));
      $('#panel').classList.remove('collapsed');
      renderPanel();
    }
    if (e.key === 'Escape') {
      if (!$('#img-lightbox')?.hidden) {
        e.preventDefault();
        cerrarLightbox();
        return;
      }
      closeModal();
      acMenu.classList.remove('show');
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

function setMode(mode) {
  state.mode = mode;
  $('#btn-mode-edit').classList.toggle('btn-primary', mode === 'edit');
  $('#btn-mode-preview').classList.toggle('btn-primary', mode === 'preview');
  $('#md-input').classList.toggle('oculto', mode === 'preview');
  $('#md-preview').classList.toggle('activo', mode === 'preview');
  if (mode === 'preview') void renderPreview();
}

async function bootstrapAlInicio() {
  try {
    const boot = await api.bootstrap();
    cache.setPages(boot.contents || []);
    state.aliases = boot.aliases || [];
    aplicarArbol(boot.pages || []);
    return true;
  } catch (e) {
    console.warn('bootstrap falló, fallback a árbol', e);
    await cargarArbol({ force: true });
    void prefetchMissingContents();
    return false;
  }
}

/** Si no hubo bootstrap (o tras import), baja contenidos en idle con concurrencia baja. */
async function prefetchMissingContents() {
  const faltan = state.pages.map((p) => p.id).filter((id) => !cache.getPage(id));
  if (!faltan.length) return;
  const cola = [...faltan];
  const workers = Array.from({ length: Math.min(4, cola.length) }, async () => {
    while (cola.length) {
      const id = cola.shift();
      try {
        const page = await api.obtener(id);
        cache.setPage(page);
      } catch {
        /* ignore */
      }
    }
  });
  await Promise.all(workers);
}

function onWindowFocus() {
  const ahora = Date.now();
  if (ahora - lastFocusRevalidate < 30_000) return;
  lastFocusRevalidate = ahora;
  void revalidateArbol();
  if (state.current && !state.dirty) {
    void revalidatePage(state.current.id, abrirSeq);
  }
}

async function init() {
  // sesión
  try {
    const r = await fetch('/api/auth/sesion', { credentials: 'same-origin' });
    const data = await r.json();
    if (!data.activa) {
      location.href = '/acceso';
      return;
    }
  } catch {
    location.href = '/acceso';
    return;
  }

  if (window.mermaid) {
    applyMermaidTheme(resolvedTheme());
  }

  if (window.marked) {
    window.marked.use({
      gfm: true,
      breaks: true,
      renderer: {
        code({ text, lang }) {
          if (lang === 'mermaid') {
            return `<div class="mermaid">${escapeHtml(text)}</div>\n`;
          }
        },
      },
    });
  }

  syncThemeButton();
  wireEvents();
  window.addEventListener('focus', onWindowFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') onWindowFocus();
  });

  await bootstrapAlInicio();

  const hash = location.hash.replace(/^#/, '');
  if (hash) {
    try {
      await abrirPagina(decodeURIComponent(hash));
    } catch {
      $('#editor-empty').style.display = 'block';
    }
  } else if (state.pages.length) {
    // no auto-open
    $('#editor-empty').style.display = 'block';
  } else {
    $('#editor-empty').style.display = 'block';
  }
}

init().catch((e) => {
  console.error(e);
  banner('err', escapeHtml(e.message || 'Error al iniciar'));
});
