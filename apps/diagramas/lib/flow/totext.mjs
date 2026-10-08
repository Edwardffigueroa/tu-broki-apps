/**
 * Serialización determinista (contrato §9).
 */

function laneLine(l) {
  const parts = [`"id":${JSON.stringify(l.id)}`, `"name":${JSON.stringify(l.name)}`];
  if (l.color) parts.push(`"color":${JSON.stringify(l.color)}`);
  if (l.height != null) parts.push(`"height":${l.height}`);
  return `    { ${parts.join(', ')} }`;
}

function phaseLine(p) {
  const parts = [`"id":${JSON.stringify(p.id)}`, `"name":${JSON.stringify(p.name)}`];
  if (p.width != null) parts.push(`"width":${p.width}`);
  return `    { ${parts.join(', ')} }`;
}

function nodeLine(n) {
  const parts = [
    `"id":${JSON.stringify(n.id)}`,
    `"lane":${JSON.stringify(n.lane)}`,
    `"type":${JSON.stringify(n.type)}`,
  ];
  if (n.event) parts.push(`"event":${JSON.stringify(n.event)}`);
  parts.push(`"label":${JSON.stringify(n.label)}`);
  parts.push(`"x":${n.x}`);
  parts.push(`"dy":${n.dy}`);
  if (n.w != null) parts.push(`"w":${n.w}`);
  if (n.h != null) parts.push(`"h":${n.h}`);
  if (n.col != null) parts.push(`"col":${n.col}`);
  if (n.slot != null) parts.push(`"slot":${n.slot}`);
  if (n.color) parts.push(`"color":${JSON.stringify(n.color)}`);
  if (n.textColor) parts.push(`"textColor":${JSON.stringify(n.textColor)}`);
  if (n.note) parts.push(`"note":${JSON.stringify(n.note)}`);
  if (n.meta) parts.push(`"meta":${JSON.stringify(n.meta)}`);
  return `    { ${parts.join(', ')} }`;
}

function edgeLine(e) {
  const parts = [
    `"id":${JSON.stringify(e.id)}`,
    `"from":${JSON.stringify(e.from)}`,
    `"to":${JSON.stringify(e.to)}`,
  ];
  if (e.fromHandle) parts.push(`"fromHandle":${JSON.stringify(e.fromHandle)}`);
  if (e.toHandle) parts.push(`"toHandle":${JSON.stringify(e.toHandle)}`);
  parts.push(`"kind":${JSON.stringify(e.kind)}`);
  if (e.label) parts.push(`"label":${JSON.stringify(e.label)}`);
  if (e.center) parts.push(`"center":${JSON.stringify(e.center)}`);
  return `    { ${parts.join(', ')} }`;
}

function docLine(d) {
  const parts = [`"id":${JSON.stringify(d.id)}`];
  if (d.title) parts.push(`"title":${JSON.stringify(d.title)}`);
  parts.push(`"body":${JSON.stringify(d.body)}`);
  return `    { ${parts.join(', ')} }`;
}

export function toText(m) {
  const lines = ['{'];
  lines.push(`  "kind": ${JSON.stringify(m.kind)},`);
  lines.push(`  "version": ${m.version},`);
  lines.push(`  "title": ${JSON.stringify(m.title || '')},`);
  lines.push('  "lanes": [');
  lines.push(m.lanes.map(laneLine).join(',\n'));
  lines.push('  ],');
  lines.push('  "phases": [');
  if (m.phases?.length) lines.push(m.phases.map(phaseLine).join(',\n'));
  lines.push('  ],');
  lines.push('  "nodes": [');
  if (m.nodes.length) lines.push(m.nodes.map(nodeLine).join(',\n'));
  lines.push('  ],');
  lines.push('  "edges": [');
  if (m.edges.length) lines.push(m.edges.map(edgeLine).join(',\n'));
  lines.push('  ],');
  lines.push('  "docs": [');
  if (m.docs?.length) lines.push(m.docs.map(docLine).join(',\n'));
  lines.push('  ]');
  lines.push('}');
  return lines.join('\n');
}
