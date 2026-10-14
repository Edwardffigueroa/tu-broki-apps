/**
 * Serializa respuestas MCP: text + structuredContent.
 */

export function ok(text, structured = null) {
  const out = {
    content: [{ type: 'text', text: String(text ?? '') }],
  };
  if (structured != null) out.structuredContent = structured;
  return out;
}

export function jsonBlock(obj) {
  return '```json\n' + JSON.stringify(obj, null, 2) + '\n```';
}

export function pageSummary(p) {
  if (!p) return '';
  const bits = [
    `# ${p.title || p.id}`,
    `id: ${p.id}`,
    `title_key: ${p.title_key || ''}`,
    `kind: ${p.kind || 'page'}`,
    p.parent_id ? `parent_id: ${p.parent_id}` : null,
    p.updated_at ? `updated: ${p.updated_at}` : null,
    p.version?.version_number != null ? `version: v${p.version.version_number}` : null,
  ].filter(Boolean);
  return bits.join('\n');
}
