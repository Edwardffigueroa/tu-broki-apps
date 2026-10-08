/**
 * Interoperabilidad clásico ↔ Pro (por copia).
 */

import { colOf, phaseGeometry, slotOf } from './geometry.mjs';
import { normalizeFlow } from './normalize.mjs';
import {
  LANE_PAD,
  SLOT_H,
  clamp,
  nodeSize,
} from './schema.mjs';

function placeFreeClassic(nodes, laneId, preferStep, preferRow, rows, exceptId) {
  let step = Math.max(1, Math.round(preferStep) || 1);
  let row = clamp(Math.round(preferRow) || 1, 1, rows);
  let guard = 0;
  const taken = (s, r) =>
    nodes.some(
      (o) =>
        o.id !== exceptId &&
        o.lane === laneId &&
        (o.step ?? 0) === s &&
        (o.row ?? 1) === r,
    );
  while (taken(step, row) && guard++ < 500) {
    row++;
    if (row > rows) {
      row = 1;
      step++;
    }
  }
  return { step, row };
}

/**
 * @param {object} classic — ya normalizado y materializado (step/row)
 */
export function fromCarriles(classic) {
  const warn = [];
  if (!classic || typeof classic !== 'object') {
    return { modelo: normalizeFlow({ lanes: ['Cliente'], nodes: [], edges: [] }).modelo, warn: ['Entrada inválida.'] };
  }

  const titleBase = typeof classic.title === 'string' && classic.title.trim()
    ? classic.title.trim()
    : 'Copia en Pro';
  const title = titleBase.endsWith('(Pro)') ? titleBase : `${titleBase} (Pro)`;

  const lanes = (classic.lanes || []).map((l) => {
    const rows = l.rows != null && Number.isFinite(+l.rows) ? clamp(+l.rows, 1, 8) : 2;
    return {
      id: l.id,
      name: l.name,
      height: rows * SLOT_H + 2 * LANE_PAD,
    };
  });

  const nodes = (classic.nodes || []).map((n) => {
    const node = {
      id: n.id,
      lane: n.lane,
      type: n.type,
      label: n.label,
    };
    if (n.note) node.note = n.note;
    if (n.step != null) node.col = n.step;
    if (n.row != null) node.slot = n.row;
    return node;
  });

  let back = 0;
  const edges = (classic.edges || []).map((e, i) => {
    const from = classic.nodes.find((n) => n.id === e.from);
    const to = classic.nodes.find((n) => n.id === e.to);
    const kind =
      from && to && (to.step ?? 0) < (from.step ?? 0) ? ((back++), 'return') : 'flow';
    const ed = {
      id: `e${i + 1}`,
      from: e.from,
      to: e.to,
      kind,
    };
    if (e.label) ed.label = e.label;
    if (e.fromPort) ed.fromHandle = e.fromPort;
    if (e.toPort) ed.toHandle = e.toPort;
    return ed;
  });
  if (back > 0) {
    warn.push(
      `Marcamos ${back} ${back === 1 ? 'conexión' : 'conexiones'} hacia atrás como reproceso.`,
    );
  }

  const docs = Array.isArray(classic.docs) ? structuredClone(classic.docs) : [];

  const r = normalizeFlow({ title, lanes, phases: [], nodes, edges, docs });
  if (!r.ok) throw new Error(r.error);
  return { modelo: r.modelo, warn: [...warn, ...r.warn] };
}

/**
 * @param {object} m FlowModel
 */
export function toCarriles(m) {
  const warn = [];
  const titleBase = m.title?.trim() || 'Sin título';
  const title = titleBase.endsWith('(clásico)') ? titleBase : `${titleBase} (clásico)`;

  let colorLost = 0;
  const lanes = m.lanes.map((l) => {
    const h = l.height ?? 260;
    const rows = clamp(Math.round((h - 2 * LANE_PAD) / SLOT_H), 1, 8);
    if (l.color) colorLost++;
    const lane = { id: l.id, name: l.name };
    if (rows !== 2) lane.rows = rows;
    return lane;
  });
  if (colorLost) warn.push(`Se perdieron ${colorLost} color${colorLost === 1 ? '' : 'es'} de carril.`);

  const nodeColorLost = m.nodes.filter((n) => n.color).length;
  if (nodeColorLost) {
    warn.push(
      `Se perdieron ${nodeColorLost} color${nodeColorLost === 1 ? '' : 'es'} de paso (el clásico no los guarda).`,
    );
  }
  const textColorLost = m.nodes.filter((n) => n.textColor).length;
  if (textColorLost) {
    warn.push(
      `Se perdieron ${textColorLost} color${textColorLost === 1 ? '' : 'es'} de letra (el clásico no los guarda).`,
    );
  }

  const converted = { event: 0, subprocess: 0, data: 0, annotation: 0 };
  const classicNodes = [];
  const annotationNotes = []; // { text, associatedTo? }
  const nodeById = new Map(m.nodes.map((n) => [n.id, n]));

  // associations: annotation → target
  const assocTo = new Map();
  for (const e of m.edges) {
    if (e.kind !== 'association') continue;
    const a = nodeById.get(e.from);
    const b = nodeById.get(e.to);
    if (a?.type === 'annotation') assocTo.set(a.id, b?.id);
    else if (b?.type === 'annotation') assocTo.set(b.id, a?.id);
  }

  for (const n of m.nodes) {
    if (n.type === 'annotation') {
      converted.annotation++;
      const target = assocTo.get(n.id);
      if (target) {
        annotationNotes.push({ text: n.label || n.note || '', target });
      } else {
        annotationNotes.push({ text: [n.label, n.note].filter(Boolean).join('\n'), loose: true });
      }
      continue;
    }

    let type = n.type;
    if (type === 'event') {
      type = 'task';
      converted.event++;
    } else if (type === 'subprocess') {
      type = 'task';
      converted.subprocess++;
    } else if (type === 'data') {
      type = 'document';
      converted.data++;
    } else if (!['start', 'end', 'task', 'decision', 'document'].includes(type)) {
      type = 'task';
    }

    const { w, h } = nodeSize(n);
    const lane = lanes.find((l) => l.id === n.lane);
    const laneH = (lane?.rows ?? 2) * SLOT_H + 2 * LANE_PAD;
    let step = colOf(n.x + w / 2);
    let row = slotOf(laneH, n.dy + h / 2);

    let note = n.note || '';
    if (n.type === 'event') {
      const evNames = { message: 'mensaje', timer: 'tiempo', signal: 'señal', error: 'error' };
      const prefix = `Evento (${evNames[n.event] || 'mensaje'}).`;
      note = note ? `${prefix} ${note}` : prefix;
    }
    if (n.meta) {
      const parts = [];
      if (n.meta.owner) parts.push(`Responsable: ${n.meta.owner}`);
      if (n.meta.sla) parts.push(`SLA: ${n.meta.sla}`);
      if (n.meta.system) parts.push(`Sistema: ${n.meta.system}`);
      if (n.meta.status) parts.push(`Estado: ${n.meta.status}`);
      if (n.meta.tags?.length) parts.push(`Etiquetas: ${n.meta.tags.join(', ')}`);
      if (parts.length) note = note ? `${note} · ${parts.join(' · ')}` : parts.join(' · ');
    }

    classicNodes.push({
      id: n.id,
      lane: n.lane,
      type,
      label: n.label,
      step,
      row,
      _preferStep: step,
      _preferRow: row,
      note: note || undefined,
    });
  }

  // Attach annotation texts
  for (const a of annotationNotes) {
    if (a.target) {
      const t = classicNodes.find((n) => n.id === a.target);
      if (t) t.note = t.note ? `${t.note}\nNota: ${a.text}` : `Nota: ${a.text}`;
    }
  }

  // Resolve collisions
  let relocated = 0;
  const placed = [];
  for (const n of classicNodes) {
    const lane = lanes.find((l) => l.id === n.lane);
    const rows = lane?.rows ?? 2;
    const { step, row } = placeFreeClassic(placed, n.lane, n._preferStep, n._preferRow, rows, n.id);
    if (step !== n._preferStep || row !== n._preferRow) relocated++;
    const cn = { id: n.id, lane: n.lane, type: n.type, label: n.label, step, row };
    if (n.note) cn.note = n.note;
    placed.push(cn);
  }
  if (relocated) {
    warn.push(`Reubicamos ${relocated} paso${relocated === 1 ? '' : 's'} que caían en la misma celda.`);
  }

  const typeWarn = [];
  if (converted.event) typeWarn.push(`${converted.event} evento${converted.event === 1 ? '' : 's'} → tarea`);
  if (converted.subprocess) typeWarn.push(`${converted.subprocess} subproceso${converted.subprocess === 1 ? '' : 's'} → tarea`);
  if (converted.data) typeWarn.push(`${converted.data} dato${converted.data === 1 ? '' : 's'} → documento`);
  if (converted.annotation) typeWarn.push(`${converted.annotation} nota${converted.annotation === 1 ? '' : 's'} suelta${converted.annotation === 1 ? '' : 's'}`);
  if (typeWarn.length) warn.push(`Tipos convertidos: ${typeWarn.join('; ')}.`);

  let kindLost = 0;
  const edges = [];
  for (const e of m.edges) {
    if (e.kind === 'association') continue;
    const fromN = nodeById.get(e.from);
    const toN = nodeById.get(e.to);
    if (!fromN || !toN) continue;
    if (fromN.type === 'annotation' || toN.type === 'annotation') continue;
    if (!placed.some((n) => n.id === e.from) || !placed.some((n) => n.id === e.to)) continue;
    if (e.kind && e.kind !== 'flow') kindLost++;
    const ed = { from: e.from, to: e.to };
    if (e.label) ed.label = e.label;
    if (e.fromHandle) ed.fromPort = e.fromHandle;
    if (e.toHandle) ed.toPort = e.toHandle;
    edges.push(ed);
  }
  if (kindLost) {
    warn.push(
      `Se perdió el tipo de ${kindLost} ${kindLost === 1 ? 'conexión' : 'conexiones'} (mensaje, reproceso, asíncrono).`,
    );
  }

  const docs = Array.isArray(m.docs) ? structuredClone(m.docs) : [];
  const loose = annotationNotes.filter((a) => a.loose);
  if (loose.length) {
    docs.push({
      id: nextDocId(docs),
      title: 'Notas sueltas (de Carriles Pro)',
      body: loose.map((a) => `- ${a.text}`).join('\n'),
    });
    warn.push('Las notas sueltas sin asociación pasaron a un doc.');
  }

  if (m.phases?.length) {
    const pg = phaseGeometry(m);
    const lines = m.phases.map((p, i) => {
      const left = pg.lefts[i];
      const right = left + pg.widths[i];
      return `- **${p.name}**: columnas ${colOf(left + 1)}–${colOf(right - 1)}`;
    });
    docs.push({
      id: nextDocId(docs),
      title: 'Fases (de Carriles Pro)',
      body: lines.join('\n'),
    });
    warn.push('Las fases se guardaron como una nota de documentación.');
  }

  return {
    modelo: { title, lanes, nodes: placed, edges, docs: docs.length ? docs : undefined },
    warn,
  };
}

function nextDocId(docs) {
  let k = 1;
  while (docs.some((d) => d.id === `doc${k}`)) k++;
  return `doc${k}`;
}
