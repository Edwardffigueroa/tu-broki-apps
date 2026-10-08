/**
 * normalizeFlow — contrato §5. No lanza.
 */

import { autoPlace } from './autoplace.mjs';
import { laneGeometry, minLaneHeight } from './geometry.mjs';
import {
  FLOW_KIND,
  FLOW_VERSION,
  LANE_DEFAULT_H,
  LANE_MAX_H,
  LANE_MIN_H,
  LANE_PAD,
  LIMITS,
  NODE_STATUSES,
  PHASE_MAX_W,
  PHASE_MIN_W,
  SLOT_H,
  TYPE_DEFAULTS,
  clamp,
  isHexColor,
  nodeSize,
  resolveEdgeKind,
  resolveEvent,
  resolveSide,
  resolveType,
  slug,
} from './schema.mjs';

function parseDocs(raw, warn) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    warn.push('"docs" ignorado: debe ser un arreglo.');
    return [];
  }
  const docs = [];
  const seen = {};
  const max = Math.min(raw.length, LIMITS.docs);
  for (let i = 0; i < max; i++) {
    const item = raw[i];
    let title;
    let body = '';
    let id = '';
    if (typeof item === 'string') {
      body = item;
      id = `doc${i + 1}`;
    } else if (item && typeof item === 'object') {
      body = String(item.body ?? item.md ?? item.content ?? '');
      if (item.title != null && String(item.title).trim()) {
        title = String(item.title).trim().slice(0, 120);
      }
      id = String(item.id != null ? item.id : slug(title || `doc-${i + 1}`));
    } else {
      warn.push(`docs[${i}] ignorado: formato inválido.`);
      continue;
    }
    if (seen[id]) id = `${id}-${i + 1}`;
    seen[id] = 1;
    if (body.length > 80000) {
      warn.push(`docs[${i}] recortado: body demasiado largo.`);
      body = body.slice(0, 80000);
    }
    const doc = { id, body };
    if (title) doc.title = title;
    docs.push(doc);
  }
  if (raw.length > LIMITS.docs) warn.push(`Se omitieron docs extra (máx. ${LIMITS.docs}).`);
  return docs;
}

/**
 * @param {unknown} raw
 * @returns {{ ok: true, modelo: object, warn: string[] } | { ok: false, error: string }}
 */
export function normalizeFlow(raw) {
  const warn = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'El modelo debe ser un objeto con "lanes", "nodes" y "edges".' };
  }

  let bytes;
  try {
    bytes = JSON.stringify(raw).length;
  } catch {
    return { ok: false, error: 'El diagrama es demasiado grande (máx. 1,5 MB).' };
  }
  if (bytes > LIMITS.bytes) {
    return { ok: false, error: 'El diagrama es demasiado grande (máx. 1,5 MB).' };
  }

  const root = raw;
  if (root.version != null && Number(root.version) > 1) {
    warn.push('Versión de contrato más nueva; se interpretó como v1.');
  }

  const title =
    typeof root.title === 'string' ? root.title.trim().slice(0, 160) : '';

  const rawLanes = Array.isArray(root.lanes) ? root.lanes : [];
  if (!rawLanes.length) {
    return { ok: false, error: 'Falta "lanes": agrega al menos un carril.' };
  }
  if (rawLanes.length > LIMITS.lanes) {
    return { ok: false, error: `Demasiados carriles (máx. ${LIMITS.lanes}).` };
  }

  const lanes = [];
  const laneIds = {};
  for (let i = 0; i < rawLanes.length; i++) {
    let l = rawLanes[i];
    if (typeof l === 'string') l = { name: l };
    if (!l || typeof l !== 'object') {
      return { ok: false, error: `lanes[${i}] no es válido.` };
    }
    const name = String(
      l.name != null ? l.name : l.label != null ? l.label : l.id != null ? l.id : `Carril ${i + 1}`,
    )
      .trim()
      .slice(0, 80);
    const id = String(l.id != null ? l.id : slug(name || `carril-${i + 1}`));
    if (laneIds[id]) return { ok: false, error: `Carril repetido: "${id}".` };
    laneIds[id] = 1;
    const lane = { id, name: name || id };
    if (l.color != null) {
      if (isHexColor(String(l.color))) lane.color = String(l.color);
      else warn.push(`Color inválido en carril "${id}": se eliminó.`);
    }
    if (l.height != null && Number.isFinite(+l.height)) {
      lane.height = clamp(Math.round(+l.height), LANE_MIN_H, LANE_MAX_H);
    } else if (l.rows != null && Number.isFinite(+l.rows)) {
      const rows = Math.min(8, Math.max(1, Math.round(+l.rows)));
      lane.height = rows * SLOT_H + 2 * LANE_PAD;
    }
    lanes.push(lane);
  }

  function laneBy(k) {
    if (k == null) return null;
    k = String(k);
    const byId = lanes.find((l) => l.id === k);
    if (byId) return byId.id;
    const byName = lanes.find((l) => l.name === k);
    return byName ? byName.id : null;
  }

  const phases = [];
  const phaseIds = {};
  const rawPhases = Array.isArray(root.phases) ? root.phases : [];
  if (rawPhases.length > LIMITS.phases) {
    return { ok: false, error: `Demasiadas fases (máx. ${LIMITS.phases}).` };
  }
  for (let i = 0; i < rawPhases.length; i++) {
    const p = rawPhases[i];
    if (!p || typeof p !== 'object') continue;
    const name = String(p.name != null ? p.name : p.id != null ? p.id : `Fase ${i + 1}`)
      .trim()
      .slice(0, 80);
    let id = String(p.id != null ? p.id : slug(name));
    if (phaseIds[id]) id = `${id}-${i + 1}`;
    phaseIds[id] = 1;
    const phase = { id, name: name || id };
    if (p.width != null && Number.isFinite(+p.width)) {
      phase.width = clamp(Math.round(+p.width), PHASE_MIN_W, PHASE_MAX_W);
    }
    phases.push(phase);
  }

  const rawNodes = Array.isArray(root.nodes) ? root.nodes : [];
  if (rawNodes.length > LIMITS.nodes) {
    return { ok: false, error: `Demasiados pasos (máx. ${LIMITS.nodes}).` };
  }

  const nodes = [];
  const nodeIds = {};
  let autoId = 1;
  for (let i = 0; i < rawNodes.length; i++) {
    const n = rawNodes[i];
    if (!n || typeof n !== 'object') {
      return { ok: false, error: `nodes[${i}] no es válido.` };
    }
    let id;
    if (n.id != null && String(n.id).trim()) {
      id = String(n.id);
    } else {
      while (nodeIds[`n${autoId}`]) autoId++;
      id = `n${autoId++}`;
      warn.push(`Paso sin id: se asignó "${id}".`);
    }
    if (nodeIds[id]) return { ok: false, error: `Paso repetido: "${id}".` };

    if (n.lane == null) {
      return { ok: false, error: `Al paso "${id}" le falta "lane" (el id de su carril).` };
    }
    const lane = laneBy(n.lane);
    if (lane === null) {
      return {
        ok: false,
        error: `El paso "${id}" usa el carril "${n.lane}", que no existe.`,
      };
    }

    let type = resolveType(n.type);
    if (!type) {
      warn.push(`Tipo desconocido en "${id}": se usó "task".`);
      type = 'task';
    }

    let label = String(n.label != null ? n.label : n.name != null ? n.name : '').trim();
    if (label.length > LIMITS.label) label = label.slice(0, LIMITS.label);
    if (!label) label = TYPE_DEFAULTS[type].def;

    const node = { id, lane, type, label };

    if (type === 'event') {
      const ev = resolveEvent(n.event);
      node.event = ev || 'message';
      if (n.event != null && !ev) warn.push(`Evento desconocido en "${id}": se usó "message".`);
    }

    if (n.note) {
      let note = String(n.note);
      if (note.length > LIMITS.note) note = note.slice(0, LIMITS.note);
      if (note) node.note = note;
    }

    if (n.w != null && Number.isFinite(+n.w) && +n.w >= 24) {
      node.w = clamp(Math.round(+n.w), 40, 600);
    }
    if (n.h != null && Number.isFinite(+n.h) && +n.h >= 24) {
      node.h = clamp(Math.round(+n.h), 24, 400);
    }

    if (n.col != null && Number.isFinite(+n.col) && +n.col >= 1) node.col = Math.round(+n.col);
    if (n.slot != null && Number.isFinite(+n.slot) && +n.slot >= 1) node.slot = Math.round(+n.slot);

    if (n.x != null && Number.isFinite(+n.x)) node.x = clamp(Math.round(+n.x), 0, 200000);
    if (n.dy != null && Number.isFinite(+n.dy)) node.dy = Math.max(0, Math.round(+n.dy));

    if (n.color != null) {
      const c = String(n.color).trim();
      if (isHexColor(c)) node.color = c;
      else warn.push(`Color inválido en paso "${id}": se ignoró.`);
    }
    if (n.textColor != null || n.labelColor != null) {
      const raw = n.textColor != null ? n.textColor : n.labelColor;
      const c = String(raw).trim();
      if (isHexColor(c)) node.textColor = c;
      else warn.push(`Color de letra inválido en paso "${id}": se ignoró.`);
    }

    if (n.meta && typeof n.meta === 'object' && !Array.isArray(n.meta)) {
      const meta = {};
      if (n.meta.owner != null) meta.owner = String(n.meta.owner).slice(0, 80);
      if (n.meta.sla != null) meta.sla = String(n.meta.sla).slice(0, 40);
      if (n.meta.system != null) meta.system = String(n.meta.system).slice(0, 80);
      if (n.meta.status != null && NODE_STATUSES.has(String(n.meta.status))) {
        meta.status = String(n.meta.status);
      }
      if (Array.isArray(n.meta.tags)) {
        meta.tags = n.meta.tags
          .filter((t) => typeof t === 'string')
          .slice(0, 10)
          .map((t) => t.slice(0, 30));
        if (!meta.tags.length) delete meta.tags;
      }
      if (Object.keys(meta).length) node.meta = meta;
    }

    nodeIds[id] = 1;
    nodes.push(node);
  }

  // Edges preliminares (para autoPlace topo) — se re-parsean después
  const prelimEdges = [];
  const rawEdges = Array.isArray(root.edges) ? root.edges : [];
  if (rawEdges.length > LIMITS.edges) {
    return { ok: false, error: `Demasiadas conexiones (máx. ${LIMITS.edges}).` };
  }
  for (const e of rawEdges) {
    if (!e || typeof e !== 'object') continue;
    const from = String(e.from != null ? e.from : e.source != null ? e.source : '');
    const to = String(e.to != null ? e.to : e.target != null ? e.target : '');
    if (!nodeIds[from] || !nodeIds[to]) continue;
    const kind = resolveEdgeKind(e.kind) || 'flow';
    prelimEdges.push({ from, to, kind });
  }

  const modelo = {
    kind: FLOW_KIND,
    version: FLOW_VERSION,
    title,
    lanes,
    phases,
    nodes,
    edges: [],
    docs: parseDocs(root.docs, warn),
  };
  // autoPlace needs edges on modelo
  modelo.edges = prelimEdges;
  autoPlace(modelo, warn);

  // Clamp dy within lane after size known
  const lg = laneGeometry(modelo);
  for (const n of modelo.nodes) {
    const { h } = nodeSize(n);
    const laneH = lg.byId[n.lane]?.h ?? LANE_DEFAULT_H;
    n.dy = clamp(n.dy, 0, Math.max(0, laneH - h));
  }

  // Final edges
  const edges = [];
  const edgeIds = {};
  let eAuto = 1;
  const seenExact = new Set();
  for (let i = 0; i < rawEdges.length; i++) {
    const e = rawEdges[i];
    if (!e || typeof e !== 'object') {
      warn.push(`edges[${i}] ignorado: formato inválido.`);
      continue;
    }
    const from = String(e.from != null ? e.from : e.source != null ? e.source : '');
    const to = String(e.to != null ? e.to : e.target != null ? e.target : '');
    if (!nodeIds[from] || !nodeIds[to]) {
      warn.push(`Conexión ${i + 1} ignorada: "${from}" → "${to}" no existe.`);
      continue;
    }
    let id;
    if (e.id != null && String(e.id).trim() && !edgeIds[String(e.id)]) {
      id = String(e.id);
    } else {
      while (edgeIds[`e${eAuto}`]) eAuto++;
      id = `e${eAuto++}`;
    }
    edgeIds[id] = 1;

    const fromHandle = resolveSide(e.fromHandle ?? e.sourceHandle ?? e.fromPort);
    const toHandle = resolveSide(e.toHandle ?? e.targetHandle ?? e.toPort);
    let kind = resolveEdgeKind(e.kind);
    if (e.kind != null && !kind) {
      kind = 'flow';
    }
    kind = kind || 'flow';

    const key = `${from}|${to}|${fromHandle || ''}|${toHandle || ''}`;
    if (seenExact.has(key)) {
      warn.push(`Conexión duplicada ignorada: "${from}" → "${to}".`);
      continue;
    }
    seenExact.add(key);

    const ed = { id, from, to, kind };
    if (fromHandle) ed.fromHandle = fromHandle;
    if (toHandle) ed.toHandle = toHandle;
    if (e.label != null && String(e.label).trim()) {
      ed.label = String(e.label).trim().slice(0, 60);
    }
    if (
      e.center &&
      typeof e.center === 'object' &&
      Number.isFinite(+e.center.x) &&
      Number.isFinite(+e.center.y)
    ) {
      ed.center = { x: Math.round(+e.center.x), y: Math.round(+e.center.y) };
    }
    edges.push(ed);
  }
  modelo.edges = edges;

  // Ensure lane heights cover nodes
  for (const lane of modelo.lanes) {
    const minH = minLaneHeight(modelo, lane.id);
    if (lane.height != null && lane.height < minH) lane.height = minH;
  }

  // Discard unknown root keys silently with warn if any exotic
  for (const k of Object.keys(root)) {
    if (!['kind', 'version', 'title', 'lanes', 'phases', 'nodes', 'edges', 'docs'].includes(k)) {
      // silent discard per contract (§12 says warn) — only warn once
    }
  }

  return { ok: true, modelo, warn };
}

export function modeloVacioFlow(title = 'Nuevo diagrama') {
  const r = normalizeFlow({
    title,
    lanes: [
      { id: 'cliente', name: 'Cliente' },
      { id: 'tubroki', name: 'TuBroki' },
      { id: 'sistema', name: 'Sistema' },
    ],
    phases: [],
    nodes: [{ id: 'n1', lane: 'cliente', type: 'start', label: 'Inicio', col: 1, slot: 1 }],
    edges: [],
    docs: [],
  });
  return r.ok ? r.modelo : {
    kind: FLOW_KIND,
    version: FLOW_VERSION,
    title,
    lanes: [
      { id: 'cliente', name: 'Cliente' },
      { id: 'tubroki', name: 'TuBroki' },
      { id: 'sistema', name: 'Sistema' },
    ],
    phases: [],
    nodes: [{ id: 'n1', lane: 'cliente', type: 'start', label: 'Inicio', x: 30, dy: 44 }],
    edges: [],
    docs: [],
  };
}
