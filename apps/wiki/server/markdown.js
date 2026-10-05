/**
 * Normalización de títulos, extracción de wikilinks/assets y utilidades de Markdown.
 */

const WIKILINK_RE = /(?<!!)\[\[([^\]|#]+)(?:\|[^\]]+)?(?:#[^\]]+)?\]\]/g;
const EMBED_WIKILINK_RE = /!\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
const ASSET_RE = /!\[[^\]]*\]\(asset:([0-9a-f-]{36})\)/gi;
const MD_IMAGE_RE = /!\[[^\]]*\]\(([^)]+)\)/g;

/** Normaliza título como en SQL (aprox. sin unaccent completo en Node). */
export function normalizeTitle(title) {
  return String(title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function extractWikilinks(markdown) {
  const keys = new Set();
  const text = String(markdown || '');
  for (const m of text.matchAll(WIKILINK_RE)) {
    const key = normalizeTitle(m[1]);
    if (key) keys.add(key);
  }
  return [...keys];
}

export function extractAssetIds(markdown) {
  const ids = new Set();
  const text = String(markdown || '');
  for (const m of text.matchAll(ASSET_RE)) {
    ids.add(m[1].toLowerCase());
  }
  return [...ids];
}

/** Extrae frontmatter YAML simple (clave: valor) al inicio del archivo. */
export function parseFrontmatter(raw) {
  const text = String(raw || '');
  if (!text.startsWith('---')) return { metadata: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { metadata: {}, body: text };
  const block = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^[\r\n]+/, '');
  const metadata = {};
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    metadata[m[1]] = val;
  }
  return { metadata, body };
}

export function serializeFrontmatter(metadata, body) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {};
  const keys = Object.keys(meta);
  if (!keys.length) return body || '';
  const lines = keys.map((k) => `${k}: ${String(meta[k])}`);
  return `---\n${lines.join('\n')}\n---\n\n${body || ''}`;
}

/**
 * Indexación fraccionaria simple (lexicográfica a–z0–9).
 * Genera una clave entre `antes` y `despues` (null = extremo).
 */
const ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function positionBetween(antes, despues) {
  const a = antes || '0';
  const b = despues || null;
  if (!b) {
    // al final
    const last = a.slice(-1);
    const idx = ALPHA.indexOf(last);
    if (idx >= 0 && idx < ALPHA.length - 1) {
      return a.slice(0, -1) + ALPHA[idx + 1];
    }
    return a + '0';
  }
  if (a >= b) return a + '0';
  // midpoint naïf: extender a y añadir 'V' (mitad del alfabeto)
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  if (i < a.length && i < b.length) {
    const ai = ALPHA.indexOf(a[i]);
    const bi = ALPHA.indexOf(b[i]);
    if (bi - ai > 1) {
      return a.slice(0, i) + ALPHA[Math.floor((ai + bi) / 2)];
    }
  }
  return a + 'V';
}

export function rewriteAssetRefsForExport(markdown, idToName) {
  return String(markdown || '').replace(ASSET_RE, (full, id) => {
    const name = idToName.get(id.toLowerCase());
    if (!name) return full;
    return full.replace(`asset:${id}`, `assets/${name}`);
  });
}

export { WIKILINK_RE, EMBED_WIKILINK_RE, ASSET_RE, MD_IMAGE_RE };
