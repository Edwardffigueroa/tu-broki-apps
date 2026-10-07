/**
 * Validación del modelo de diagramas (metadatos + JSON de swimlane).
 * El contrato del lienzo es el mismo del prototipo Carriles.
 */

export const TIPOS = ['swimlane'];

const NODE_TYPES = new Set(['start', 'task', 'decision', 'document', 'end']);
const ALIAS = {
  inicio: 'start',
  tarea: 'task',
  proceso: 'task',
  process: 'task',
  decisión: 'decision',
  decision: 'decision',
  documento: 'document',
  doc: 'document',
  fin: 'end',
  final: 'end',
  stop: 'end',
};

const PORT_ALIAS = {
  top: 'top',
  arriba: 'top',
  up: 'top',
  right: 'right',
  derecha: 'right',
  bottom: 'bottom',
  abajo: 'bottom',
  down: 'bottom',
  left: 'left',
  izquierda: 'left',
};

function parsePort(v) {
  if (v == null) return undefined;
  return PORT_ALIAS[String(v).toLowerCase()];
}

function slug(s) {
  return (
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'x'
  );
}

/**
 * Normaliza el JSON del diagrama de carriles.
 * Devuelve { ok: true, modelo, warn } o { ok: false, error }.
 */
export function normalizeModelo(obj) {
  const warn = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, error: 'La raíz debe ser un objeto con "lanes", "nodes" y "edges".' };
  }

  const m = {
    title: typeof obj.title === 'string' ? obj.title : '',
    lanes: [],
    nodes: [],
    edges: [],
  };

  const rawLanes = Array.isArray(obj.lanes) ? obj.lanes : [];
  if (!rawLanes.length) {
    return { ok: false, error: 'Falta "lanes": agrega al menos un carril.' };
  }

  const laneIds = {};
  for (let i = 0; i < rawLanes.length; i++) {
    let l = rawLanes[i];
    if (typeof l === 'string') l = { name: l };
    if (!l || typeof l !== 'object') {
      return { ok: false, error: `lanes[${i}] no es válido.` };
    }
    const name = String(
      l.name != null ? l.name : l.label != null ? l.label : l.id != null ? l.id : `Carril ${i + 1}`,
    );
    const id = String(l.id != null ? l.id : slug(name));
    if (laneIds[id]) return { ok: false, error: `Carril repetido: "${id}".` };
    laneIds[id] = 1;
    const lane = { id, name };
    if (l.rows != null && Number.isFinite(+l.rows)) {
      const rows = Math.min(8, Math.max(1, Math.round(+l.rows)));
      if (rows !== 2) lane.rows = rows;
    }
    m.lanes.push(lane);
  }

  function laneBy(k) {
    if (k == null) return null;
    k = String(k);
    const byId = m.lanes.find((l) => l.id === k);
    if (byId) return byId.id;
    const byName = m.lanes.find((l) => l.name.toLowerCase() === k.toLowerCase());
    return byName ? byName.id : null;
  }

  const nodeIds = {};
  const rawNodes = Array.isArray(obj.nodes) ? obj.nodes : [];
  for (let i = 0; i < rawNodes.length; i++) {
    const n = rawNodes[i];
    if (!n || typeof n !== 'object') {
      return { ok: false, error: `nodes[${i}] no es válido.` };
    }
    const label = String(
      n.label != null ? n.label : n.name != null ? n.name : n.id != null ? n.id : '',
    );
    const id = String(n.id != null ? n.id : `${slug(label)}-${i}`);
    if (nodeIds[id]) return { ok: false, error: `Paso repetido: "${id}".` };
    if (n.lane == null) {
      return { ok: false, error: `Al paso "${id}" le falta "lane" (el id de su carril).` };
    }
    const lane = laneBy(n.lane);
    if (lane === null) {
      return {
        ok: false,
        error: `El paso "${id}" usa el carril "${n.lane}", que no existe en "lanes".`,
      };
    }
    let type = String(n.type != null ? n.type : 'task').toLowerCase();
    if (!NODE_TYPES.has(type)) type = ALIAS[type] || null;
    if (!type) {
      warn.push(`Tipo desconocido en "${id}": se usó "task".`);
      type = 'task';
    }
    const node = { id, lane, type, label: label || id };
    const st = n.step != null ? n.step : null;
    if (st != null && Number.isFinite(+st) && +st >= 1) node.step = Math.round(+st);
    if (n.row != null && Number.isFinite(+n.row) && +n.row >= 1) node.row = Math.round(+n.row);
    if (n.note) node.note = String(n.note);
    const width = n.w ?? n.width;
    const height = n.h ?? n.height;
    if (width != null && Number.isFinite(+width) && +width >= 24) node.w = Math.round(+width);
    if (height != null && Number.isFinite(+height) && +height >= 24) node.h = Math.round(+height);
    nodeIds[id] = 1;
    m.nodes.push(node);
  }

  const rawEdges = Array.isArray(obj.edges) ? obj.edges : [];
  for (let i = 0; i < rawEdges.length; i++) {
    const e = rawEdges[i];
    if (!e || typeof e !== 'object') {
      return { ok: false, error: `edges[${i}] no es válido.` };
    }
    const from = String(e.from != null ? e.from : e.source != null ? e.source : '');
    const to = String(e.to != null ? e.to : e.target != null ? e.target : '');
    if (!nodeIds[from] || !nodeIds[to]) {
      warn.push(`Conexión ${i + 1} ignorada: "${from}" → "${to}" no existe.`);
      continue;
    }
    if (from === to) {
      warn.push(`Conexión ${i + 1} ignorada: un paso no se conecta consigo mismo.`);
      continue;
    }
    const ed = { from, to };
    if (e.label) ed.label = String(e.label);
    const fp = parsePort(e.fromPort ?? e.from_port);
    const tp = parsePort(e.toPort ?? e.to_port);
    if (fp) ed.fromPort = fp;
    if (tp) ed.toPort = tp;
    m.edges.push(ed);
  }

  // docs: cards de documentación del proceso (Markdown + Mermaid)
  if (obj.docs != null) {
    if (!Array.isArray(obj.docs)) {
      warn.push('"docs" ignorado: debe ser un arreglo.');
    } else {
      const docs = [];
      const seen = {};
      for (let i = 0; i < obj.docs.length; i++) {
        const item = obj.docs[i];
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
      if (docs.length) m.docs = docs;
    }
  }

  return { ok: true, modelo: m, warn };
}

export function modeloVacio(titulo = 'Nuevo diagrama') {
  return {
    title: titulo,
    lanes: [
      { id: 'carril-1', name: 'Carril 1' },
      { id: 'carril-2', name: 'Carril 2' },
    ],
    nodes: [{ id: 'n1', lane: 'carril-1', type: 'start', label: 'Inicio', step: 1 }],
    edges: [],
  };
}

export function validarTitulo(titulo) {
  const t = String(titulo ?? '').trim();
  if (!t) return { ok: false, error: 'El título no puede estar vacío.' };
  if (t.length > 200) return { ok: false, error: 'El título es demasiado largo (máx. 200).' };
  return { ok: true, titulo: t };
}

export function validarNombreCorto(nombre, etiqueta = 'nombre') {
  const t = String(nombre ?? '').trim();
  if (!t) return { ok: false, error: `El ${etiqueta} no puede estar vacío.` };
  if (t.length > 80) return { ok: false, error: `El ${etiqueta} es demasiado largo (máx. 80).` };
  return { ok: true, nombre: t };
}

export function validarColor(color) {
  if (color == null || color === '') return { ok: true, color: null };
  const c = String(color).trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(c) && !/^#[0-9A-Fa-f]{3}$/.test(c)) {
    return { ok: false, error: 'Color inválido (usa #RGB o #RRGGBB).' };
  }
  return { ok: true, color: c };
}

export function validarTipo(tipo) {
  if (!TIPOS.includes(tipo)) {
    return { ok: false, error: `Tipo inválido. Usa: ${TIPOS.join(', ')}` };
  }
  return { ok: true, tipo };
}
