/**
 * Auto-colocación de nodos sin x/dy (contrato §6).
 * Mutación in-place: solo se llama desde normalizeFlow sobre una copia.
 */

import {
  COL_W,
  LANE_PAD,
  SLOT_H,
  laneHeightOf,
  nodeSize,
  slotsOfLane,
} from './schema.mjs';

/** Columnas topológicas; ciclos → la arista de cierre cuenta como retorno. */
function topologicalCols(nodes, edges) {
  const ids = new Set(nodes.map((n) => n.id));
  const preds = new Map();
  for (const n of nodes) preds.set(n.id, []);
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    if (e.kind === 'return' || e.kind === 'association') continue;
    preds.get(e.to).push(e.from);
  }

  const col = {};
  const visiting = new Set();
  const done = new Set();

  function dfs(id, stack) {
    if (done.has(id)) return col[id];
    if (visiting.has(id)) return 1; // ciclo: tratar como raíz
    visiting.add(id);
    let c = 1;
    for (const p of preds.get(id) || []) {
      if (stack.has(p)) continue; // arista de ciclo
      const pc = dfs(p, new Set([...stack, id]));
      c = Math.max(c, pc + 1);
    }
    visiting.delete(id);
    done.add(id);
    col[id] = c;
    return c;
  }

  for (const n of nodes) dfs(n.id, new Set());
  return col;
}

function occupied(occ, lane, c, s) {
  return !!occ[`${lane}|${c}|${s}`];
}

function mark(occ, lane, c, s) {
  occ[`${lane}|${c}|${s}`] = 1;
}

/**
 * @param {object} m FlowModel (mutado)
 * @param {string[]} [warn]
 */
export function autoPlace(m, warn = []) {
  const need = m.nodes.filter((n) => n.x == null || n.dy == null || !Number.isFinite(n.x) || !Number.isFinite(n.dy));
  if (!need.length) return;

  // Nodos ya colocados ocupan slots
  const occ = {};
  for (const n of m.nodes) {
    if (need.includes(n)) continue;
    if (n.col != null && n.slot != null) mark(occ, n.lane, n.col, n.slot);
  }

  const topo = topologicalCols(m.nodes, m.edges);
  const byLane = new Map();
  for (const n of need) {
    const list = byLane.get(n.lane) || [];
    list.push(n);
    byLane.set(n.lane, list);
  }

  for (const n of need) {
    const { w, h } = nodeSize(n);
    let c = n.col != null && n.col >= 1 ? Math.round(n.col) : topo[n.id] || 1;
    let s =
      n.slot != null && n.slot >= 1
        ? Math.round(n.slot)
        : null;

    const lane = m.lanes.find((l) => l.id === n.lane);
    let height = laneHeightOf(lane);
    let slots = slotsOfLane(height);

    if (s == null) {
      s = 1;
      let guard = 0;
      while (occupied(occ, n.lane, c, s) && guard++ < 500) {
        s++;
        if (s > slots) {
          s = 1;
          c++;
        }
      }
    } else {
      let guard = 0;
      while (occupied(occ, n.lane, c, s) && guard++ < 500) {
        s++;
        if (s > slots) {
          s = 1;
          c++;
        }
      }
    }

    mark(occ, n.lane, c, s);
    n.col = c;
    n.slot = s;
    n.x = Math.round((c - 1) * COL_W + (COL_W - w) / 2);
    n.dy = Math.round(LANE_PAD + (s - 1) * SLOT_H + (SLOT_H - h) / 2);

    if (n.dy + h > height - LANE_PAD) {
      const newH = n.dy + h + LANE_PAD;
      if (lane) {
        lane.height = newH;
        warn.push(`El carril "${lane.id}" se agrandó para que quepan sus pasos.`);
      }
    }
  }
}
