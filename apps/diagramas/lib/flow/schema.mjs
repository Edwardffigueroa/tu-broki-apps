/**
 * Constantes y helpers del contrato swimlane-flow v1.
 */

export const FLOW_KIND = 'swimlane-flow';
export const FLOW_VERSION = 1;

export const COL_W = 200;
export const SLOT_H = 120;
export const LANE_PAD = 10;
export const LANE_DEFAULT_H = 2 * SLOT_H + 2 * LANE_PAD; // 260
export const LANE_MIN_H = 100;
export const LANE_MAX_H = 1600;
export const PHASE_DEFAULT_W = 800;
export const PHASE_MIN_W = 200;
export const PHASE_MAX_W = 8000;
export const HEADER_W = 168;
export const PHASE_H = 36;
export const GRID = 10;

export const LIMITS = {
  lanes: 40,
  phases: 60,
  nodes: 800,
  edges: 2000,
  docs: 50,
  label: 200,
  note: 2000,
  bytes: 1_500_000,
};

export const TYPE_DEFAULTS = {
  start: { name: 'Inicio', w: 140, h: 52, def: 'Inicio', minW: 100, minH: 40 },
  end: { name: 'Fin', w: 140, h: 52, def: 'Fin', minW: 100, minH: 40 },
  task: { name: 'Tarea', w: 160, h: 64, def: 'Nueva tarea', minW: 100, minH: 44 },
  decision: { name: 'Decisión', w: 150, h: 96, def: '¿Condición?', minW: 110, minH: 70 },
  document: { name: 'Documento', w: 160, h: 68, def: 'Documento', minW: 100, minH: 48 },
  event: { name: 'Evento', w: 64, h: 64, def: 'Evento', minW: 48, minH: 48 },
  subprocess: { name: 'Subproceso', w: 170, h: 70, def: 'Subproceso', minW: 110, minH: 50 },
  data: { name: 'Dato / sistema', w: 150, h: 64, def: 'Dato', minW: 100, minH: 48 },
  annotation: { name: 'Nota suelta', w: 160, h: 56, def: 'Nota', minW: 80, minH: 32 },
};

export const TYPE_ORDER = [
  'start',
  'end',
  'task',
  'decision',
  'document',
  'event',
  'subprocess',
  'data',
  'annotation',
];

export const TYPE_ALIAS = {
  inicio: 'start',
  fin: 'end',
  final: 'end',
  stop: 'end',
  tarea: 'task',
  proceso: 'task',
  process: 'task',
  decisión: 'decision',
  decision: 'decision',
  documento: 'document',
  doc: 'document',
  evento: 'event',
  subproceso: 'subprocess',
  dato: 'data',
  datos: 'data',
  'base de datos': 'data',
  nota: 'annotation',
  anotación: 'annotation',
  annotation: 'annotation',
};

export const EVENT_ALIAS = {
  message: 'message',
  mensaje: 'message',
  timer: 'timer',
  tiempo: 'timer',
  temporizador: 'timer',
  signal: 'signal',
  señal: 'signal',
  error: 'error',
};

export const EDGE_KIND_NAMES = {
  flow: 'Flujo',
  message: 'Mensaje',
  return: 'Reproceso',
  async: 'Asíncrono',
  association: 'Asociación',
};

export const EDGE_KIND_ALIAS = {
  flow: 'flow',
  flujo: 'flow',
  message: 'message',
  mensaje: 'message',
  return: 'return',
  retorno: 'return',
  reproceso: 'return',
  async: 'async',
  asincrono: 'async',
  asíncrono: 'async',
  association: 'association',
  asociacion: 'association',
  asociación: 'association',
};

export const SIDE_ALIAS = {
  top: 'top',
  arriba: 'top',
  up: 'top',
  n: 'top',
  right: 'right',
  derecha: 'right',
  e: 'right',
  bottom: 'bottom',
  abajo: 'bottom',
  down: 'bottom',
  s: 'bottom',
  left: 'left',
  izquierda: 'left',
  w: 'left',
};

export const SIDES = ['top', 'right', 'bottom', 'left'];
export const NODE_STATUSES = new Set(['ok', 'riesgo', 'bloqueado', 'pendiente']);

export function slug(s) {
  return (
    String(s)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'x'
  );
}

export function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

export function resolveType(raw) {
  const t = String(raw ?? 'task').toLowerCase().trim();
  if (TYPE_DEFAULTS[t]) return t;
  return TYPE_ALIAS[t] || null;
}

export function resolveEvent(raw) {
  if (raw == null) return 'message';
  const t = String(raw).toLowerCase().trim();
  return EVENT_ALIAS[t] || null;
}

export function resolveSide(raw) {
  if (raw == null) return undefined;
  return SIDE_ALIAS[String(raw).toLowerCase().trim()];
}

export function resolveEdgeKind(raw) {
  if (raw == null) return 'flow';
  const t = String(raw).toLowerCase().trim();
  return EDGE_KIND_ALIAS[t] || null;
}

export function isHexColor(c) {
  return typeof c === 'string' && (/^#[0-9A-Fa-f]{3}$/.test(c) || /^#[0-9A-Fa-f]{6}$/.test(c));
}

export function nodeSize(n) {
  const d = TYPE_DEFAULTS[n.type] || TYPE_DEFAULTS.task;
  return {
    w: n.w != null && Number.isFinite(+n.w) ? +n.w : d.w,
    h: n.h != null && Number.isFinite(+n.h) ? +n.h : d.h,
  };
}

export function laneHeightOf(lane) {
  if (lane?.height != null && Number.isFinite(+lane.height)) return +lane.height;
  return LANE_DEFAULT_H;
}

export function slotsOfLane(height) {
  return Math.max(1, Math.floor((height - 2 * LANE_PAD) / SLOT_H));
}
