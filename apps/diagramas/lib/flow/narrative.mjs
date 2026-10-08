/**
 * Narrativa para IA (contrato §10).
 */

import { absolutePosition, phaseAt } from './geometry.mjs';
import { TYPE_DEFAULTS } from './schema.mjs';

export function toNarrative(m) {
  const lines = [];
  lines.push(`Proceso: ${m.title || 'Sin título'}`);
  lines.push(
    'Descripción paso a paso de cómo funciona el proceso según la interacción entre actores (carriles).',
  );
  lines.push(`Actores (carriles): ${m.lanes.map((l) => l.name).join(' · ')}`);
  if (m.phases?.length) {
    lines.push(`Fases: ${m.phases.map((p) => p.name).join(' → ')}`);
  }
  lines.push('');

  const byId = new Map(m.nodes.map((n) => [n.id, n]));
  const laneName = (id) => m.lanes.find((l) => l.id === id)?.name || id;

  const outs = new Map();
  for (const e of m.edges) {
    if (e.kind === 'association') continue;
    const list = outs.get(e.from) || [];
    list.push(e);
    outs.set(e.from, list);
  }

  const sorted = m.nodes.slice().sort((a, b) => {
    const pa = phaseAt(m, absolutePosition(m, a).x + 40) || '';
    const pb = phaseAt(m, absolutePosition(m, b).x + 40) || '';
    const ia = m.phases?.findIndex((p) => p.id === pa) ?? -1;
    const ib = m.phases?.findIndex((p) => p.id === pb) ?? -1;
    if (ia !== ib) {
      if (ia < 0) return 1;
      if (ib < 0) return -1;
      return ia - ib;
    }
    if (a.x !== b.x) return a.x - b.x;
    const la = m.lanes.findIndex((l) => l.id === a.lane);
    const lb = m.lanes.findIndex((l) => l.id === b.lane);
    return la - lb;
  });

  let currentPhase = null;
  let num = 0;
  for (const n of sorted) {
    const ph = phaseAt(m, absolutePosition(m, n).x + 40);
    const phName = m.phases?.find((p) => p.id === ph)?.name || 'Sin fase';
    if (phName !== currentPhase) {
      currentPhase = phName;
      lines.push(`Fase «${phName}»`);
      num = 0;
    }
    num++;
    const tipo = TYPE_DEFAULTS[n.type]?.name || n.type;
    let line = `  ${num}. [${laneName(n.lane)}] ${tipo}: ${n.label}`;
    const oe = outs.get(n.id) || [];
    if (n.type === 'decision' && oe.length) {
      lines.push(line);
      for (const e of oe) {
        const t = byId.get(e.to);
        lines.push(
          `       · ${e.label || '(sin etiqueta)'} → [${laneName(t?.lane)}] ${t?.label || e.to}`,
        );
      }
    } else if (oe.length === 1) {
      const e = oe[0];
      const t = byId.get(e.to);
      const kind =
        e.kind === 'message'
          ? 'mensaje a'
          : e.kind === 'return'
            ? 'reproceso a'
            : e.kind === 'async'
              ? 'async a'
              : '→';
      line += ` ${kind} [${laneName(t?.lane)}] «${t?.label || e.to}»`;
      if (e.label) line += ` (${e.label})`;
      lines.push(line);
    } else {
      lines.push(line);
    }
  }

  const returns = m.edges.filter((e) => e.kind === 'return');
  if (returns.length) {
    lines.push('');
    lines.push(
      'Reprocesos: ' +
        returns
          .map((e) => {
            const a = byId.get(e.from);
            const b = byId.get(e.to);
            return `«${a?.label}» → «${b?.label}»${e.label ? ` (${e.label})` : ''}`;
          })
          .join(' · '),
    );
  }

  const notes = m.nodes.filter((n) => n.note);
  if (notes.length) {
    lines.push('');
    lines.push('Notas:');
    for (const n of notes) lines.push(`  - ${n.label}: ${n.note}`);
  }

  if (m.docs?.length) {
    lines.push('');
    lines.push('Docs:');
    for (const d of m.docs) {
      const first = String(d.body || '').split(/\n/)[0].slice(0, 120);
      lines.push(`  - ${d.title || d.id}: ${first}`);
    }
  }

  return lines.join('\n');
}
