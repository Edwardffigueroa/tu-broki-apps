/**
 * Operaciones de edición sobre Markdown (puro).
 */

import { section as getSection, headings } from './outline.mjs';
import { McpToolError } from './errors.mjs';

function parseFrontmatter(raw) {
  const text = String(raw || '');
  if (!text.startsWith('---')) return { metadata: {}, body: text, end: 0 };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { metadata: {}, body: text, end: 0 };
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
  return { metadata, body, end: end + 4 };
}

function serializeFrontmatter(meta, body) {
  const keys = Object.keys(meta || {});
  if (!keys.length) return body || '';
  const lines = keys.map((k) => `${k}: ${String(meta[k])}`);
  return `---\n${lines.join('\n')}\n---\n\n${body || ''}`;
}

/**
 * @param {string} md
 * @param {object[]} ops
 */
export function applyEdits(md, ops) {
  let text = String(md || '');
  const summary = [];
  let i = 0;
  for (const op of ops || []) {
    i += 1;
    const kind = op?.op;
    if (kind === 'append') {
      const t = String(op.text || '');
      text = text.replace(/\s*$/, '') + (text && !text.endsWith('\n') ? '\n' : '') + t;
      if (!text.endsWith('\n')) text += '\n';
      summary.push(`append ${t.length} chars`);
    } else if (kind === 'prepend') {
      const t = String(op.text || '');
      const afterFm = op.after_frontmatter !== false;
      if (afterFm && text.startsWith('---')) {
        const fm = parseFrontmatter(text);
        text = serializeFrontmatter(fm.metadata, t + (fm.body ? `\n${fm.body}` : ''));
      } else {
        text = t + (text.startsWith('\n') ? '' : '\n') + text;
      }
      summary.push(`prepend ${t.length} chars`);
    } else if (kind === 'replace_section') {
      const sec = getSection(text, op.heading);
      if (!sec) throw new McpToolError('section_not_found', `No existe la sección "${op.heading}".`);
      const lines = text.split('\n');
      const keep = op.keep_heading !== false;
      const hs = headings(text);
      const h = hs.find((x) => x.line === sec.start);
      const replacement = keep && h
        ? `${'#'.repeat(h.level)} ${h.text}\n${String(op.text || '').replace(/^\n+/, '')}`
        : String(op.text || '');
      const before = lines.slice(0, sec.start - 1);
      const after = lines.slice(sec.end);
      text = [...before, ...replacement.split('\n'), ...after].join('\n');
      summary.push(`replace_section ${op.heading}`);
    } else if (kind === 'insert_after_heading') {
      const sec = getSection(text, op.heading);
      if (!sec) throw new McpToolError('section_not_found', `No existe la sección "${op.heading}".`);
      const lines = text.split('\n');
      const insertAt = sec.start; // after heading line index
      const chunk = String(op.text || '').split('\n');
      lines.splice(insertAt, 0, ...chunk);
      text = lines.join('\n');
      summary.push(`insert_after_heading ${op.heading}`);
    } else if (kind === 'append_to_section') {
      const sec = getSection(text, op.heading);
      if (!sec) throw new McpToolError('section_not_found', `No existe la sección "${op.heading}".`);
      const lines = text.split('\n');
      const chunk = String(op.text || '').split('\n');
      lines.splice(sec.end, 0, ...chunk);
      text = lines.join('\n');
      summary.push(`append_to_section ${op.heading}`);
    } else if (kind === 'str_replace') {
      const old = String(op.old ?? '');
      const neu = String(op.new ?? '');
      if (!old) throw new McpToolError('validacion', 'str_replace requiere old.');
      const count = text.split(old).length - 1;
      if (count === 0) throw new McpToolError('match_not_found', `No se encontró el texto a reemplazar.`, null, { count: 0 });
      if (count > 1 && !op.all) {
        throw new McpToolError('ambiguous_match', `El texto aparece ${count} veces; usa all:true o haz old más específico.`, null, { count });
      }
      text = op.all ? text.split(old).join(neu) : text.replace(old, neu);
      summary.push(`str_replace ×${op.all ? count : 1}`);
    } else if (kind === 'replace_lines') {
      const lines = text.split('\n');
      const from = Math.max(1, Number(op.from) || 1);
      const to = Math.max(from, Number(op.to) || from);
      const chunk = String(op.text || '').split('\n');
      lines.splice(from - 1, to - from + 1, ...chunk);
      text = lines.join('\n');
      summary.push(`replace_lines ${from}-${to}`);
    } else if (kind === 'delete_section') {
      const sec = getSection(text, op.heading);
      if (!sec) throw new McpToolError('section_not_found', `No existe la sección "${op.heading}".`);
      const lines = text.split('\n');
      lines.splice(sec.start - 1, sec.end - (sec.start - 1));
      text = lines.join('\n');
      summary.push(`delete_section ${op.heading}`);
    } else if (kind === 'set_frontmatter') {
      const fm = parseFrontmatter(text);
      const patch = op.patch || {};
      for (const [k, v] of Object.entries(patch)) {
        if (v == null) delete fm.metadata[k];
        else fm.metadata[k] = String(v);
      }
      text = serializeFrontmatter(fm.metadata, fm.body);
      summary.push('set_frontmatter');
    } else {
      throw new McpToolError('validacion', `Operación desconocida: ${kind}`);
    }
  }
  return { text, applied: i, summary };
}
