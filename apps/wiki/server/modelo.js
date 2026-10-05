/**
 * Validación de entradas de la app wiki.
 */

import { normalizeTitle } from './markdown.js';

export const AUTOR = 'TuBroki';
export const MAX_CONTENT = 1_000_000; // 1 MB de Markdown
// El archivo viaja en base64 (+33%) dentro del JSON: 3 MB → ~4 MB de cuerpo,
// por debajo del límite de ~4,5 MB de las funciones de Vercel.
export const MAX_ASSET = 3 * 1024 * 1024;
export const MIME_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/html',
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
      error: `Tipo no permitido: ${mimeType}. Usa JPG, PNG, GIF, WebP, PDF o HTML.`,
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
  }
  return mime;
}

export function iconoPorMime(mimeType) {
  if (!mimeType) return '📄';
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📑';
  if (mimeType === 'text/html') return '🌐';
  return '📎';
}
