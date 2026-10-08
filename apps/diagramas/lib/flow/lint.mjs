/**
 * Lint del flujo (contrato §8).
 */

import { laneGeometry } from './geometry.mjs';
import { laneHeightOf, nodeSize } from './schema.mjs';

function rectsOverlap(a, b) {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  const ox = Math.min(ax2, bx2) - Math.max(a.x, b.x);
  const oy = Math.min(ay2, by2) - Math.max(a.y, b.y);
  return ox > 4 && oy > 4;
}

export function lintFlow(m) {
  const issues = [];
  const outs = new Map();
  const inns = new Map();
  for (const n of m.nodes) {
    outs.set(n.id, []);
    inns.set(n.id, []);
  }
  for (const e of m.edges) {
    if (e.kind === 'association') continue;
    outs.get(e.from)?.push(e);
    inns.get(e.to)?.push(e);
  }

  const hasStart = m.nodes.some(
    (n) => n.type === 'start' || (n.type === 'event' && !(inns.get(n.id)?.length)),
  );
  if (!hasStart && m.nodes.length) {
    issues.push({
      level: 'aviso',
      code: 'SIN_INICIO',
      msg: 'No hay un inicio claro: agrega un paso Inicio o un evento sin entradas.',
    });
  }
  if (!m.nodes.some((n) => n.type === 'end') && m.nodes.length) {
    issues.push({
      level: 'aviso',
      code: 'SIN_FIN',
      msg: 'No hay un paso Fin. Si el proceso termina, agrégalo.',
    });
  }

  const lg = laneGeometry(m);

  for (const n of m.nodes) {
    const out = outs.get(n.id) || [];
    const inn = inns.get(n.id) || [];

    if (n.type === 'decision') {
      if (out.length < 2) {
        issues.push({
          level: 'error',
          code: 'DECISION_SALIDAS',
          nodeId: n.id,
          msg: `La decisión «${n.label}» necesita al menos dos salidas.`,
        });
      } else if (out.some((e) => !e.label)) {
        issues.push({
          level: 'aviso',
          code: 'DECISION_ETIQUETAS',
          nodeId: n.id,
          msg: `La decisión «${n.label}» tiene salidas sin etiqueta.`,
        });
      }
    }

    if (!inn.length && n.type !== 'start' && n.type !== 'event' && n.type !== 'annotation') {
      issues.push({
        level: 'aviso',
        code: 'HUERFANO_ENTRADA',
        nodeId: n.id,
        msg: `El paso «${n.label}» no tiene entradas.`,
      });
    }
    if (!out.length && n.type !== 'end' && n.type !== 'annotation' && n.type !== 'data') {
      issues.push({
        level: 'aviso',
        code: 'HUERFANO_SALIDA',
        nodeId: n.id,
        msg: `El paso «${n.label}» no tiene salidas.`,
      });
    }

    const { h } = nodeSize(n);
    const laneH = lg.byId[n.lane]?.h ?? laneHeightOf(m.lanes.find((l) => l.id === n.lane));
    if (n.dy < 0 || n.dy + h > laneH) {
      issues.push({
        level: 'error',
        code: 'FUERA_DE_CARRIL',
        nodeId: n.id,
        msg: `El paso «${n.label}» se sale de su carril.`,
      });
    }
  }

  // Solapes por carril
  const byLane = new Map();
  for (const n of m.nodes) {
    const list = byLane.get(n.lane) || [];
    list.push(n);
    byLane.set(n.lane, list);
  }
  for (const [, list] of byLane) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const sa = nodeSize(a);
        const sb = nodeSize(b);
        if (
          rectsOverlap(
            { x: a.x, y: a.dy, w: sa.w, h: sa.h },
            { x: b.x, y: b.dy, w: sb.w, h: sb.h },
          )
        ) {
          issues.push({
            level: 'error',
            code: 'SOLAPE',
            nodeId: a.id,
            msg: `Los pasos «${a.label}» y «${b.label}» se solapan.`,
          });
        }
      }
    }
  }

  for (const e of m.edges) {
    if (e.kind === 'message') {
      const a = m.nodes.find((n) => n.id === e.from);
      const b = m.nodes.find((n) => n.id === e.to);
      if (a && b && a.lane === b.lane) {
        issues.push({
          level: 'aviso',
          code: 'MENSAJE_MISMO_CARRIL',
          edgeId: e.id,
          msg: 'Una conexión de mensaje une dos pasos del mismo carril.',
        });
      }
    }
    if (e.kind === 'association') {
      const a = m.nodes.find((n) => n.id === e.from);
      const b = m.nodes.find((n) => n.id === e.to);
      if (a && b && a.type !== 'annotation' && b.type !== 'annotation') {
        issues.push({
          level: 'aviso',
          code: 'ASOCIACION_SIN_NOTA',
          edgeId: e.id,
          msg: 'Una asociación debería unir una nota suelta a un paso.',
        });
      }
    }
  }

  return issues;
}
