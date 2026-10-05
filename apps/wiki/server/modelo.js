/**
 * Validación de entradas de la app wiki.
 */

import { normalizeTitle } from './markdown.js';

export const AUTOR = 'TuBroki';
export const MAX_CONTENT = 1_000_000; // 1 MB de Markdown
// Tope para import/script y file-pages. La UI del browser sigue limitada en la
// práctica por el body ~4,5 MB de Vercel (base64); el import por script no.
export const MAX_ASSET = 20 * 1024 * 1024;
export const MIME_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/html',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export function validarTitulo(titulo) {
  const t = String(titulo || '').trim();
  if (!t) return { ok: false, error: 'El título no puede estar vacío.' };
  if (t.length > 200) return { ok: false, error: 'El título es demasiado largo (máx. 200).' };
  return { ok: true, titulo: t, titleKey: normalizeTitle(t) };
}

export function validarContenido(content) {
  if (content == null) return { ok: true, content: null };
  if (typeof content !== 'string') return { ok: false, error: 'El contenido debe ser texto.' };
  if (content.length > MAX_CONTENT) {
    return { ok: false, error: `El contenido supera el máximo de ${MAX_CONTENT} caracteres.` };
  }
  return { ok: true, content };
}

export function validarAsset({ mimeType, sizeBytes, buffer }) {
  if (!MIME_PERMITIDOS.has(mimeType)) {
    return {
      ok: false,
      error: `Tipo no permitido: ${mimeType}. Usa imagen, PDF, HTML, Office, CSV, TXT o JSON.`,
    };
  }
  if (!buffer || !(buffer instanceof Uint8Array || Buffer.isBuffer(buffer))) {
    return { ok: false, error: 'Falta el contenido del archivo.' };
  }
  const size = sizeBytes ?? buffer.length;
  if (size <= 0 || size > MAX_ASSET) {
    return { ok: false, error: `El archivo debe pesar entre 1 byte y ${MAX_ASSET} bytes.` };
  }
  return { ok: true, size };
}

/** Normaliza MIME raro del navegador (p. ej. HTML como text/plain). */
export function normalizarMime(mimeType, originalName = '') {
  const mime = String(mimeType || '').toLowerCase().trim();
  const name = String(originalName || '').toLowerCase();
  if (mime === 'text/plain' && (name.endsWith('.html') || name.endsWith('.htm'))) {
    return 'text/html';
  }
  if (!mime || mime === 'application/octet-stream') {
    if (name.endsWith('.pdf')) return 'application/pdf';
    if (name.endsWith('.html') || name.endsWith('.htm')) return 'text/html';
    if (name.endsWith('.png')) return 'image/png';
    if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
    if (name.endsWith('.gif')) return 'image/gif';
    if (name.endsWith('.webp')) return 'image/webp';
    if (name.endsWith('.svg')) return 'image/svg+xml';
    if (name.endsWith('.csv')) return 'text/csv';
    if (name.endsWith('.txt')) return 'text/plain';
    if (name.endsWith('.json')) return 'application/json';
    if (name.endsWith('.doc')) return 'application/msword';
    if (name.endsWith('.docx')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (name.endsWith('.xls')) return 'application/vnd.ms-excel';
    if (name.endsWith('.xlsx')) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    if (name.endsWith('.ppt')) return 'application/vnd.ms-powerpoint';
    if (name.endsWith('.pptx')) {
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
  }
  return mime;
}

export function iconoPorMime(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📑';
  if (mimeType === 'text/html') return '🌐';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') {
    return '📊';
  }
  if (mimeType.includes('word') || mimeType === 'application/msword') return '📝';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️';
  return '📎';
}

/** Extensión → MIME para el import del vault. */
export function mimeDesdeNombre(nombre) {
  const n = String(nombre || '').toLowerCase();
  const mapa = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  for (const [ext, mime] of Object.entries(mapa)) {
    if (n.endsWith(ext)) return mime;
  }
  return null;
}
