/**
 * Outline / sección / rango sobre Markdown (puro, sin I/O).
 */

function stripFences(md) {
  // Marca líneas dentro de fences para ignorar headings
  const lines = String(md || '').split('\n');
  const inFence = new Array(lines.length).fill(false);
  let fence = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^```/.test(lines[i])) fence = !fence;
    inFence[i] = fence && !/^```/.test(lines[i]);
  }
  return { lines, inFence };
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function headings(md) {
  const { lines, inFence } = stripFences(md);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (inFence[i]) continue;
    const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!m) continue;
    out.push({
      level: m[1].length,
      text: m[2].trim(),
      line: i + 1,
      slug: slugify(m[2]),
    });
  }
  return out;
}

export function outline(md, maxDepth = 3) {
  const hs = headings(md);
  const lines = String(md || '').split('\n');
  const parts = [];
  for (let i = 0; i < hs.length; i++) {
    const h = hs[i];
    if (h.level > maxDepth) continue;
    const start = h.line - 1;
    const end = i + 1 < hs.length ? hs[i + 1].line - 1 : lines.length;
    const sectionText = lines.slice(start, end).join('\n');
    const indent = '  '.repeat(h.level - 1);
    parts.push(`${indent}${'#'.repeat(h.level)} ${h.text} (L${h.line}, ${sectionText.length} chars)`);
  }
  return parts.join('\n') || '(sin headings)';
}

function norm(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function section(md, heading) {
  const hs = headings(md);
  const key = norm(heading);
  const slug = slugify(heading);
  const idx = hs.findIndex((h) => norm(h.text) === key || h.slug === slug);
  if (idx < 0) return null;
  const h = hs[idx];
  const lines = String(md || '').split('\n');
  let end = lines.length;
  for (let j = idx + 1; j < hs.length; j++) {
    if (hs[j].level <= h.level) {
      end = hs[j].line - 1;
      break;
    }
  }
  const start = h.line - 1;
  return { text: lines.slice(start, end).join('\n'), start: start + 1, end };
}

export function slice(md, offset = 0, maxChars = 6000) {
  const text = String(md || '');
  const total = text.length;
  const off = Math.max(0, Math.min(offset, total));
  if (off >= total) return { text: '', next_offset: null, total };
  let end = Math.min(off + maxChars, total);
  if (end < total) {
    const nl = text.lastIndexOf('\n', end);
    if (nl > off + maxChars * 0.5) end = nl;
  }
  const chunk = text.slice(off, end);
  return {
    text: chunk,
    next_offset: end < total ? end : null,
    total,
  };
}

export function wordCount(md) {
  const t = String(md || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}
