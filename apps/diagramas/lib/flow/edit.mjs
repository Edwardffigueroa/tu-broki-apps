/**
 * Operaciones puras de edición (devuelven modelo nuevo).
 */

import { absolutePosition, minLaneHeight, placeFromAbsolute } from './geometry.mjs';
import {
  COL_W,
  LANE_DEFAULT_H,
  LANE_MAX_H,
  LANE_MIN_H,
  PHASE_DEFAULT_W,
  PHASE_MAX_W,
  PHASE_MIN_W,
  SLOT_H,
  TYPE_DEFAULTS,
  clamp,
  isHexColor,
  nodeSize,
  slug,
} from './schema.mjs';

function clone(m) {
  return structuredClone(m);
}

function nextId(items, prefix) {
  let k = 1;
  while (items.some((x) => x.id === prefix + k)) k++;
  return prefix + k;
}

function laneOf(m, id) {
  return m.lanes.find((l) => l.id === id);
}

function ensureDy(m, n) {
  const { h } = nodeSize(n);
  const lane = laneOf(m, n.lane);
  const height = lane?.height ?? LANE_DEFAULT_H;
  n.dy = clamp(n.dy, 0, Math.max(0, height - h));
  if (n.dy + h > height - 10) {
    if (lane) lane.height = clamp(n.dy + h + 10, LANE_MIN_H, LANE_MAX_H);
  }
}

export function addNode(m, { type, lane, x, dy, label }) {
  const out = clone(m);
  const t = TYPE_DEFAULTS[type] ? type : 'task';
  const id = nextId(out.nodes, 'n');
  const n = {
    id,
    lane: laneOf(out, lane) ? lane : out.lanes[0]?.id,
    type: t,
    label: label || TYPE_DEFAULTS[t].def,
    x: Math.max(0, Math.round(x ?? 40)),
    dy: Math.max(0, Math.round(dy ?? 40)),
  };
  if (t === 'event') n.event = 'message';
  ensureDy(out, n);
  out.nodes.push(n);
  return out;
}

export function addNodeAfter(m, fromId, type = 'task') {
  const out = clone(m);
  const from = out.nodes.find((n) => n.id === fromId);
  if (!from) return { m: out, id: null };
  let x = from.x + COL_W;
  let dy = from.dy;
  const id = nextId(out.nodes, 'n');
  const t = TYPE_DEFAULTS[type] ? type : 'task';
  const nw = TYPE_DEFAULTS[t].w;
  const nh = TYPE_DEFAULTS[t].h;

  const overlaps = (xx, dd) =>
    out.nodes.some((o) => {
      const s = nodeSize(o);
      return (
        o.lane === from.lane &&
        Math.abs(o.x + s.w / 2 - (xx + nw / 2)) < (s.w + nw) / 2 - 4 &&
        Math.abs(o.dy + s.h / 2 - (dd + nh / 2)) < (s.h + nh) / 2 - 4
      );
    });

  if (overlaps(x, dy)) {
    dy = from.dy + SLOT_H;
    if (overlaps(x, dy)) {
      x = from.x + 2 * COL_W;
      dy = from.dy;
    }
  }

  const n = {
    id,
    lane: from.lane,
    type: t,
    label: TYPE_DEFAULTS[t].def,
    x,
    dy,
  };
  if (t === 'event') n.event = 'message';
  ensureDy(out, n);
  out.nodes.push(n);
  if (from.type !== 'end') {
    out.edges.push({
      id: nextId(out.edges, 'e'),
      from: fromId,
      to: id,
      kind: 'flow',
    });
  }
  return { m: out, id };
}

export function moveNodes(m, moves) {
  const out = clone(m);
  const map = new Map(moves.map((mv) => [mv.id, mv]));
  for (const n of out.nodes) {
    const mv = map.get(n.id);
    if (!mv) continue;
    if (mv.lane && laneOf(out, mv.lane)) n.lane = mv.lane;
    if (mv.x != null) n.x = Math.max(0, Math.round(mv.x));
    if (mv.dy != null) n.dy = Math.max(0, Math.round(mv.dy));
    ensureDy(out, n);
  }
  return out;
}

export function resizeNode(m, id, { w, h }) {
  const out = clone(m);
  const n = out.nodes.find((x) => x.id === id);
  if (!n) return out;
  const d = TYPE_DEFAULTS[n.type] || TYPE_DEFAULTS.task;
  n.w = clamp(Math.round(w), d.minW, 600);
  n.h = clamp(Math.round(h), d.minH, 400);
  ensureDy(out, n);
  return out;
}

export function updateNode(m, id, patch) {
  const out = clone(m);
  const n = out.nodes.find((x) => x.id === id);
  if (!n) return out;
  if (patch.label != null) n.label = String(patch.label).slice(0, 200);
  if (patch.type != null && TYPE_DEFAULTS[patch.type]) {
    n.type = patch.type;
    if (n.type === 'event') n.event = n.event || patch.event || 'message';
    else delete n.event;
  }
  if (patch.event != null && n.type === 'event') n.event = patch.event;
  if (patch.note !== undefined) {
    if (patch.note) n.note = String(patch.note).slice(0, 2000);
    else delete n.note;
  }
  if (patch.meta !== undefined) {
    if (patch.meta) n.meta = patch.meta;
    else delete n.meta;
  }
  if (patch.lane != null && laneOf(out, patch.lane)) {
    n.lane = patch.lane;
    ensureDy(out, n);
  }
  if (patch.color !== undefined) {
    if (patch.color && isHexColor(String(patch.color).trim())) n.color = String(patch.color).trim();
    else delete n.color;
  }
  if (patch.textColor !== undefined) {
    if (patch.textColor && isHexColor(String(patch.textColor).trim())) {
      n.textColor = String(patch.textColor).trim();
    } else {
      delete n.textColor;
    }
  }
  return out;
}

export function deleteElements(m, { nodeIds = [], edgeIds = [] }) {
  const out = clone(m);
  const nset = new Set(nodeIds);
  const eset = new Set(edgeIds);
  out.nodes = out.nodes.filter((n) => !nset.has(n.id));
  out.edges = out.edges.filter(
    (e) => !eset.has(e.id) && !nset.has(e.from) && !nset.has(e.to),
  );
  return out;
}

export function addEdge(m, { from, to, fromHandle, toHandle, kind }) {
  const out = clone(m);
  const a = out.nodes.find((n) => n.id === from);
  const b = out.nodes.find((n) => n.id === to);
  if (!a || !b) return out;
  if (from === to && fromHandle === toHandle) return m;

  const exists = out.edges.some(
    (e) =>
      e.from === from &&
      e.to === to &&
      (e.fromHandle || '') === (fromHandle || '') &&
      (e.toHandle || '') === (toHandle || ''),
  );
  if (exists) return m;

  let k = kind;
  if (!k) {
    if (a.type === 'annotation' || b.type === 'annotation') k = 'association';
    else if (a.lane !== b.lane) k = 'message';
    else k = 'flow';
  }

  const ed = { id: nextId(out.edges, 'e'), from, to, kind: k };
  if (fromHandle) ed.fromHandle = fromHandle;
  if (toHandle) ed.toHandle = toHandle;
  out.edges.push(ed);
  return out;
}

export function reconnectEdge(m, edgeId, { from, to, fromHandle, toHandle }) {
  const out = clone(m);
  const e = out.edges.find((x) => x.id === edgeId);
  if (!e) return out;
  if (!out.nodes.some((n) => n.id === from) || !out.nodes.some((n) => n.id === to)) return out;
  e.from = from;
  e.to = to;
  if (fromHandle) e.fromHandle = fromHandle;
  else delete e.fromHandle;
  if (toHandle) e.toHandle = toHandle;
  else delete e.toHandle;
  return out;
}

export function updateEdge(m, edgeId, patch) {
  const out = clone(m);
  const e = out.edges.find((x) => x.id === edgeId);
  if (!e) return out;
  if (patch.label !== undefined) {
    if (patch.label) e.label = String(patch.label).slice(0, 60);
    else delete e.label;
  }
  if (patch.kind != null) e.kind = patch.kind;
  if (patch.fromHandle !== undefined) {
    if (patch.fromHandle) e.fromHandle = patch.fromHandle;
    else delete e.fromHandle;
  }
  if (patch.toHandle !== undefined) {
    if (patch.toHandle) e.toHandle = patch.toHandle;
    else delete e.toHandle;
  }
  if (patch.center !== undefined) {
    if (patch.center) e.center = patch.center;
    else delete e.center;
  }
  return out;
}

export function reverseEdge(m, edgeId) {
  const out = clone(m);
  const e = out.edges.find((x) => x.id === edgeId);
  if (!e) return out;
  const f = e.from;
  e.from = e.to;
  e.to = f;
  const fh = e.fromHandle;
  e.fromHandle = e.toHandle;
  e.toHandle = fh;
  if (!e.fromHandle) delete e.fromHandle;
  if (!e.toHandle) delete e.toHandle;
  return out;
}

export function addLane(m, { name, index } = {}) {
  const out = clone(m);
  const base = name || `Carril ${out.lanes.length + 1}`;
  let id = slug(base);
  let k = 2;
  while (out.lanes.some((l) => l.id === id)) id = `${slug(base)}-${k++}`;
  const lane = { id, name: base, height: LANE_DEFAULT_H };
  const i = index != null ? clamp(index, 0, out.lanes.length) : out.lanes.length;
  out.lanes.splice(i, 0, lane);
  return out;
}

export function updateLane(m, laneId, patch) {
  const out = clone(m);
  const lane = laneOf(out, laneId);
  if (!lane) return out;
  if (patch.name != null) lane.name = String(patch.name).slice(0, 80);
  if (patch.color !== undefined) {
    if (patch.color && isHexColor(patch.color)) lane.color = patch.color;
    else delete lane.color;
  }
  if (patch.height != null) {
    const min = minLaneHeight(out, laneId);
    lane.height = clamp(Math.round(patch.height), min, LANE_MAX_H);
  }
  return out;
}

export function moveLane(m, laneId, toIndex) {
  const out = clone(m);
  const i = out.lanes.findIndex((l) => l.id === laneId);
  if (i < 0) return out;
  const [lane] = out.lanes.splice(i, 1);
  out.lanes.splice(clamp(toIndex, 0, out.lanes.length), 0, lane);
  return out;
}

export function deleteLane(m, laneId) {
  if (m.lanes.length <= 1) return m;
  const out = clone(m);
  out.lanes = out.lanes.filter((l) => l.id !== laneId);
  const gone = new Set(m.nodes.filter((n) => n.lane === laneId).map((n) => n.id));
  out.nodes = out.nodes.filter((n) => n.lane !== laneId);
  out.edges = out.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to));
  return out;
}

export function addPhase(m, { name, index } = {}) {
  const out = clone(m);
  const base = name || `Fase ${(out.phases?.length || 0) + 1}`;
  let id = slug(base);
  let k = 2;
  const phases = out.phases || (out.phases = []);
  while (phases.some((p) => p.id === id)) id = `${slug(base)}-${k++}`;
  const phase = { id, name: base, width: PHASE_DEFAULT_W };
  const i = index != null ? clamp(index, 0, phases.length) : phases.length;
  phases.splice(i, 0, phase);
  return out;
}

export function updatePhase(m, phaseId, patch) {
  const out = clone(m);
  const p = (out.phases || []).find((x) => x.id === phaseId);
  if (!p) return out;
  if (patch.name != null) p.name = String(patch.name).slice(0, 80);
  if (patch.width != null) p.width = clamp(Math.round(patch.width), PHASE_MIN_W, PHASE_MAX_W);
  return out;
}

export function movePhase(m, phaseId, toIndex) {
  const out = clone(m);
  const phases = out.phases || [];
  const i = phases.findIndex((p) => p.id === phaseId);
  if (i < 0) return out;
  const [p] = phases.splice(i, 1);
  phases.splice(clamp(toIndex, 0, phases.length), 0, p);
  return out;
}

export function deletePhase(m, phaseId) {
  const out = clone(m);
  out.phases = (out.phases || []).filter((p) => p.id !== phaseId);
  return out;
}

export function pasteNodes(m, clip, offset = { x: 24, y: 24 }) {
  const out = clone(m);
  if (!clip?.nodes?.length) return { m: out, ids: [] };
  const idMap = {};
  const ids = [];
  for (const n of clip.nodes) {
    const nid = nextId(out.nodes, 'n');
    idMap[n.id] = nid;
    ids.push(nid);
    const lane = laneOf(out, n.lane) ? n.lane : out.lanes[0]?.id;
    const nn = {
      ...structuredClone(n),
      id: nid,
      lane,
      x: Math.max(0, (n.x || 0) + (offset.x || 0)),
      dy: Math.max(0, (n.dy || 0) + (offset.y || 0)),
    };
    ensureDy(out, nn);
    out.nodes.push(nn);
  }
  for (const e of clip.edges || []) {
    if (!idMap[e.from] || !idMap[e.to]) continue;
    out.edges.push({
      ...structuredClone(e),
      id: nextId(out.edges, 'e'),
      from: idMap[e.from],
      to: idMap[e.to],
    });
  }
  return { m: out, ids };
}

export function duplicateNodes(m, ids) {
  const set = new Set(ids);
  const nodes = m.nodes.filter((n) => set.has(n.id));
  const edges = m.edges.filter((e) => set.has(e.from) && set.has(e.to));
  return pasteNodes(m, { nodes, edges }, { x: 24, y: 24 });
}

export function alignNodes(m, ids, mode) {
  const out = clone(m);
  const set = new Set(ids);
  const nodes = out.nodes.filter((n) => set.has(n.id));
  if (nodes.length < 2) return out;
  const abs = nodes.map((n) => ({ n, ...absolutePosition(out, n), ...nodeSize(n) }));
  if (mode === 'left') {
    const x = Math.min(...abs.map((a) => a.x));
    for (const a of abs) a.n.x = x;
  } else if (mode === 'hcenter') {
    const cx = abs.reduce((s, a) => s + a.x + a.w / 2, 0) / abs.length;
    for (const a of abs) a.n.x = Math.round(cx - a.w / 2);
  } else if (mode === 'top') {
    // align dy within same lane groups
    const byLane = new Map();
    for (const a of abs) {
      const list = byLane.get(a.n.lane) || [];
      list.push(a);
      byLane.set(a.n.lane, list);
    }
    for (const [, list] of byLane) {
      const dy = Math.min(...list.map((a) => a.n.dy));
      for (const a of list) a.n.dy = dy;
    }
  } else if (mode === 'vcenter') {
    const byLane = new Map();
    for (const a of abs) {
      const list = byLane.get(a.n.lane) || [];
      list.push(a);
      byLane.set(a.n.lane, list);
    }
    for (const [, list] of byLane) {
      const cy = list.reduce((s, a) => s + a.n.dy + a.h / 2, 0) / list.length;
      for (const a of list) a.n.dy = Math.max(0, Math.round(cy - a.h / 2));
    }
  }
  return out;
}

export function distributeNodes(m, ids, axis = 'h') {
  const out = clone(m);
  const set = new Set(ids);
  const nodes = out.nodes.filter((n) => set.has(n.id));
  if (nodes.length < 3 || axis !== 'h') return out;
  const sorted = nodes.slice().sort((a, b) => a.x - b.x);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const span = last.x - first.x;
  const step = span / (sorted.length - 1);
  for (let i = 1; i < sorted.length - 1; i++) {
    sorted[i].x = Math.round(first.x + step * i);
  }
  return out;
}

export { placeFromAbsolute };
